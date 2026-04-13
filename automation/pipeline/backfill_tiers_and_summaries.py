
"""
Backfill script to assign tiers and generate AI content for story clusters.
- Finds story_clusters with tier = NULL
- Derives tier from oz_score (>=0.7 → T1, >=0.4 → T2, else T3)
- Generates AI content (headline, summary, why_it_matters for T1, explainer for T1)
- Updates story_clusters.tier
- If editor_queue entry exists, also updates AI content there

Fetches all clusters at once, then processes them one by one with delays.
"""

import sys
import time
import logging
from explainer import generate_for_cluster
from db import get_connection, dict_cursor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def get_all_incomplete_clusters():
    """Fetch all clusters that need tier assignment in one query."""
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            # Find all active clusters with NULL tier
            cur.execute(
                """
                SELECT id as cluster_id,
                       tier,
                       oz_score
                FROM story_clusters
                WHERE status = 'active'
                  AND tier IS NULL
                  AND oz_score > 0
                ORDER BY oz_score DESC
                """,
            )
            return cur.fetchall()
    finally:
        conn.close()


def update_cluster_tier_and_queue(cluster_id: str, result: dict) -> None:
    """Write tier to story_clusters and AI content to editor_queue (creates if needed for Tier 1)."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Always update tier on story_clusters
            cur.execute(
                """
                UPDATE story_clusters
                SET tier = %s
                WHERE id = %s
                """,
                (result["tier"], cluster_id),
            )

            # For Tier 1: create editor_queue entry if it doesn't exist
            if result["tier"] == 1:
                from datetime import date
                cur.execute(
                    """
                    INSERT INTO editor_queue (cluster_id, edition, edition_date, status, ai_headline, ai_summary, ai_why_matters, ai_double_click)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (cluster_id, edition, edition_date) DO UPDATE
                    SET ai_headline = EXCLUDED.ai_headline,
                        ai_summary = EXCLUDED.ai_summary,
                        ai_why_matters = EXCLUDED.ai_why_matters,
                        ai_double_click = EXCLUDED.ai_double_click
                    WHERE editor_queue.ai_headline IS NULL
                    """,
                    (
                        cluster_id,
                        'morning',  # Default to morning edition
                        date.today(),
                        'pending',
                        result["headline"],
                        result["card_summary"],
                        result["why_it_matters"],
                        result["explainer_body"],
                    ),
                )
            else:
                # For Tier 2/3: only update if editor_queue entry already exists
                cur.execute(
                    """
                    UPDATE editor_queue
                    SET ai_headline    = %s,
                        ai_summary     = %s,
                        ai_why_matters = %s,
                        ai_double_click = %s
                    WHERE cluster_id = %s
                      AND ai_headline IS NULL
                    """,
                    (
                        result["headline"],
                        result["card_summary"],
                        result["why_it_matters"],
                        result["explainer_body"],
                        cluster_id,
                    ),
                )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def process_cluster(cluster_id: str, oz_score: float) -> bool:
    """Process a single cluster - generate content and assign tier."""
    logger.info("Processing cluster=%s (oz_score=%.3f)", cluster_id, oz_score)

    try:
        # Generate AI content (this also derives tier)
        result = generate_for_cluster(cluster_id)

        # Update database
        update_cluster_tier_and_queue(cluster_id, result)

        logger.info(
            "✓ Done: tier=%d, headline='%s', summary=%d chars, why_matters=%d chars, double_click=%d chars",
            result["tier"],
            result["headline"][:50] + "..." if len(result["headline"]) > 50 else result["headline"],
            len(result["card_summary"]),
            len(result["why_it_matters"]),
            len(result["explainer_body"]),
        )
        return True

    except Exception as exc:
        logger.error("✗ Failed cluster %s: %s", cluster_id, exc)
        return False


def backfill_all(delay_seconds: int = 2):
    """Fetch all clusters at once, process them one by one with delays."""
    logger.info("Fetching all clusters with NULL tiers...")
    clusters = get_all_incomplete_clusters()

    if not clusters:
        logger.info("✓ All clusters already have tiers assigned!")
        return

    total = len(clusters)
    logger.info("Found %d clusters to process. Starting (delay=%ds)...", total, delay_seconds)

    success_count = 0
    fail_count = 0

    for i, row in enumerate(clusters, 1):
        cluster_id = row["cluster_id"]
        oz_score = row["oz_score"]

        logger.info("[%d/%d] Processing cluster %s...", i, total, cluster_id)

        if process_cluster(cluster_id, oz_score):
            success_count += 1
        else:
            fail_count += 1

        # Delay before next (except for the last one)
        if i < total:
            logger.info("Waiting %ds before next request...", delay_seconds)
            time.sleep(delay_seconds)

    logger.info(
        "Backfill complete: %d/%d succeeded, %d failed",
        success_count, total, fail_count
    )


def process_one():
    """Process just one cluster (for testing)."""
    clusters = get_all_incomplete_clusters()

    if not clusters:
        logger.info("✓ All clusters already have tiers assigned!")
        return

    row = clusters[0]
    cluster_id = row["cluster_id"]
    oz_score = row["oz_score"]

    logger.info("Processing 1 of %d remaining clusters", len(clusters))
    process_cluster(cluster_id, oz_score)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Backfill tiers and AI summaries")
    parser.add_argument(
        "--one",
        action="store_true",
        help="Process just one cluster and exit (useful for testing or manual control)"
    )
    parser.add_argument(
        "--delay",
        type=int,
        default=2,
        help="Delay in seconds between requests (default: 2)"
    )
    args = parser.parse_args()

    if args.one:
        process_one()
    else:
        backfill_all(delay_seconds=args.delay)
