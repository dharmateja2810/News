"""
Python RSS scraper — replaces backend/src/scraper/scraper.service.ts
Reads active sources from the DB, fetches their RSS feeds via feedparser,
applies AU relevance filtering, fetches full article content, generates
AI summaries via OpenAI GPT-4o, and writes articles to PostgreSQL.
"""

import os
import re
import ssl
import uuid
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from typing import Optional

import feedparser
import requests
from bs4 import BeautifulSoup

# macOS Python often lacks system CA certificates; disable SSL verification
# for this local pipeline tool that only fetches known news RSS URLs.
ssl._create_default_https_context = ssl._create_unverified_context

from db import get_connection, dict_cursor, release_connection

# ── HTTP session for article fetching ────────────────────────────────────────

_session = requests.Session()
_session.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120 Safari/537.36"
    )
})
REQUEST_TIMEOUT = 30

# ── OpenAI client (lazy-initialised) ────────────────────────────────────────

_openai_client = None


def _get_openai_client():
    global _openai_client
    if _openai_client is not None:
        return _openai_client
    from openai import OpenAI
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to backend/config.env."
        )
    _openai_client = OpenAI(api_key=api_key)
    return _openai_client

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
        return "Tech & Innovation"
    if re.search(r"\b(stock|market|asx|rates|bank|economy|inflation|earnings|yield|rba|monetary)\b", text):
        return "Markets & Economy"
    if re.search(r"\b(company|corporate|merger|acquisition|ceo|revenue|profit|ipo|business)\b", text):
        return "Business & Companies"
    if re.search(r"\b(property|housing|rent|mortgage|real estate|auction|dwelling)\b", text):
        return "Property & Housing"
    if re.search(r"\b(employment|wages|jobs|hiring|unemployment|workforce|salary|labour|layoff)\b", text):
        return "Employment & Wages"
    if re.search(r"\b(election|government|parliament|policy|diplomatic|minister|politics|legislation)\b", text):
        return "Politics & Policy"
    if re.search(r"\b(war|international|global|foreign|united nations|nato|geopolitics|overseas)\b", text):
        return "World News"
    if re.search(r"\b(health|lifestyle|food|travel|entertainment|movie|music|sport|wellbeing)\b", text):
        return "Lifestyle"
    return "Business & Companies"


def _passes_au_filter(title: str, summary: str) -> bool:
    text = f"{title} {summary}".lower()
    if any(e in text for e in AU_ENTITIES):
        return True
    if any(t in text for t in GLOBAL_MACRO_TERMS):
        return True
    return False


def _generate_dedup_hash(title: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", title.lower())).strip()[:80]


MAX_CONTENT_WORKERS = 10  # parallel article fetches per source


def _fetch_article_content(url: str) -> Optional[str]:
    """Fetch the full article page and extract paragraph text."""
    try:
        res = _session.get(url, timeout=REQUEST_TIMEOUT)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, "html.parser")
        container = soup.find("article") or soup.find("main") or soup
        paragraphs = [p.get_text(" ", strip=True) for p in container.find_all("p")]
        paragraphs = [p for p in paragraphs if len(p) > 60]
        return "\n\n".join(paragraphs[:15]) if paragraphs else None
    except Exception as exc:
        logger.debug("Failed to fetch article content from %s: %s", url, exc)
        return None


def _summarize_with_openai(title: str, content: str) -> str:
    """Generate an 8-10 sentence summary using OpenAI GPT-4o."""
    try:
        client = _get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a news summariser for OzShorts, an Australian news service. "
                        "Summarise the article in 8-10 sentences. Be neutral, factual, concise. "
                        "Only output the summary, nothing else."
                    ),
                },
                {
                    "role": "user",
                    "content": f"TITLE: {title}\n\nCONTENT: {content}",
                },
            ],
            temperature=0.3,
            max_tokens=800,
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        logger.error("OpenAI summarisation failed for '%s': %s", title[:60], exc)
        return ""


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
    Fetch the RSS feed for one source, filter, fetch full article content,
    generate AI summaries, and insert new articles.
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

    # ── Phase 1: filter entries and collect candidates ────────────────────
    candidates = []
    conn = get_connection()
    try:
        for entry in feed.entries:
            try:
                published_at = _parse_published(entry)
                if published_at and published_at < cutoff:
                    continue

                source_url = (entry.get("link") or "").strip()
                if not source_url:
                    continue

                with dict_cursor(conn) as cur:
                    cur.execute("SELECT id FROM articles WHERE url = %s", (source_url,))
                    if cur.fetchone():
                        continue

                title = (entry.get("title") or "").strip()
                rss_summary = (
                    entry.get("summary")
                    or entry.get("description")
                    or entry.get("content", [{}])[0].get("value", "")
                    or ""
                ).strip()

                if source.get("requires_au_filter") and not _passes_au_filter(title, rss_summary):
                    continue

                candidates.append({
                    "entry": entry,
                    "title": title,
                    "rss_summary": rss_summary,
                    "source_url": source_url,
                    "published_at": published_at,
                })
            except Exception as exc:
                logger.error(
                    "Error filtering entry '%s' from '%s': %s",
                    entry.get("title", ""),
                    source["slug"],
                    exc,
                )
    finally:
        release_connection(conn)

    if not candidates:
        logger.info("Source '%s': no new candidates", source["slug"])
        return 0

    # ── Phase 2: fetch full content in parallel ──────────────────────────
    def _fetch_for_candidate(cand):
        content = _fetch_article_content(cand["source_url"])
        cand["full_content"] = content
        return cand

    with ThreadPoolExecutor(max_workers=MAX_CONTENT_WORKERS) as executor:
        futures = [executor.submit(_fetch_for_candidate, c) for c in candidates]
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as exc:
                logger.debug("Content fetch failed: %s", exc)

    # ── Phase 3: insert into DB (summaries generated later) ────────────
    inserted = 0
    conn = get_connection()
    try:
        for cand in candidates:
            try:
                dedup_hash = _generate_dedup_hash(cand["title"])
                category = _derive_category(cand["title"], cand["rss_summary"])
                image_url = _extract_image_url(cand["entry"])
                author = cand["entry"].get("author") or None

                full_content = cand.get("full_content") or None
                # summary will be generated in a separate pipeline stage
                # body = full article text, content = full text or rss summary
                body = full_content
                content = full_content or cand["rss_summary"] or None
                summary = None

                now = datetime.now(timezone.utc)
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO articles
                          (id, title, description, content, body, summary, url,
                           source, category, author, published_at, image_url,
                           source_authority, is_paywalled, dedup_hash, processed,
                           created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, false, %s, %s)
                        ON CONFLICT (url) DO NOTHING
                        """,
                        (
                            str(uuid.uuid4()),
                            cand["title"],
                            cand["rss_summary"] or None,
                            content,
                            body,
                            summary,
                            cand["source_url"],
                            source["name"],
                            category,
                            author,
                            cand["published_at"],
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
                    "Error inserting '%s' from '%s': %s",
                    cand["title"][:60],
                    source["slug"],
                    exc,
                )
    finally:
        release_connection(conn)

    logger.info(
        "Source '%s': %d new article(s) from %d entries (%d candidates)",
        source["slug"], inserted, len(feed.entries), len(candidates),
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
        release_connection(conn)

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
        release_connection(conn)

    if not source:
        raise ValueError(f"Source with slug '{slug}' not found")
    return _scrape_source(dict(source))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    results = scrape_all_active()
    for slug, count in sorted(results.items()):
        print(f"  {slug}: {count} inserted")
