"""
Python dedup — replaces backend/src/dedup/dedup.service.ts
Two passes:
  1. Hash-based: articles with same dedup_hash within 48h → keep highest authority
  2. Title Jaccard: title word similarity > 0.85 within 6h → keep highest authority
"""

import re
import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta

from db import get_connection, dict_cursor

logger = logging.getLogger(__name__)

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
    intersection = len(a & b)
    union = len(a | b)
    return intersection / union if union else 0.0


# ── Pass 1: Hash dedup ────────────────────────────────────────────────────────

def _hash_dedup(articles: list) -> int:
    """
    Group articles by dedup_hash.  For each group with >1 member, keep the
    highest-authority article; mark the rest by clearing their cluster_id
    (signals they are duplicates and should not be clustered/scored).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    dup_count = 0

    # Group by hash
    hash_groups: dict[str, list] = defaultdict(list)
    for a in articles:
        if a.get("dedup_hash"):
            hash_groups[a["dedup_hash"]].append(a)

    conn = get_connection()
    try:
        for hash_val, group in hash_groups.items():
            # Also fetch older articles with same hash within 48h window
            with dict_cursor(conn) as cur:
                group_ids = [a["id"] for a in group]
                cur.execute(
                    """
                    SELECT id, source_authority FROM articles
                    WHERE dedup_hash = %s
                      AND created_at >= %s
                      AND id != ALL(%s)
                    """,
                    (hash_val, cutoff, group_ids),
                )
                older = cur.fetchall()

            all_matches = [
                {"id": a["id"], "source_authority": a["source_authority"]}
                for a in group
            ] + [dict(r) for r in older]

            if len(all_matches) <= 1:
                continue

            all_matches.sort(key=lambda x: x["source_authority"], reverse=True)
            dupe_ids = [a["id"] for a in all_matches[1:]]

            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE articles SET cluster_id = NULL WHERE id = ANY(%s)",
                    (dupe_ids,),
                )
            dup_count += len(dupe_ids)
            logger.debug(
                "Hash dedup: kept %s, marked %d duplicate(s) for hash '%s'",
                all_matches[0]["id"], len(dupe_ids), hash_val[:40],
            )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return dup_count


# ── Pass 2: Title similarity dedup ────────────────────────────────────────────

def _title_similarity_dedup(articles: list) -> int:
    SIX_HOURS = timedelta(hours=6)
    THRESHOLD = 0.85
    marked_as_dupe: set[str] = set()
    dup_count = 0

    # Pre-compute word sets
    word_sets = {a["id"]: _title_to_word_set(a["title"] or "") for a in articles}

    def published(a):
        v = a.get("published_at")
        if v is None:
            return None
        if isinstance(v, datetime):
            return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v
        return None

    conn = get_connection()
    try:
        for i, a in enumerate(articles):
            if a["id"] in marked_as_dupe:
                continue
            pub_a = published(a)

            for j in range(i + 1, len(articles)):
                b = articles[j]
                if b["id"] in marked_as_dupe:
                    continue

                # Time window
                pub_b = published(b)
                if pub_a and pub_b:
                    if abs((pub_a - pub_b).total_seconds()) > SIX_HOURS.total_seconds():
                        continue

                sim = _jaccard(word_sets[a["id"]], word_sets[b["id"]])
                if sim > THRESHOLD:
                    dupe = b if a["source_authority"] >= b["source_authority"] else a
                    marked_as_dupe.add(dupe["id"])
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE articles SET cluster_id = NULL WHERE id = %s",
                            (dupe["id"],),
                        )
                    dup_count += 1
                    logger.debug(
                        "Title dedup: sim=%.2f between '%s' and '%s'",
                        sim, (a["title"] or "")[:50], (b["title"] or "")[:50],
                    )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return dup_count


# ── Public API ────────────────────────────────────────────────────────────────

def run_dedup() -> dict:
    """Run both dedup passes on articles from the last 2 hours."""
    two_hours_ago = datetime.now(timezone.utc) - timedelta(hours=2)

    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT id, title, dedup_hash, source_authority, published_at
                FROM articles
                WHERE processed = true AND created_at >= %s
                ORDER BY source_authority DESC
                """,
                (two_hours_ago,),
            )
            recent = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

    if not recent:
        logger.info("No recent processed articles to deduplicate")
        return {"hash_dups": 0, "title_dups": 0}

    logger.info("Running dedup on %d article(s)", len(recent))
    hash_dups = _hash_dedup(recent)
    title_dups = _title_similarity_dedup(recent)
    logger.info("Dedup complete: %d hash dup(s), %d title dup(s)", hash_dups, title_dups)
    return {"hash_dups": hash_dups, "title_dups": title_dups}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    result = run_dedup()
    print(result)
