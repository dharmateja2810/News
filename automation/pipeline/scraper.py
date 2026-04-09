"""
Python RSS scraper — replaces backend/src/scraper/scraper.service.ts
Reads active sources from the DB, fetches their RSS feeds via feedparser,
applies AU relevance filtering, and writes new articles directly to PostgreSQL.
"""

import re
import ssl
import uuid
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from typing import Optional

import feedparser

# macOS Python often lacks system CA certificates; disable SSL verification
# for this local pipeline tool that only fetches known news RSS URLs.
ssl._create_default_https_context = ssl._create_unverified_context

from db import get_connection, dict_cursor

logger = logging.getLogger(__name__)

# ── Australian relevance keywords ─────────────────────────────────────────────

AU_ENTITIES = [
    "rba", "asx", "ato", "apra", "asic", "bhp", "cba", "anz", "westpac",
    "nab", "macquarie", "woodside", "rio tinto", "wesfarmers", "woolworths",
    "australia", "australian", "aud", "sydney", "melbourne", "brisbane",
    "perth", "adelaide", "canberra",
]

GLOBAL_MACRO_TERMS = [
    "fed rates", "oil prices", "china gdp",
]

# ── Category derivation (mirrors scraper.service.ts) ─────────────────────────

def _derive_category(title: str, summary: str) -> str:
    text = f"{title} {summary}".lower()

    if re.search(r"\b(ai|machine learning|chip|apple|google|microsoft|cyber|software|startup|tech|quantum)\b", text):
        return "Technology"
    if re.search(r"\b(stock|market|asx|profit|earnings|rates|bank|economy|inflation|company|merger)\b", text):
        return "Business"
    if re.search(r"\b(match|league|tournament|championship|olympic|soccer|football|cricket|tennis)\b", text):
        return "Sports"
    if re.search(r"\b(health|hospital|cancer|vaccine|disease|medical|wellbeing)\b", text):
        return "Health"
    if re.search(r"\b(science|research|space|telescope|climate|biology|physics)\b", text):
        return "Science"
    if re.search(r"\b(movie|music|streaming|celebrity|entertainment)\b", text):
        return "Entertainment"
    if re.search(r"\b(election|government|parliament|policy|diplomatic|minister|politics)\b", text):
        return "Politics"
    return "Business"


def _passes_au_filter(title: str, summary: str) -> bool:
    text = f"{title} {summary}".lower()
    if any(e in text for e in AU_ENTITIES):
        return True
    if any(t in text for t in GLOBAL_MACRO_TERMS):
        return True
    return False


def _generate_dedup_hash(title: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", title.lower())).strip()[:80]


def _extract_image_url(entry: dict) -> Optional[str]:
    """Try known media fields on a feedparser entry."""
    media_content = entry.get("media_content", [])
    if media_content and isinstance(media_content, list):
        url = media_content[0].get("url")
        if url:
            return url

    media_thumbnail = entry.get("media_thumbnail", [])
    if media_thumbnail and isinstance(media_thumbnail, list):
        url = media_thumbnail[0].get("url")
        if url:
            return url

    enclosures = entry.get("enclosures", [])
    if enclosures:
        url = enclosures[0].get("url") or enclosures[0].get("href")
        if url:
            return url

    return None


def _parse_published(entry: dict) -> Optional[datetime]:
    """Parse published / updated date from a feedparser entry."""
    for field in ("published_parsed", "updated_parsed"):
        t = entry.get(field)
        if t:
            try:
                return datetime(*t[:6], tzinfo=timezone.utc)
            except Exception:
                pass
    return None


# ── Core per-source scraping logic ────────────────────────────────────────────

def _scrape_source(source: dict) -> int:
    """
    Fetch the RSS feed for one source, filter, and insert new articles.
    Returns the count of newly inserted articles.
    """
    rss_url = source.get("rss_url")
    if not rss_url:
        logger.warning("Source '%s' has no rss_url — skipping", source["slug"])
        return 0

    try:
        feed = feedparser.parse(rss_url, agent="OzShorts-Scraper/2.0", request_headers={"Accept": "application/rss+xml"})
    except Exception as exc:
        logger.error("Failed to fetch RSS for '%s': %s", source["slug"], exc)
        return 0

    if feed.bozo and not feed.entries:
        logger.error("Malformed feed for '%s': %s", source["slug"], feed.bozo_exception)
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    inserted = 0

    conn = get_connection()
    try:
        for entry in feed.entries:
            try:
                published_at = _parse_published(entry)
                if published_at and published_at < cutoff:
                    continue  # older than 48 h

                source_url = (entry.get("link") or "").strip()
                if not source_url:
                    continue

                with dict_cursor(conn) as cur:
                    # Duplicate check
                    cur.execute("SELECT id FROM articles WHERE url = %s", (source_url,))
                    if cur.fetchone():
                        continue

                title = (entry.get("title") or "").strip()
                summary = (
                    entry.get("summary")
                    or entry.get("description")
                    or entry.get("content", [{}])[0].get("value", "")
                    or ""
                ).strip()

                # AU relevance filter
                if source.get("requires_au_filter") and not _passes_au_filter(title, summary):
                    continue

                dedup_hash = _generate_dedup_hash(title)
                category = _derive_category(title, summary)
                image_url = _extract_image_url(entry)
                author = entry.get("author") or None

                now = datetime.now(timezone.utc)
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO articles
                          (id, title, description, url, source, category, author,
                           published_at, image_url, source_authority, is_paywalled,
                           dedup_hash, processed, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, false, %s, %s)
                        ON CONFLICT (url) DO NOTHING
                        """,
                        (
                            str(uuid.uuid4()),
                            title,
                            summary or None,
                            source_url,
                            source["name"],
                            category,
                            author,
                            published_at,
                            image_url,
                            source.get("authority_score", 0.5),
                            bool(source.get("is_paywalled", False)),
                            dedup_hash,
                            now,
                            now,
                        ),
                    )
                    if cur.rowcount:
                        inserted += 1
                conn.commit()

            except Exception as exc:
                conn.rollback()
                logger.error(
                    "Error processing entry '%s' from '%s': %s",
                    entry.get("title", ""),
                    source["slug"],
                    exc,
                )
    finally:
        conn.close()

    logger.info(
        "Source '%s': %d new article(s) from %d entries",
        source["slug"], inserted, len(feed.entries),
    )
    return inserted


# ── Public API ────────────────────────────────────────────────────────────────

def scrape_all_active(max_workers: int = 8) -> dict:
    """
    Scrape all active sources concurrently.
    Returns {slug: articles_inserted}.
    """
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                "SELECT id, name, slug, rss_url, authority_score, scrape_interval, "
                "       is_active, requires_au_filter, is_paywalled "
                "FROM sources WHERE is_active = true"
            )
            sources = cur.fetchall()
    finally:
        conn.close()

    if not sources:
        logger.warning("No active sources found in DB")
        return {}

    results = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_slug = {
            executor.submit(_scrape_source, dict(src)): src["slug"]
            for src in sources
        }
        for future in as_completed(future_to_slug):
            slug = future_to_slug[future]
            try:
                results[slug] = future.result()
            except Exception as exc:
                logger.error("Source '%s' scrape failed: %s", slug, exc)
                results[slug] = 0

    total = sum(results.values())
    logger.info("Scraping complete: %d total new article(s) from %d source(s)", total, len(sources))
    return results


def scrape_source(slug: str) -> int:
    """Scrape a single source by slug. Returns articles inserted."""
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                "SELECT id, name, slug, rss_url, authority_score, scrape_interval, "
                "       is_active, requires_au_filter, is_paywalled "
                "FROM sources WHERE slug = %s",
                (slug,),
            )
            source = cur.fetchone()
    finally:
        conn.close()

    if not source:
        raise ValueError(f"Source with slug '{slug}' not found")
    return _scrape_source(dict(source))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    results = scrape_all_active()
    for slug, count in sorted(results.items()):
        print(f"  {slug}: {count} inserted")
