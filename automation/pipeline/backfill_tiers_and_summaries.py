#!/usr/bin/env python3
"""
Backfill script to assign tiers and generate AI content for story clusters.
- Finds story_clusters with tier = NULL
- Derives tier from oz_score (>=0.7 → T1, >=0.4 → T2, else T3)
- Generates AI content (headline, summary, why_it_matters for T1, explainer for T1)
- Updates story_clusters.tier
- If editor_queue entry exists, also updates AI content there

Processes one cluster per run to avoid rate limiting.
Run repeatedly or use --delay flag to process all clusters.
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


def find_next_incomplete_cluster():
    """Find one cluster that needs tier assignment."""
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            # Find active clusters with NULL tier
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
                LIMIT 1
                """,
            )
            return cur.fetchone()
    finally:
        conn.close()


def update_cluster_tier_and_queue(cluster_id: str, result: dict) -> None:
    """Write tier to story_clusters and AI content to editor_queue if entry exists."""
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

            # If editor_queue entry exists for this cluster, update it too
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


def process_one():
    """Process one incomplete cluster."""
    row = find_next_incomplete_cluster()

    if not row:
        logger.info("✓ All clusters have tiers assigned!")
        return False

    cluster_id = row["cluster_id"]
    current_tier = row["tier"]
    oz_score = row["oz_score"]

    logger.info(
        "Processing cluster=%s (tier=%s, oz_score=%.3f)",
        cluster_id, current_tier, oz_score
    )

    try:
        # Generate AI content (this also derives tier if missing)
        result = generate_for_cluster(cluster_id)

        # Update database
        update_cluster_tier_and_queue(cluster_id, result)

        logger.info(
            "✓ Done: tier=%d, headline=%s, summary=%d chars, why_matters=%d chars, double_click=%d chars",
            result["tier"],
            result["headline"][:50] + "..." if len(result["headline"]) > 50 else result["headline"],
            len(result["card_summary"]),
            len(result["why_it_matters"]),
            len(result["explainer_body"]),
        )
        return True

    except Exception as exc:
        logger.error("Failed to process cluster %s: %s", cluster_id, exc)
        return True  # Continue processing other clusters


def backfill_all(delay_seconds: int = 2):
    """Process all incomplete clusters with delay between each."""
    logger.info("Starting backfill (delay=%ds between requests)...", delay_seconds)

    count = 0
    while True:
        has_more = process_one()
        if not has_more:
            break

        count += 1
        logger.info("Processed %d clusters. Waiting %ds before next...", count, delay_seconds)
        time.sleep(delay_seconds)

    logger.info("Backfill complete: %d clusters processed", count)


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
