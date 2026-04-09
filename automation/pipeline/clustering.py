"""
Python clustering — replaces backend/src/clustering/clustering.service.ts

Algorithm:
- For each unassigned processed article:
  - Try to find an existing active cluster where at least one member has:
    * Jaccard title similarity > 0.4
    * At least 1 shared entity
    * Published within 24h of the candidate article
  - If match found → assign to best matching cluster
  - Otherwise → create new cluster seeded by this article
- Recalculate cluster metadata after all assignments
- Archive clusters last updated >48h ago
"""

import re
import uuid
import json
import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

from db import get_connection, dict_cursor

logger = logging.getLogger(__name__)

NEWSWIRE_SOURCES = {"reuters", "aap", "bloomberg"}

STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "is", "are", "was", "were", "be", "been", "has",
    "have", "had", "it", "its", "as", "from", "that", "this", "not", "will",
    "can", "do", "does", "did", "no", "so", "if", "up",
}


def _title_to_word_set(title: str) -> frozenset:
    words = re.sub(r"[^\w\s]", "", title.lower()).split()
    return frozenset(w for w in words if len(w) > 1 and w not in STOP_WORDS)


def _jaccard(a: frozenset, b: frozenset) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _parse_entities(raw) -> dict:
    if raw is None:
        return {"orgs": [], "gpes": [], "persons": []}
    if isinstance(raw, dict):
        return {
            "orgs": raw.get("orgs") or [],
            "gpes": raw.get("gpes") or [],
            "persons": raw.get("persons") or [],
        }
    if isinstance(raw, str):
        try:
            d = json.loads(raw)
            return {
                "orgs": d.get("orgs") or [],
                "gpes": d.get("gpes") or [],
                "persons": d.get("persons") or [],
            }
        except Exception:
            pass
    return {"orgs": [], "gpes": [], "persons": []}


def _count_shared_entities(a: dict, b: dict) -> int:
    def normalise(lst):
        return {s.lower().strip() for s in lst if s}

    set_a = normalise(a["orgs"]) | normalise(a["gpes"]) | normalise(a["persons"])
    all_b = normalise(b["orgs"]) | normalise(b["gpes"]) | normalise(b["persons"])
    return len(set_a & all_b)


def _to_utc(d) -> Optional[datetime]:
    if d is None:
        return None
    if isinstance(d, datetime):
        return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d
    return None


def _calculate_cluster_quality(
    unique_source_count: int,
    opinion_count: int,
    article_count: int,
    paywall_count: int,
    unique_sources: set,
) -> float:
    source_diversity = min(unique_source_count / 5, 1.0)
    non_opinion_ratio = (article_count - opinion_count) / article_count if article_count else 1.0
    non_paywalled_ratio = (article_count - paywall_count) / article_count if article_count else 1.0
    has_newswire = 1.0 if any(s in unique_sources for s in NEWSWIRE_SOURCES) else 0.0
    return (
        source_diversity * 0.35
        + non_opinion_ratio * 0.30
        + non_paywalled_ratio * 0.20
        + has_newswire * 0.15
    )


# ── DB helpers ────────────────────────────────────────────────────────────────

def _create_cluster(conn, article: dict) -> str:
    cluster_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    first_seen = _to_utc(article.get("published_at")) or now

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO story_clusters
              (id, topic, category, first_seen_at, last_updated_at, article_count,
               unique_source_count, status)
            VALUES (%s, %s, %s, %s, %s, 1, 1, 'active')
            """,
            (cluster_id, article["title"], article.get("category", "Business"), first_seen, now),
        )
        cur.execute(
            "UPDATE articles SET cluster_id = %s WHERE id = %s",
            (cluster_id, article["id"]),
        )
        cur.execute(
            """
            INSERT INTO cluster_articles (cluster_id, article_id, is_primary)
            VALUES (%s, %s, true)
            ON CONFLICT (cluster_id, article_id) DO NOTHING
            """,
            (cluster_id, article["id"]),
        )

    logger.debug("Created cluster %s for '%s'", cluster_id, (article["title"] or "")[:60])
    return cluster_id


def _assign_to_cluster(conn, article_id: str, cluster_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE articles SET cluster_id = %s WHERE id = %s",
            (cluster_id, article_id),
        )
        cur.execute(
            """
            INSERT INTO cluster_articles (cluster_id, article_id, is_primary)
            VALUES (%s, %s, false)
            ON CONFLICT (cluster_id, article_id) DO NOTHING
            """,
            (cluster_id, article_id),
        )


def _update_cluster_metadata(conn, cluster_id: str) -> None:
    with dict_cursor(conn) as cur:
        cur.execute(
            """
            SELECT id, source, source_authority, is_opinion, is_paywalled, category, published_at
            FROM articles WHERE cluster_id = %s
            """,
            (cluster_id,),
        )
        articles = [dict(r) for r in cur.fetchall()]

    if not articles:
        return

    unique_sources = {a["source"].lower() for a in articles}
    article_count = len(articles)
    unique_source_count = len(unique_sources)
    opinion_count = sum(1 for a in articles if a.get("is_opinion"))
    paywall_count = sum(1 for a in articles if a.get("is_paywalled"))
    has_paywalled = paywall_count > 0
    opinion_ratio = opinion_count / article_count if article_count else 0.0

    # Most common category
    cat_counts: dict[str, int] = defaultdict(int)
    for a in articles:
        cat_counts[a.get("category") or "Business"] += 1
    top_category = max(cat_counts, key=cat_counts.get)

    cluster_quality = _calculate_cluster_quality(
        unique_source_count, opinion_count, article_count, paywall_count, unique_sources
    )

    # Primary article: highest authority, non-opinion, non-paywalled
    candidates = [a for a in articles if not a.get("is_opinion") and not a.get("is_paywalled")]
    if not candidates:
        candidates = articles
    primary = max(candidates, key=lambda a: a.get("source_authority", 0))

    with conn.cursor() as cur:
        cur.execute(
            "UPDATE cluster_articles SET is_primary = false WHERE cluster_id = %s",
            (cluster_id,),
        )
        cur.execute(
            "UPDATE cluster_articles SET is_primary = true WHERE cluster_id = %s AND article_id = %s",
            (cluster_id, primary["id"]),
        )
        cur.execute(
            """
            UPDATE story_clusters SET
              article_count = %s,
              unique_source_count = %s,
              has_paywalled = %s,
              opinion_ratio = %s,
              category = %s,
              cluster_quality = %s,
              last_updated_at = NOW()
            WHERE id = %s
            """,
            (
                article_count, unique_source_count, has_paywalled, opinion_ratio,
                top_category, cluster_quality, cluster_id,
            ),
        )


# ── Public API ────────────────────────────────────────────────────────────────

def run_clustering() -> dict:
    """Main clustering pass. Returns {assigned, new_clusters}."""
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT id, title, category, entities, published_at,
                       source, source_authority, is_opinion, is_paywalled
                FROM articles
                WHERE processed = true AND cluster_id IS NULL
                ORDER BY published_at DESC
                """
            )
            unassigned = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

    if not unassigned:
        logger.info("No unassigned articles to cluster")
        return {"assigned": 0, "new_clusters": 0}

    logger.info("Clustering %d unassigned article(s)", len(unassigned))

    # Load active clusters with their articles
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT sc.id as cluster_id,
                       a.id, a.title, a.entities, a.published_at,
                       a.source, a.source_authority, a.is_opinion, a.is_paywalled, a.category
                FROM story_clusters sc
                JOIN articles a ON a.cluster_id = sc.id
                WHERE sc.status = 'active'
                """
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    # Build cluster -> [articles] map
    cluster_articles: dict[str, list] = defaultdict(list)
    for row in rows:
        r = dict(row)
        cid = r.pop("cluster_id")
        cluster_articles[cid].append(r)

    assigned = 0
    new_clusters = 0
    affected_cluster_ids: set[str] = set()

    conn = get_connection()
    try:
        for article in unassigned:
            art_words = _title_to_word_set(article["title"] or "")
            art_entities = _parse_entities(article.get("entities"))
            art_pub = _to_utc(article.get("published_at"))

            best_cluster_id: Optional[str] = None
            best_score = 0.0

            for cid, members in cluster_articles.items():
                for member in members:
                    mem_pub = _to_utc(member.get("published_at"))

                    # Time window: 24h
                    if art_pub and mem_pub:
                        if abs((art_pub - mem_pub).total_seconds()) > 86400:
                            continue

                    sim = _jaccard(art_words, _title_to_word_set(member["title"] or ""))
                    if sim <= 0.4:
                        continue

                    shared = _count_shared_entities(art_entities, _parse_entities(member.get("entities")))
                    if shared < 1:
                        continue

                    if sim > best_score:
                        best_score = sim
                        best_cluster_id = cid

            if best_cluster_id:
                _assign_to_cluster(conn, article["id"], best_cluster_id)
                cluster_articles[best_cluster_id].append(article)
                affected_cluster_ids.add(best_cluster_id)
                assigned += 1
            else:
                new_cid = _create_cluster(conn, article)
                cluster_articles[new_cid] = [article]
                affected_cluster_ids.add(new_cid)
                assigned += 1
                new_clusters += 1

        conn.commit()

        # Update metadata for affected clusters
        for cid in affected_cluster_ids:
            try:
                _update_cluster_metadata(conn, cid)
            except Exception as exc:
                logger.error("Failed to update metadata for cluster %s: %s", cid, exc)
        conn.commit()

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    logger.info("Clustering complete: %d assigned, %d new cluster(s)", assigned, new_clusters)
    return {"assigned": assigned, "new_clusters": new_clusters}


def archive_old_clusters() -> int:
    """Set status='archived' for active clusters last updated >48h ago."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE story_clusters
                SET status = 'archived'
                WHERE status = 'active' AND last_updated_at < %s
                """,
                (cutoff,),
            )
            count = cur.rowcount
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    if count:
        logger.info("Archived %d cluster(s) older than 48h", count)
    return count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    result = run_clustering()
    archived = archive_old_clusters()
    print(f"Clustered: {result}, Archived: {archived}")
