"""
Post-scrape AI summariser — generates article summaries sequentially
with rate limiting to avoid OpenAI API throttling.

Processes articles that have body/content text but no summary yet.
Runs as a separate pipeline stage after scraping is complete.
"""

import os
import time
import logging
from datetime import datetime, timezone, timedelta

from db import get_connection, dict_cursor, release_connection

logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────────

BATCH_SIZE = 50                # articles per batch
DELAY_BETWEEN_CALLS = 1.0     # seconds between OpenAI calls (rate limiting)
MAX_RETRIES = 3                # retries per article on failure
RETRY_BACKOFF = 5.0            # seconds to wait after a rate-limit error
LOOKBACK_HOURS = 72            # only summarise articles from the last N hours

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


def _summarize_with_openai(title: str, content: str) -> str:
    """Generate an 8-10 sentence summary using OpenAI GPT-4o with retry."""
    for attempt in range(1, MAX_RETRIES + 1):
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
            exc_str = str(exc).lower()
            is_rate_limit = "rate" in exc_str or "429" in exc_str
            if attempt < MAX_RETRIES:
                wait = RETRY_BACKOFF * attempt if is_rate_limit else 2
                logger.warning(
                    "OpenAI attempt %d/%d failed for '%s': %s — retrying in %.0fs",
                    attempt, MAX_RETRIES, title[:60], exc, wait,
                )
                time.sleep(wait)
            else:
                logger.error(
                    "OpenAI summarisation failed after %d attempts for '%s': %s",
                    MAX_RETRIES, title[:60], exc,
                )
                return ""


def _get_unsummarised_articles(limit: int = BATCH_SIZE) -> list:
    """Fetch articles that have body text but no AI summary yet."""
    conn = get_connection()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT id, title, body, description
                FROM articles
                WHERE summary IS NULL
                  AND (body IS NOT NULL OR description IS NOT NULL)
                  AND created_at > %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (cutoff, limit),
            )
            return cur.fetchall()
    finally:
        release_connection(conn)


def _save_summary(article_id: str, summary: str):
    """Write the AI summary back to the article."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE articles
                SET summary = %s,
                    content = COALESCE(content, %s),
                    updated_at = %s
                WHERE id = %s
                """,
                (summary, summary, datetime.now(timezone.utc), article_id),
            )
        conn.commit()
    except Exception as exc:
        conn.rollback()
        logger.error("Failed to save summary for article %s: %s", article_id, exc)
    finally:
        release_connection(conn)


def summarise_articles() -> int:
    """
    Process all unsummarised articles sequentially with rate limiting.
    Returns the number of articles successfully summarised.
    """
    articles = _get_unsummarised_articles()
    if not articles:
        logger.info("No articles need summarisation")
        return 0

    logger.info("Found %d articles to summarise", len(articles))
    success = 0

    for i, article in enumerate(articles):
        title = article["title"]
        text = article["body"] or article["description"] or ""

        if not text.strip():
            logger.debug("Skipping article '%s' — no text content", title[:60])
            continue

        logger.info(
            "Summarising %d/%d: %s",
            i + 1, len(articles), title[:80],
        )

        summary = _summarize_with_openai(title, text)
        if summary:
            _save_summary(article["id"], summary)
            success += 1

        # Rate limit: wait between calls
        if i < len(articles) - 1:
            time.sleep(DELAY_BETWEEN_CALLS)

    logger.info(
        "Summarisation complete: %d/%d articles summarised",
        success, len(articles),
    )
    return success
