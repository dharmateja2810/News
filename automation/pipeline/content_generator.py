"""
Content generator — assigns tiers to unprocessed clusters and generates
AI content (headline, summary, why-it-matters, double-click) via explainer.

Pipeline step: runs after ozscore, before the feed is served.

Usage:
    python content_generator.py [--limit N]
"""

import argparse
import logging
import math

from db import get_connection, dict_cursor, release_connection, close_pool
from explainer import generate_for_cluster

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_unprocessed_clusters(limit: int = 100) -> list:
    """
    Return active clusters that have no cluster_content yet,
    ordered by oz_score descending.
    """
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT sc.id, sc.oz_score, sc.topic, sc.category
                FROM story_clusters sc
                LEFT JOIN cluster_content cc ON cc.cluster_id = sc.id
                WHERE sc.status = 'active'
                  AND cc.id IS NULL
                ORDER BY sc.oz_score DESC
                LIMIT %s
                """,
                (limit,),
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        release_connection(conn)


def _assign_tiers(clusters: list) -> list:
    """
    Assign tiers based on percentile position:
      Top 25%    → Tier 1
      Next 35%   → Tier 2
      Bottom 40% → Tier 3
    Clusters are assumed to be sorted by oz_score DESC.
    """
    n = len(clusters)
    if n == 0:
        return clusters

    t1_cutoff = max(1, math.ceil(n * 0.25))
    t2_cutoff = max(t1_cutoff + 1, math.ceil(n * 0.60))

    for i, c in enumerate(clusters):
        if i < t1_cutoff:
            c["tier"] = 1
        elif i < t2_cutoff:
            c["tier"] = 2
        else:
            c["tier"] = 3

    tier_counts = {1: 0, 2: 0, 3: 0}
    for c in clusters:
        tier_counts[c["tier"]] += 1
    logger.info(
        "Tier assignment: T1=%d, T2=%d, T3=%d (total %d)",
        tier_counts[1], tier_counts[2], tier_counts[3], n,
    )
    return clusters


def _write_cluster_content(cluster_id: str, tier: int, result: dict) -> None:
    """
    Upsert a row into cluster_content and update the tier on story_clusters.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO cluster_content
                    (cluster_id, headline, summary, why_it_matters, double_click, tier, status)
                VALUES (%s, %s, %s, %s, %s, %s, 'pending')
                ON CONFLICT (cluster_id) DO UPDATE SET
                    headline      = EXCLUDED.headline,
                    summary       = EXCLUDED.summary,
                    why_it_matters = EXCLUDED.why_it_matters,
                    double_click  = EXCLUDED.double_click,
                    tier          = EXCLUDED.tier,
                    status        = 'pending',
                    updated_at    = NOW()
                """,
                (
                    cluster_id,
                    result["headline"],
                    result["card_summary"],
                    result["why_it_matters"],
                    result["explainer_body"],
                    tier,
                ),
            )
            cur.execute(
                "UPDATE story_clusters SET tier = %s WHERE id = %s",
                (tier, cluster_id),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        release_connection(conn)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def generate_content(limit: int = 100) -> int:
    """
    Fetch unprocessed clusters, assign tiers, generate AI content
    sequentially, and write to cluster_content.

    Returns the number of clusters processed.
    """
    clusters = _get_unprocessed_clusters(limit)
    if not clusters:
        logger.info("No unprocessed clusters found")
        return 0

    clusters = _assign_tiers(clusters)
    processed = 0

    for c in clusters:
        cluster_id = c["id"]
        tier = c["tier"]
        try:
            logger.info(
                "Generating content for cluster %s [tier %d] (oz=%.3f, topic=%s)",
                cluster_id, tier, float(c.get("oz_score") or 0), c.get("topic", "?"),
            )
            result = generate_for_cluster(cluster_id, tier)

            if result.get("should_reject"):
                logger.warning(
                    "Cluster %s rejected by guardrails: %s",
                    cluster_id, result.get("guardrail_flags"),
                )
                continue

            _write_cluster_content(cluster_id, tier, result)
            processed += 1
            logger.info("Cluster %s content saved (tier %d)", cluster_id, tier)

        except Exception as exc:
            logger.error("Failed cluster %s: %s", cluster_id, exc, exc_info=True)

    logger.info("Content generation complete: %d/%d processed", processed, len(clusters))
    return processed


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate content for unprocessed clusters")
    parser.add_argument("--limit", type=int, default=100, help="Max clusters to process")
    args = parser.parse_args()

    try:
        generate_content(limit=args.limit)
    finally:
        close_pool()
