#!/usr/bin/env python3
"""
Fill AI content for Tier 1 clusters.

This script:
1. Finds all Tier 1 clusters
2. Creates editor_queue entries if they don't exist
3. Generates AI content (headline, summary, why_it_matters, double_click)
4. Updates the editor_queue with the AI content
"""
import logging
from datetime import date
from db import get_connection, dict_cursor 
from explainer import generate_for_cluster

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def get_tier1_clusters():
    """Get all active Tier 1 clusters."""
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT id as cluster_id,
                       tier,
                       oz_score,
                       category
                FROM story_clusters
                WHERE status = 'active'
                  AND tier = 1
                ORDER BY oz_score DESC
                """,
            )
            return cur.fetchall()
    finally:
        conn.close()


def ensure_editor_queue_entry(cluster_id: str, category: str) -> None:
    """Create editor_queue entry if it doesn't exist."""
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            # Check if entry exists
            cur.execute(
                """
                SELECT id FROM editor_queue
                WHERE cluster_id = %s
                """,
                (cluster_id,),
            )
            existing = cur.fetchone()

            if existing:
                logger.info(f"  Editor queue entry already exists for cluster {cluster_id}")
                return

            # Create new entry
            logger.info(f"  Creating editor_queue entry for cluster {cluster_id}")
            cur.execute(
                """
                INSERT INTO editor_queue
                    (cluster_id, edition, edition_date, status, suggested_rank)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    cluster_id,
                    "morning",  # Default to morning edition
                    date.today(),
                    "pending",
                    999,  # Low priority rank since we're backfilling
                ),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def update_editor_queue_ai_content(cluster_id: str, result: dict) -> None:
    """Update editor_queue with AI-generated content."""
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
                WHERE cluster_id = %s
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
        logger.info(
            f"  ✓ Updated: headline='{result['headline'][:40]}...', "
            f"summary={len(result['card_summary'])} chars, "
            f"why_matters={len(result['why_it_matters'])} chars, "
            f"double_click={len(result['explainer_body'])} chars"
        )
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def process_tier1_cluster(cluster_id: str, category: str) -> bool:
    """Process a single Tier 1 cluster."""
    logger.info(f"\nProcessing cluster {cluster_id} (category={category})")

    try:
        # Step 1: Ensure editor_queue entry exists
        ensure_editor_queue_entry(cluster_id, category)

        # Step 2: Generate AI content
        logger.info(f"  Generating AI content...")
        result = generate_for_cluster(cluster_id)

        # Verify it's actually Tier 1
        if result["tier"] != 1:
            logger.warning(
                f"  ⚠ Cluster {cluster_id} was recalculated as Tier {result['tier']}, skipping..."
            )
            return False

        # Step 3: Update editor_queue with AI content
        update_editor_queue_ai_content(cluster_id, result)

        logger.info(f"  ✓ Successfully processed cluster {cluster_id}")
        return True

    except Exception as exc:
        logger.error(f"  ✗ Failed to process cluster {cluster_id}: {exc}")
        return False


def main(limit: int = None, delay_seconds: int = 2):
    """
    Fill AI content for all Tier 1 clusters.

    Args:
        limit: Max number of clusters to process (None = all)
        delay_seconds: Delay between API calls
    """
    logger.info("=" * 70)
    logger.info("TIER 1 CONTENT GENERATOR")
    logger.info("=" * 70)

    # Get all Tier 1 clusters
    clusters = get_tier1_clusters()
    logger.info(f"\nFound {len(clusters)} Tier 1 clusters")

    if not clusters:
        logger.info("✓ No Tier 1 clusters to process!")
        return

    # Apply limit if specified
    if limit:
        clusters = clusters[:limit]
        logger.info(f"Processing first {limit} clusters only")

    # Process each cluster
    success_count = 0
    fail_count = 0

    for i, cluster in enumerate(clusters, 1):
        logger.info(f"\n[{i}/{len(clusters)}] " + "=" * 50)

        if process_tier1_cluster(cluster["cluster_id"], cluster["category"]):
            success_count += 1
        else:
            fail_count += 1

        # Delay between clusters (except last one)
        if i < len(clusters) and delay_seconds > 0:
            import time
            logger.info(f"  Waiting {delay_seconds}s before next cluster...")
            time.sleep(delay_seconds)

    # Summary
    logger.info("\n" + "=" * 70)
    logger.info("SUMMARY")
    logger.info("=" * 70)
    logger.info(f"Total processed: {len(clusters)}")
    logger.info(f"✓ Success: {success_count}")
    logger.info(f"✗ Failed: {fail_count}")
    logger.info("=" * 70)


if __name__ == "__main__":
    import sys

    # Optional: pass limit as command line arg
    # Usage: python3 fill_tier1_content.py [limit]
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None

    main(limit=limit, delay_seconds=2)