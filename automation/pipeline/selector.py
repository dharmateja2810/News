"""
Category-based story selector — picks ~105 clusters from all active clusters
using per-category quotas, then assigns tiers with fixed counts (22/42/41).

Pipeline step: runs after ozscore, before summarisation and content generation.

Usage:
    python selector.py              # run standalone
    python run_pipeline.py --select # run as pipeline stage
"""

import logging

from db import get_connection, dict_cursor, release_connection

logger = logging.getLogger(__name__)

# ── Category quotas ───────────────────────────────────────────────────────────
# How many stories to select per category (total = 105)

CATEGORY_QUOTAS = {
    "Business & Companies": 25,
    "Markets & Economy": 20,
    "Politics & Policy": 20,
    "World News": 15,
    "Tech & Innovation": 10,
    "Property & Housing": 10,
    "Lifestyle": 5,
}

# Map normaliser categories to quota categories.
# Employment & Wages is grouped with Property & Housing (cost-of-living adjacent).
CATEGORY_MAP = {
    "Business & Companies": "Business & Companies",
    "Markets & Economy": "Markets & Economy",
    "Politics & Policy": "Politics & Policy",
    "World News": "World News",
    "Tech & Innovation": "Tech & Innovation",
    "Property & Housing": "Property & Housing",
    "Employment & Wages": "Property & Housing",
    "Lifestyle": "Lifestyle",
}

# ── Tier counts (fixed) ──────────────────────────────────────────────────────

TIER_1_COUNT = 22
TIER_2_COUNT = 42
TIER_3_COUNT = 41
TOTAL_TARGET = TIER_1_COUNT + TIER_2_COUNT + TIER_3_COUNT  # 105


# ── Public API ────────────────────────────────────────────────────────────────

def select_stories() -> dict:
    """
    Select ~105 clusters using category quotas and assign tiers.

    1. Fetch all active clusters that have no cluster_content yet.
    2. For each category, take the top-N clusters by OzScore.
    3. If a category has fewer clusters than its quota, redistribute
       the unused slots to the next-highest scoring clusters globally.
    4. Sort the selected clusters by OzScore and assign tiers:
       Top 22 → Tier 1, Next 42 → Tier 2, Next 41 → Tier 3.
    5. Write the tier to story_clusters.

    Returns: {"selected": int, "tiers": {1: N, 2: N, 3: N}}
    """
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT sc.id, sc.category, sc.oz_score
                FROM story_clusters sc
                LEFT JOIN cluster_content cc ON cc.cluster_id = sc.id
                WHERE sc.status = 'active'
                  AND cc.id IS NULL
                ORDER BY sc.oz_score DESC
                """,
            )
            clusters = [dict(r) for r in cur.fetchall()]
    finally:
        release_connection(conn)

    if not clusters:
        logger.info("No unprocessed active clusters to select from")
        return {"selected": 0, "tiers": {1: 0, 2: 0, 3: 0}}

    logger.info("Selecting from %d unprocessed clusters", len(clusters))

    # ── Group by quota category ───────────────────────────────────────────
    by_category: dict[str, list] = {}
    for c in clusters:
        raw_cat = c.get("category") or "Business & Companies"
        quota_cat = CATEGORY_MAP.get(raw_cat, "Business & Companies")
        by_category.setdefault(quota_cat, []).append(c)

    # ── Select top-N per category ─────────────────────────────────────────
    selected_ids: set[str] = set()
    selected: list[dict] = []
    remaining_slots = 0

    for cat, quota in CATEGORY_QUOTAS.items():
        cat_clusters = by_category.get(cat, [])
        # Already sorted by oz_score DESC from the query
        picked = cat_clusters[:quota]
        for c in picked:
            selected_ids.add(c["id"])
            selected.append(c)
        shortfall = quota - len(picked)
        if shortfall > 0:
            remaining_slots += shortfall
            logger.info(
                "Category '%s': %d/%d selected (shortfall: %d)",
                cat, len(picked), quota, shortfall,
            )
        else:
            logger.info("Category '%s': %d/%d selected", cat, len(picked), quota)

    # ── Fill remaining slots from global pool ─────────────────────────────
    if remaining_slots > 0:
        overflow = [c for c in clusters if c["id"] not in selected_ids]
        filled = overflow[:remaining_slots]
        for c in filled:
            selected_ids.add(c["id"])
            selected.append(c)
        logger.info(
            "Filled %d overflow slot(s) from global pool",
            len(filled),
        )

    # ── Sort by OzScore and assign tiers ──────────────────────────────────
    selected.sort(key=lambda c: c.get("oz_score", 0), reverse=True)

    for i, c in enumerate(selected):
        if i < TIER_1_COUNT:
            c["tier"] = 1
        elif i < TIER_1_COUNT + TIER_2_COUNT:
            c["tier"] = 2
        else:
            c["tier"] = 3

    # ── Write tiers to DB ─────────────────────────────────────────────────
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            for c in selected:
                cur.execute(
                    "UPDATE story_clusters SET tier = %s WHERE id = %s",
                    (c["tier"], c["id"]),
                )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        release_connection(conn)

    tier_counts = {1: 0, 2: 0, 3: 0}
    for c in selected:
        tier_counts[c["tier"]] += 1

    logger.info(
        "Selection complete: %d selected (T1=%d, T2=%d, T3=%d)",
        len(selected), tier_counts[1], tier_counts[2], tier_counts[3],
    )
    return {"selected": len(selected), "tiers": tier_counts}


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    )
    from db import close_pool

    try:
        select_stories()
    finally:
        close_pool()
