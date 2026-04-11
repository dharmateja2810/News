"""
Python OzScore — replaces backend/src/ozscore/ozscore.service.ts

8-signal weighted scoring formula + boosts + penalties.
Scores all active story_cluster rows and persists results to DB.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from db import get_connection, dict_cursor

logger = logging.getLogger(__name__)

# ── Weight sets ───────────────────────────────────────────────────────────────

BASE_WEIGHTS     = dict(I=0.24, V=0.18, A=0.14, R=0.12, F=0.10, N=0.08, E=0.08, S=0.06)
MORNING_WEIGHTS  = dict(I=0.26, V=0.18, A=0.14, R=0.12, F=0.14, N=0.06, E=0.06, S=0.04)
EVENING_WEIGHTS  = dict(I=0.22, V=0.16, A=0.14, R=0.12, F=0.06, N=0.16, E=0.12, S=0.02)

# ── Keyword lists ─────────────────────────────────────────────────────────────

HIGH_IMPACT = [
    "interest rate", "rate cut", "rate hike", "inflation", "budget", "fiscal",
    "monetary policy", "rba", "reserve bank", "tax", "tariff", "regulation",
    "policy", "financial", "deficit", "surplus", "stimulus", "subsidy", "levy",
]
MEDIUM_IMPACT = [
    "business", "market", "profit", "revenue", "earnings", "ipo", "merger",
    "acquisition", "shares", "stock", "asx", "company", "corporate", "investment", "venture",
]
AU_ENTITIES = [
    "australia", "australian", "aud", "rba", "asx", "ato", "apra", "asic",
    "bhp", "cba", "anz", "westpac", "nab", "macquarie", "woodside", "rio tinto",
    "wesfarmers", "woolworths", "sydney", "melbourne", "brisbane", "perth",
    "adelaide", "canberra", "nsw", "vic", "qld", "queensland", "victoria",
    "new south wales",
]
HIGH_ENGAGEMENT = [
    "salary", "wage", "income", "mortgage", "rent", "housing", "property",
    "superannuation", "super", "pension", "cost of living", "price", "energy bill",
    "grocery", "insurance", "career", "job", "employment", "money", "savings",
    "debt", "loan",
]
MEDIUM_ENGAGEMENT = [
    "business", "market", "investment", "trade", "economy", "growth", "sector", "industry",
]
STRATEGIC_CATEGORIES = {"business", "economy", "property", "policy", "markets", "finance", "employment"}
GOVT_ENTITIES = [
    "rba", "reserve bank", "ato", "australian taxation office", "federal government",
    "federal budget", "treasurer", "prime minister", "apra", "asic", "accc",
]
CONSUMER_FINANCE = [
    "mortgage", "rent", "cost of living", "energy bill", "grocery", "insurance",
    "superannuation", "super", "tax cut", "tax increase", "rate cut", "rate hike",
    "price rise", "price drop",
]


# ── Signal helpers ────────────────────────────────────────────────────────────

def _compute_impact(text: str) -> float:
    if any(kw in text for kw in HIGH_IMPACT):
        return 0.8
    if any(kw in text for kw in MEDIUM_IMPACT):
        return 0.6
    return 0.4


def _compute_authority(articles: list) -> float:
    if not articles:
        return 0.5
    return sum(a.get("source_authority", 0.5) for a in articles) / len(articles)


def _parse_entities(raw) -> dict:
    if raw is None:
        return {"orgs": [], "gpes": [], "persons": []}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            pass
    return {"orgs": [], "gpes": [], "persons": []}


def _compute_au_relevance(articles: list) -> float:
    au_count = 0
    total_count = 0
    for article in articles:
        entities = _parse_entities(article.get("entities"))
        all_ents = (
            list(entities.get("orgs") or [])
            + list(entities.get("gpes") or [])
            + list(entities.get("persons") or [])
        )
        total_count += len(all_ents)
        for e in all_ents:
            if any(au in e.lower() for au in AU_ENTITIES):
                au_count += 1
    return min(au_count / (total_count + 1), 1.0)


def _compute_freshness(first_seen_at: Optional[datetime]) -> float:
    if not first_seen_at:
        return 0.1
    if first_seen_at.tzinfo is None:
        first_seen_at = first_seen_at.replace(tzinfo=timezone.utc)
    hours_ago = (datetime.now(timezone.utc) - first_seen_at).total_seconds() / 3600
    if hours_ago <= 2:
        return 1.0
    if hours_ago <= 6:
        return 0.8
    if hours_ago <= 12:
        return 0.55
    if hours_ago <= 24:
        return 0.3
    return 0.1


def _compute_novelty(published_stories: list) -> float:
    if not published_stories:
        return 1.0
    most_recent = max(
        (s["published_at"] for s in published_stories if s.get("published_at")),
        default=None,
    )
    if most_recent is None:
        return 1.0
    if most_recent.tzinfo is None:
        most_recent = most_recent.replace(tzinfo=timezone.utc)
    hours_ago = (datetime.now(timezone.utc) - most_recent).total_seconds() / 3600
    return 0.5 if hours_ago > 12 else 0.0


def _compute_engagement(text: str) -> float:
    if any(kw in text for kw in HIGH_ENGAGEMENT):
        return 0.8
    if any(kw in text for kw in MEDIUM_ENGAGEMENT):
        return 0.6
    return 0.4


def _compute_strategic_fit(category: Optional[str]) -> float:
    if not category:
        return 0.3
    return 0.8 if category.lower() in STRATEGIC_CATEGORIES else 0.3


def _compute_boosts(text: str, unique_source_count: int) -> float:
    boost = 0.0
    if unique_source_count >= 5:
        boost += 0.05
    if any(kw in text for kw in GOVT_ENTITIES):
        boost += 0.04
    if any(kw in text for kw in CONSUMER_FINANCE):
        boost += 0.03
    return boost


def _compute_penalties(published_stories: list, cluster_quality: float) -> float:
    if cluster_quality < 0.4:
        return 0.0
    if published_stories:
        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        for s in published_stories:
            ed = s.get("edition_date")
            if ed:
                ed_str = ed.strftime("%Y-%m-%d") if isinstance(ed, datetime) else str(ed)[:10]
                if ed_str == today_str:
                    return 0.0
        twelve_ago = now - timedelta(hours=12)
        for s in published_stories:
            pub = s.get("published_at")
            if pub:
                if pub.tzinfo is None:
                    pub = pub.replace(tzinfo=timezone.utc)
                if pub >= twelve_ago:
                    return 0.3
    return 1.0


def _weighted_sum(signals: dict, weights: dict) -> float:
    return sum(signals.get(k, 0.0) * w for k, w in weights.items())


# ── Public API ────────────────────────────────────────────────────────────────

def score_cluster(cluster_id: str) -> dict:
    """Calculate and persist OzScore (base, morning, evening) for one cluster."""
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT id, topic, category, first_seen_at, unique_source_count, cluster_quality
                FROM story_clusters WHERE id = %s
                """,
                (cluster_id,),
            )
            cluster = dict(cur.fetchone() or {})
            if not cluster:
                raise ValueError(f"Cluster {cluster_id} not found")

            cur.execute(
                """
                SELECT id, title, source, source_authority, entities, category, published_at
                FROM articles WHERE cluster_id = %s
                """,
                (cluster_id,),
            )
            articles = [dict(r) for r in cur.fetchall()]

            cur.execute(
                """
                SELECT id, edition, edition_date, published_at
                FROM published_stories WHERE cluster_id = %s
                """,
                (cluster_id,),
            )
            published_stories = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

    topic_text = (cluster.get("topic") or "").lower()
    all_titles = " ".join(a.get("title", "").lower() for a in articles)
    combined_text = f"{topic_text} {all_titles}"

    signals = {
        "I": _compute_impact(combined_text),
        "V": min((cluster.get("unique_source_count") or 1) / 10, 1.0),
        "A": _compute_authority(articles),
        "R": _compute_au_relevance(articles),
        "F": _compute_freshness(cluster.get("first_seen_at")),
        "N": _compute_novelty(published_stories),
        "E": _compute_engagement(combined_text),
        "S": _compute_strategic_fit(cluster.get("category")),
    }

    oz_score         = _weighted_sum(signals, BASE_WEIGHTS)
    oz_score_morning = _weighted_sum(signals, MORNING_WEIGHTS)
    oz_score_evening = _weighted_sum(signals, EVENING_WEIGHTS)

    boost = _compute_boosts(combined_text, cluster.get("unique_source_count") or 1)
    oz_score         += boost
    oz_score_morning += boost
    oz_score_evening += boost

    penalty = _compute_penalties(published_stories, cluster.get("cluster_quality") or 0.0)
    oz_score         *= penalty
    oz_score_morning *= penalty
    oz_score_evening *= penalty

    oz_score         = max(0.0, min(1.0, oz_score))
    oz_score_morning = max(0.0, min(1.0, oz_score_morning))
    oz_score_evening = max(0.0, min(1.0, oz_score_evening))

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE story_clusters SET
                  oz_score = %s,
                  oz_score_morning = %s,
                  oz_score_evening = %s,
                  impact_score = %s,
                  au_relevance_score = %s,
                  engagement_score = %s
                WHERE id = %s
                """,
                (
                    oz_score, oz_score_morning, oz_score_evening,
                    signals["I"], signals["R"], signals["E"],
                    cluster_id,
                ),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    logger.debug(
        "Cluster %s: oz=%.3f morning=%.3f evening=%.3f",
        cluster_id, oz_score, oz_score_morning, oz_score_evening,
    )
    return {
        "oz_score": oz_score,
        "oz_score_morning": oz_score_morning,
        "oz_score_evening": oz_score_evening,
    }


def score_all_active() -> int:
    """Score all active clusters. Returns count of clusters scored."""
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT id FROM story_clusters WHERE status = 'active'")
            cluster_ids = [r["id"] for r in cur.fetchall()]
    finally:
        conn.close()

    logger.info("Scoring %d active cluster(s)", len(cluster_ids))
    scored = 0
    failed = []
    
    for cid in cluster_ids:
        retries = 0
        max_retries = 2
        while retries <= max_retries:
            try:
                score_cluster(cid)
                scored += 1
                break
            except Exception as exc:
                retries += 1
                if retries <= max_retries:
                    logger.warning(
                        "Failed to score cluster %s (attempt %d/%d): %s. Retrying...",
                        cid, retries, max_retries + 1, str(exc)[:100]
                    )
                    import time
                    time.sleep(1.0 * retries)  # Exponential backoff
                else:
                    logger.error("Failed to score cluster %s after %d attempts: %s", cid, max_retries + 1, str(exc)[:100])
                    failed.append((cid, str(exc)[:200]))

    logger.info("Scoring complete: %d/%d scored, %d failed", scored, len(cluster_ids), len(failed))
    if failed:
        logger.warning("Failed clusters: %s", failed[:5])  # Log first 5 failures
    return scored


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    n = score_all_active()
    print(f"Scored: {n} clusters")
