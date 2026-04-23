"""
Python normaliser — replaces backend/src/normaliser/normaliser.service.ts
Processes unprocessed articles: text cleaning, opinion detection,
category detection, entity extraction, dedup hash generation.
"""

import re
import json
import logging
from typing import Optional

from db import get_connection, dict_cursor, release_connection

logger = logging.getLogger(__name__)

# ── Publisher suffixes ────────────────────────────────────────────────────────

TITLE_SUFFIX_PATTERNS = [
    re.compile(r" \| AFR$", re.IGNORECASE),
    re.compile(r" \| Australian Financial Review$", re.IGNORECASE),
    re.compile(r" - ABC News$", re.IGNORECASE),
    re.compile(r" \| ABC News$", re.IGNORECASE),
    re.compile(r" - BBC News$", re.IGNORECASE),
    re.compile(r" \| BBC News$", re.IGNORECASE),
    re.compile(r" - Reuters$", re.IGNORECASE),
    re.compile(r" \| Reuters$", re.IGNORECASE),
    re.compile(r" - The Guardian$", re.IGNORECASE),
    re.compile(r" \| The Guardian$", re.IGNORECASE),
    re.compile(r" - SBS News$", re.IGNORECASE),
    re.compile(r" \| SBS News$", re.IGNORECASE),
    re.compile(r" - The Sydney Morning Herald$", re.IGNORECASE),
    re.compile(r" \| The Sydney Morning Herald$", re.IGNORECASE),
    re.compile(r" - The Age$", re.IGNORECASE),
    re.compile(r" \| The Age$", re.IGNORECASE),
    re.compile(r" - Nine News$", re.IGNORECASE),
    re.compile(r" \| Nine News$", re.IGNORECASE),
    re.compile(r" - news\.com\.au$", re.IGNORECASE),
    re.compile(r" \| news\.com\.au$", re.IGNORECASE),
    re.compile(r" - Sky News Australia$", re.IGNORECASE),
    re.compile(r" \| Sky News Australia$", re.IGNORECASE),
    re.compile(r" - The Australian$", re.IGNORECASE),
    re.compile(r" \| The Australian$", re.IGNORECASE),
    re.compile(r" - Bloomberg$", re.IGNORECASE),
    re.compile(r" \| Bloomberg$", re.IGNORECASE),
    re.compile(r" - CNBC$", re.IGNORECASE),
    re.compile(r" \| CNBC$", re.IGNORECASE),
    re.compile(r" - AP News$", re.IGNORECASE),
    re.compile(r" \| AP News$", re.IGNORECASE),
]

BYLINE_PATTERN = re.compile(r"^By [A-Z][a-z]+ [A-Z][a-z]+[,:]?\s*")

OPINION_KEYWORDS = ["opinion", "analysis", "comment", "column", "editorial"]

# ── Category rules (ordered; first match wins) ────────────────────────────────

CATEGORY_RULES = [
    (
        re.compile(
            r"\b(company|corporate|merger|acquisition|ceo|board|shareholder|dividend|profit|revenue|"
            r"bhp|rio tinto|woodside|wesfarmers|woolworths|cba|nab|anz|westpac|macquarie|telstra|qantas)\b",
            re.IGNORECASE,
        ),
        "Business & Companies",
    ),
    (
        re.compile(
            r"\b(market|stock|share|asx|wall street|dow|nasdaq|s&p|bond|yield|rba|interest rate|"
            r"inflation|gdp|recession|economy|economic|reserve bank|monetary policy|fiscal)\b",
            re.IGNORECASE,
        ),
        "Markets & Economy",
    ),
    (
        re.compile(
            r"\b(property|housing|real estate|mortgage|rent|auction|dwelling|apartment|"
            r"house price|home loan|corelogic|domain|realestate)\b",
            re.IGNORECASE,
        ),
        "Property & Housing",
    ),
    (
        re.compile(
            r"\b(government|parliament|minister|election|labor|liberal|coalition|albanese|dutton|"
            r"policy|legislation|budget|senate|regulation|tax reform)\b",
            re.IGNORECASE,
        ),
        "Politics & Policy",
    ),
    (
        re.compile(
            r"\b(ukraine|russia|china|usa|us president|nato|un |united nations|middle east|gaza|"
            r"israel|war|geopolitical|summit|diplomatic|trade war|sanctions)\b",
            re.IGNORECASE,
        ),
        "World News",
    ),
    (
        re.compile(
            r"\b(ai|artificial intelligence|machine learning|tech|startup|software|cyber|quantum|"
            r"chip|semiconductor|apple|google|microsoft|meta|amazon|openai)\b",
            re.IGNORECASE,
        ),
        "Tech & Innovation",
    ),
    (
        re.compile(
            r"\b(job|employment|unemployment|wage|salary|workforce|hiring|layoff|redundan|"
            r"fair work|union|industrial action|strike|work from home|remote work)\b",
            re.IGNORECASE,
        ),
        "Employment & Wages",
    ),
    (
        re.compile(
            r"\b(lifestyle|travel|food|wine|fashion|wellness|fitness|culture|art|music|"
            r"film|streaming|celebrity|restaurant)\b",
            re.IGNORECASE,
        ),
        "Lifestyle",
    ),
]

# ── Australian entity lists ───────────────────────────────────────────────────

AU_ORGS = [
    "RBA", "Reserve Bank of Australia", "ASX", "APRA", "ASIC", "ATO", "ACCC",
    "ABC", "SBS", "BHP", "CBA", "Commonwealth Bank", "ANZ", "Westpac", "NAB",
    "National Australia Bank", "Macquarie Group", "Telstra", "Optus", "Qantas",
    "Virgin Australia", "Woolworths", "Coles", "Wesfarmers", "Rio Tinto",
    "Woodside", "Fortescue", "CSL", "Atlassian", "Afterpay", "Canva",
    "Nine Entertainment", "News Corp", "Transurban", "AGL", "Origin Energy", "Santos",
]

AU_GPES = [
    "Australia", "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide",
    "Canberra", "Hobart", "Darwin", "Gold Coast", "Newcastle", "Wollongong",
    "Geelong", "Cairns", "Townsville", "New South Wales", "NSW", "Victoria",
    "Queensland", "Western Australia", "South Australia", "Tasmania",
    "Northern Territory", "ACT",
]

AU_PERSONS = [
    "Anthony Albanese", "Albanese", "Peter Dutton", "Dutton", "Jim Chalmers",
    "Chalmers", "Michele Bullock", "Bullock", "Philip Lowe", "Chris Minns",
    "Jacinta Allan", "Steven Miles", "Roger Cook", "Peter Malinauskas",
    "Andrew Barr", "Jeremy Rockliff", "Gina Rinehart", "Andrew Forrest",
    "Mike Cannon-Brookes", "Scott Farquhar",
]

# Pre-compile entity regexes for speed
_ORG_PATTERNS = [(e, re.compile(r"\b" + re.escape(e) + r"\b", re.IGNORECASE)) for e in AU_ORGS]
_GPE_PATTERNS = [(e, re.compile(r"\b" + re.escape(e) + r"\b", re.IGNORECASE)) for e in AU_GPES]
_PERSON_PATTERNS = [(e, re.compile(r"\b" + re.escape(e) + r"\b", re.IGNORECASE)) for e in AU_PERSONS]


# ── Text helpers ──────────────────────────────────────────────────────────────

def _clean_text(text: str) -> str:
    """Strip HTML tags, normalise typographic characters."""
    cleaned = re.sub(r"<[^>]*>", "", text)
    cleaned = cleaned.replace("\u2018", "'").replace("\u2019", "'")
    cleaned = cleaned.replace("\u201c", '"').replace("\u201d", '"')
    cleaned = cleaned.replace("\u2013", "-").replace("\u2014", "-")
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = (
        cleaned.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
    )
    return cleaned.strip()


def _clean_title(title: str) -> str:
    cleaned = _clean_text(title)
    for pattern in TITLE_SUFFIX_PATTERNS:
        cleaned = pattern.sub("", cleaned)
    cleaned = BYLINE_PATTERN.sub("", cleaned)
    return cleaned.strip()


def _detect_opinion(title: str) -> bool:
    lower = title.lower()
    return any(
        re.search(r"\b" + kw + r"\b", lower) for kw in OPINION_KEYWORDS
    )


def _detect_category(title: str, description: str) -> str:
    text = f"{title} {description}"
    for pattern, category in CATEGORY_RULES:
        if pattern.search(text):
            return category
    return "Business & Companies"


def _extract_entities(title: str, description: str) -> dict:
    text = f"{title} {description}"
    orgs = [e for e, p in _ORG_PATTERNS if p.search(text)]
    gpes = [e for e, p in _GPE_PATTERNS if p.search(text)]
    persons = [e for e, p in _PERSON_PATTERNS if p.search(text)]
    return {"orgs": orgs, "gpes": gpes, "persons": persons}


def _generate_dedup_hash(title: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", title.lower())).strip()[:80]


# ── Public API ────────────────────────────────────────────────────────────────

def process_article(article_id: str) -> None:
    """Run all normalisation steps on a single article and mark it as processed."""
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                "SELECT id, title, description FROM articles WHERE id = %s",
                (article_id,),
            )
            article = cur.fetchone()

        if not article:
            logger.warning("Article %s not found — skipping", article_id)
            return

        cleaned_title = _clean_title(article["title"] or "")
        cleaned_description = _clean_text(article["description"] or "")
        is_opinion = _detect_opinion(cleaned_title)
        category = _detect_category(cleaned_title, cleaned_description)
        entities = _extract_entities(cleaned_title, cleaned_description)
        dedup_hash = _generate_dedup_hash(cleaned_title)

        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE articles
                SET title = %s, description = %s, is_opinion = %s, category = %s,
                    entities = %s, dedup_hash = %s, processed = true, updated_at = NOW()
                WHERE id = %s
                """,
                (
                    cleaned_title,
                    cleaned_description or None,
                    is_opinion,
                    category,
                    json.dumps(entities),
                    dedup_hash,
                    article_id,
                ),
            )
        conn.commit()
        logger.debug(
            "Article %s processed: category=%s, opinion=%s", article_id, category, is_opinion
        )
    except Exception:
        conn.rollback()
        raise
    finally:
        release_connection(conn)


def process_unprocessed(batch_size: int = 200) -> int:
    """
    Find up to batch_size unprocessed articles and normalise them.
    Returns the count of successfully processed articles.
    """
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                "SELECT id FROM articles WHERE processed = false ORDER BY created_at ASC LIMIT %s",
                (batch_size,),
            )
            rows = cur.fetchall()
    finally:
        release_connection(conn)

    if not rows:
        logger.info("No unprocessed articles found")
        return 0

    logger.info("Normalising %d article(s)", len(rows))
    processed = 0
    for row in rows:
        try:
            process_article(row["id"])
            processed += 1
        except Exception as exc:
            logger.error("Failed to process article %s: %s", row["id"], exc)

    logger.info("Normalised %d/%d article(s)", processed, len(rows))
    return processed


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    n = process_unprocessed()
    print(f"Processed: {n}")
