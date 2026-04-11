"""
Breaking news detector — scans active clusters every 5 minutes for breaking
thresholds and auto-defers stale queue items.

Thresholds (mirrors NestJS BreakingService):
  oz_score         >= 0.82
  impact_score     >= 0.88
  unique_source_count >= 3
  cluster_quality  >= 0.6
  Daily cap: 3 breaking cards

Public API:
  run_breaking()              → runs detection + auto-defer
  run_breaking_detection()    → mark breaking clusters, create editor_queue entries
  run_auto_defer()            → defer stale pending breaking items after 15 min
"""

import logging
import uuid
from datetime import date, datetime, timezone

from db import get_connection, dict_cursor
from explainer import generate_for_cluster

logger = logging.getLogger(__name__)

OZ_SCORE_THRESHOLD   = 0.82
IMPACT_THRESHOLD     = 0.88
MIN_SOURCES          = 3
MIN_QUALITY          = 0.6
DAILY_CAP            = 3
AUTO_DEFER_MINUTES   = 15


def run_breaking_detection() -> int:
    """
    Find clusters that cross breaking thresholds, mark them, generate AI content,
    and create editor_queue entries with edition='breaking'.
    Returns the number of new breaking items created.
    """
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    conn = get_connection()
    try:
        # Daily cap check
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT COUNT(*) AS cnt
                FROM story_clusters
                WHERE is_breaking = true
                  AND breaking_fired_at >= %s
                """,
                (today_start,),
            )
            today_count = cur.fetchone()["cnt"]

        if today_count >= DAILY_CAP:
            logger.info("Daily breaking cap reached (%d/%d)", today_count, DAILY_CAP)
            return 0

        remaining = DAILY_CAP - today_count

        # Find candidates
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT id, topic, oz_score, impact_score
                FROM story_clusters
                WHERE status = 'active'
                  AND is_breaking = false
                  AND oz_score     >= %s
                  AND impact_score >= %s
                  AND unique_source_count >= %s
                  AND cluster_quality     >= %s
                ORDER BY oz_score DESC
                LIMIT %s
                """,
                (OZ_SCORE_THRESHOLD, IMPACT_THRESHOLD, MIN_SOURCES, MIN_QUALITY, remaining),
            )
            candidates = cur.fetchall()
    finally:
        conn.close()

    if not candidates:
        logger.info("No breaking candidates found")
        return 0

    created = 0
    for cluster in candidates:
        cluster_id = cluster["id"]

        # Skip if already published today
        conn2 = get_connection()
        try:
            with dict_cursor(conn2) as cur:
                cur.execute(
                    """
                    SELECT id FROM published_stories
                    WHERE cluster_id = %s
                      AND published_at >= %s
                    LIMIT 1
                    """,
                    (cluster_id, today_start),
                )
                if cur.fetchone():
                    logger.info("Cluster %s already published today, skipping", cluster_id)
                    continue

            # Mark as breaking
            with conn2.cursor() as cur:
                cur.execute(
                    """
                    UPDATE story_clusters
                    SET is_breaking = true, breaking_fired_at = NOW()
                    WHERE id = %s
                    """,
                    (cluster_id,),
                )
            conn2.commit()
        except Exception:
            conn2.rollback()
            conn2.close()
            raise
        finally:
            conn2.close()

        logger.warning(
            "BREAKING: cluster %s (%s) — oz=%.2f impact=%.2f",
            cluster_id, cluster.get("topic"), cluster["oz_score"], cluster["impact_score"] or 0,
        )

        # Generate AI content
        try:
            result = generate_for_cluster(cluster_id)
        except Exception as exc:
            logger.error("AI generation failed for cluster %s: %s", cluster_id, exc)
            continue

        # Create editor_queue entry
        conn3 = get_connection()
        try:
            with conn3.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO editor_queue
                      (id, cluster_id, edition, edition_date, suggested_rank,
                       ai_headline, ai_summary, ai_why_matters, ai_double_click,
                       status, created_at)
                    VALUES (%s, %s, 'breaking', %s, 1, %s, %s, %s, %s, 'pending', NOW())
                    ON CONFLICT DO NOTHING
                    """,
                    (
                        str(uuid.uuid4()),
                        cluster_id,
                        date.today(),
                        result["headline"],
                        result["card_summary"],
                        result["why_it_matters"],
                        result["explainer_body"],
                    ),
                )
            conn3.commit()
            logger.info("Breaking queue entry created for cluster %s", cluster_id)
            created += 1
        except Exception as exc:
            conn3.rollback()
            logger.error("Failed to create queue entry for cluster %s: %s", cluster_id, exc)
        finally:
            conn3.close()

    return created


def run_auto_defer() -> int:
    """
    Defer pending breaking queue items that have had no editor action
    for more than AUTO_DEFER_MINUTES minutes.
    Returns the number of items deferred.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE editor_queue
                SET status = 'deferred', reviewed_at = NOW()
                WHERE edition = 'breaking'
                  AND status  = 'pending'
                  AND created_at < NOW() - INTERVAL '%s minutes'
                """,
                (AUTO_DEFER_MINUTES,),
            )
            count = cur.rowcount
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    if count:
        logger.warning("Auto-deferred %d stale breaking queue item(s)", count)
    return count


def run_breaking() -> dict:
    """Entry point: run detection then auto-defer."""
    created  = run_breaking_detection()
    deferred = run_auto_defer()
    return {"breaking_created": created, "deferred": deferred}
