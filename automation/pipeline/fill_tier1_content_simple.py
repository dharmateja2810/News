#!/usr/bin/env python3
"""
Simple Tier 1 content generator.

Process strategy:
- Direct connections (no pooling) - create fresh, use, close immediately
- One cluster at a time, sequential processing
- Simple error handling with retry on transient failures
"""
import logging
import time
import uuid
import os
import re
import psycopg2
import psycopg2.extras
from datetime import date
from explainer import generate_for_cluster

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def get_direct_connection():
    """Get a fresh direct connection (no pooling)."""
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set")
    db_url = re.sub(r"^postgres://", "postgresql://", db_url)
    return psycopg2.connect(db_url, connect_timeout=10)


def dict_cursor(conn):
    """Return DictCursor."""
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def get_tier1_cluster_ids():
    """Fetch list of Tier 1 cluster IDs once at startup."""
    logger.info("Fetching Tier 1 clusters...")
    conn = get_connection(max_retries=2)
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT id as cluster_id, category
                FROM story_clusters
                WHERE status = 'active' AND tier = 1
                ORDER BY oz_score DESC
                """,
            )
            rows = cur.fetchall()
            return [(r["cluster_id"], r["category"]) for r in rows]
    finally:
        conn.close()


def create_editor_queue_entry(cluster_id: str) -> None:
    """Create editor_queue entry with UUID if it doesn't exist."""
    conn = get_connection(max_retries=2)
    try:
        # Check if exists
        with dict_cursor(conn) as cur:
            cur.execute("SELECT id FROM editor_queue WHERE cluster_id = %s", (cluster_id,))
            if cur.fetchone():
                logger.info(f"    Queue entry exists")
                return

        # Create with UUID
        queue_id = str(uuid.uuid4())
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO editor_queue (id, cluster_id, edition, edition_date, status, suggested_rank)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (queue_id, cluster_id, "morning", date.today(), "pending", 999),
            )
        conn.commit()
        logger.info(f"    Created queue entry")
    finally:
        conn.close()


def update_queue_content(cluster_id: str, result: dict) -> None:
    """Update queue entry with AI content."""
    conn = get_connection(max_retries=2)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE editor_queue
                SET ai_headline = %s, ai_summary = %s, ai_why_matters = %s, ai_double_click = %s
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
        logger.info(f"    Updated: headline={len(result['headline'])} chars, summary={len(result['card_summary'])} chars")
    finally:
        conn.close()


def process_cluster(cluster_id: str, category: str, max_retries: int = 2) -> bool:
    """Process a single cluster with retry logic for transient errors."""
    for attempt in range(max_retries):
        try:
            logger.info(f"  Step 1: Create queue entry...")
            create_editor_queue_entry(cluster_id)

            logger.info(f"  Step 2: Generate AI content...")
            result = generate_for_cluster(cluster_id)

            if result["tier"] != 1:
                logger.warning(f"  Cluster recalculated as Tier {result['tier']}, skipping")
                return False

            logger.info(f"  Step 3: Update queue...")
            update_queue_content(cluster_id, result)

            logger.info(f"  ✓ Success")
            return True

        except Exception as e:
            error_msg = str(e).lower()
            # Retry on transient errors
            if attempt < max_retries - 1 and ("pool" in error_msg or "timeout" in error_msg or "temporarily" in error_msg):
                wait = 5 * (attempt + 1)
                logger.warning(f"  Transient error (retry {attempt + 1}/{max_retries}), waiting {wait}s...")
                time.sleep(wait)
                continue

            logger.error(f"  ✗ Failed: {str(e)[:100]}")
            return False

    return False


def main():
    logger.info("=" * 70)
    logger.info("TIER 1 CONTENT GENERATOR (Simple Single-Connection Approach)")
    logger.info("=" * 70)

    # Get all Tier 1 clusters once
    clusters = get_tier1_cluster_ids()
    if not clusters:
        logger.info("No Tier 1 clusters found")
        return

    logger.info(f"Found {len(clusters)} Tier 1 clusters\n")

    success_count = 0
    for i, (cluster_id, category) in enumerate(clusters, 1):
        logger.info(f"[{i}/{len(clusters)}] {cluster_id} (category={category})")
        if process_cluster(cluster_id, category):
            success_count += 1

        # Delay between clusters to respect OpenAI rate limits
        if i < len(clusters):
            logger.info(f"  Waiting 3s before next...\n")
            time.sleep(3)

    logger.info("\n" + "=" * 70)
    logger.info(f"COMPLETE: {success_count}/{len(clusters)} succeeded")
    logger.info("=" * 70)


if __name__ == "__main__":
    main()
