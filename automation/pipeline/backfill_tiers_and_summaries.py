#!/usr/bin/env python3
"""
Backfill script to process clusters one at a time.
- Assigns tier if missing
- Generates AI content if missing
Processes one cluster per run to avoid rate limiting.
Run this repeatedly (e.g., in a loop with delays) to process all clusters.
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
    """Find one cluster that needs processing."""
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            # Find clusters in editor_queue that are missing AI content OR tier
            cur.execute(
                """
                SELECT eq.id as queue_id,
                       eq.cluster_id,
                       sc.tier,
                       eq.ai_headline,
                       eq.ai_summary
                FROM editor_queue eq
                JOIN story_clusters sc ON sc.id = eq.cluster_id
                WHERE eq.ai_headline IS NULL
                   OR eq.ai_summary IS NULL
                   OR sc.tier IS NULL
                ORDER BY eq.created_at ASC
                LIMIT 1
                """,
            )
            return cur.fetchone()
    finally:
        conn.close()


def update_queue_and_tier(queue_id: str, result: dict) -> None:
    """Write AI content to editor_queue and tier to story_clusters."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE editor_queue
                SET ai_headline    = %s,
                    ai_summary     = %s,
                    ai_why_matters = %s,
                    ai_double_click = %s
                WHERE id = %s
                """,
                (
                    result["headline"],
                    result["card_summary"],
                    result["why_it_matters"],
                    result["explainer_body"],
                    queue_id,
                ),
            )
            # Write tier to story_clusters
            cur.execute(
                """
                UPDATE story_clusters
                SET tier = %s
                WHERE id = (SELECT cluster_id FROM editor_queue WHERE id = %s)
                """,
                (result["tier"], queue_id),
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
        logger.info("✓ All clusters processed!")
        return False

    queue_id = row["queue_id"]
    cluster_id = row["cluster_id"]
    current_tier = row["tier"]
    has_headline = row["ai_headline"] is not None
    has_summary = row["ai_summary"] is not None

    logger.info(
        "Processing queue_id=%s cluster=%s (tier=%s, has_headline=%s, has_summary=%s)",
        queue_id, cluster_id, current_tier, has_headline, has_summary
    )

    try:
        # Generate AI content (this also derives tier if missing)
        result = generate_for_cluster(cluster_id)

        # Update database
        update_queue_and_tier(queue_id, result)

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
