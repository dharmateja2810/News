"""
AI explainer — generates headline, summary, why-it-matters, and Double Click
content for story clusters using OpenAI GPT-4o.

Public API:
  generate_for_cluster(cluster_id)  → dict  (4 LLM calls, no DB write)
  generate_all_pending(limit=20)    → int   (fills editor_queue rows lacking ai_headline)
"""

import json
import logging
import re

from db import get_connection, dict_cursor

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OpenAI client (lazy-initialised on first use via _get_client())
# ---------------------------------------------------------------------------
_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client

    import os
    from openai import OpenAI

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Add it to backend/config.env."
        )
    _client = OpenAI(api_key=api_key)
    return _client


# ---------------------------------------------------------------------------
# Tier helper
# ---------------------------------------------------------------------------

def _derive_tier(oz_score: float, cluster_tier) -> int:
    if cluster_tier:
        return int(cluster_tier)
    if oz_score >= 0.7:
        return 1
    if oz_score >= 0.4:
        return 2
    return 3


# ---------------------------------------------------------------------------
# Low-level LLM call
# ---------------------------------------------------------------------------

def _call_llm(system_prompt: str, user_prompt: str, max_tokens: int = 1000) -> str:
    client = _get_client()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.5,
        max_tokens=max_tokens,
        top_p=0.9,
    )
    return response.choices[0].message.content.strip()


# ---------------------------------------------------------------------------
# The four LLM steps
# ---------------------------------------------------------------------------

def _extract_facts(cluster_summary: str) -> str:
    system = (
        "You are a fact extraction engine for OzShorts, an Australian news service.\n"
        "Given the article cluster below, extract only verified factual claims — "
        "numbers, dates, names, decisions, statements — in a structured list.\n"
        "Rules:\n"
        "- Extract facts only. No interpretation, no inference.\n"
        "- Include: figures, percentages, named entities, direct quotes, dates, outcomes\n"
        "- Flag any claims that appear in only one source as (single-source)\n"
        "- Flag any figures that conflict across sources as (conflicting)\n"
        "- Do not include opinion or analysis from the source articles\n\n"
        "Output format:\n"
        "FACT: [the fact]\n"
        "SOURCE: [publication name]\n"
        "FLAG: [single-source / conflicting / confirmed]"
    )
    return _call_llm(system, f"ARTICLE CLUSTER:\n{cluster_summary}", max_tokens=800)


def _generate_headline_meta(cluster_summary: str, facts: str, tier: int) -> dict:
    # Only generate "Why it matters" for Tier 1 (high-importance) articles
    if tier == 1:
        system = (
            "Generate an OzShorts headline for the following story.\n"
            "Rules:\n"
            "- Maximum 12 words\n"
            "- Plain English — no jargon\n"
            "- Active voice\n"
            "- States what happened, not why it might matter\n"
            "- No question marks\n"
            "- No colons\n"
            "Also generate a 'Why it matters' line — maximum 20 words, "
            "from the perspective of an Australian professional.\n\n"
            "Output MUST be exactly in this format:\n"
            "HEADLINE: <headline text>\n"
            "WHY IT MATTERS: <why it matters text>"
        )
    else:
        system = (
            "Generate an OzShorts headline for the following story.\n"
            "Rules:\n"
            "- Maximum 12 words\n"
            "- Plain English — no jargon\n"
            "- Active voice\n"
            "- States what happened, not why it might matter\n"
            "- No question marks\n"
            "- No colons\n\n"
            "Output MUST be exactly in this format:\n"
            "HEADLINE: <headline text>"
        )
    user = f"STORY SUMMARY:\n{cluster_summary}\n\nFacts:\n{facts}\n\nOutput:\n"
    result = _call_llm(system, user, max_tokens=200)

    headline = "Default Headline"
    why_it_matters = ""
    for line in result.splitlines():
        upper = line.strip().upper()
        if upper.startswith("HEADLINE:"):
            headline = line.strip()[9:].strip()
        elif tier == 1 and upper.startswith("WHY IT MATTERS:"):
            why_it_matters = line.strip()[15:].strip()
    return {"headline": headline, "why_it_matters": why_it_matters}


def _generate_explainer_body(meta: dict, facts: str, tier: int) -> str:
    system = (
        "You are OzShorts, an Australian financial and business news explainer. "
        "Your job is to write a short-form story in the style of Finshots — "
        "conversational, clear, and genuinely helpful to a busy professional who "
        "wants to understand not just what happened, but why it matters.\n\n"
        "VOICE AND STYLE:\n"
        "- Write like you are explaining the story to a smart friend, not filing a report\n"
        "- Use short paragraphs. One idea per paragraph.\n"
        "- Ask rhetorical questions to lead the reader forward\n"
        "- Use plain English. Translate jargon immediately after using it.\n"
        "- Never editorialize or express an opinion. Present facts and let the reader decide.\n"
        "- Avoid passive voice. Prefer 'The RBA held rates' over 'Rates were held by the RBA'.\n"
        "- Do not start paragraphs with 'However', 'Furthermore', or 'In conclusion'.\n"
        "- Never write 'It is worth noting that...' or 'It is important to understand...'\n"
        "- End with a forward-looking 'what to watch' observation — not a conclusion.\n\n"
        "FORMAT:\n"
        "- No markdown headers or bullet points. Plain prose only.\n"
        "- Paragraph breaks between every idea shift.\n"
        "- Do not include a headline."
    )

    if tier == 1:
        tokens = 1200
        user = (
            f"Write a Tier 1 OzShorts Double Click explainer. Target: 500–600 words.\n\n"
            f"STORY CLUSTER:\nHeadline: {meta['headline']}\n"
            f"Why It Matters: {meta['why_it_matters']}\n\n"
            f"SOURCE FACTS (use these — do not invent figures):\n{facts}\n\n"
            f"STRUCTURE TO FOLLOW:\n"
            f"1. Hook — open with the event, but immediately zoom out to the bigger picture\n"
            f"2. What happened — the core facts, cleanly stated\n"
            f"3. Why this company/institution did what it did\n"
            f"4. The other side of the story\n"
            f"5. The deeper pattern — what this reveals about a broader trend\n"
            f"6. Australian impact\n"
            f"7. What to watch\n\nDo not label these sections. Write as continuous prose."
        )
    elif tier == 2:
        tokens = 700
        user = (
            f"Write a Tier 2 OzShorts Double Click explainer. Target: 300–400 words.\n\n"
            f"STORY CLUSTER:\nHeadline: {meta['headline']}\n\n"
            f"SOURCE FACTS (use these — do not invent figures):\n{facts}\n\n"
            f"STRUCTURE TO FOLLOW:\n"
            f"1. Open with the news in one sentence — then immediately explain the 'so what'\n"
            f"2. The key context a reader needs to understand why this happened\n"
            f"3. Who this affects in Australia and how\n"
            f"4. One forward-looking signal — what to watch\n\n"
            f"Do not label these sections. Write as continuous prose."
        )
    else:
        tokens = 400
        user = (
            f"Write a Tier 3 OzShorts Double Click explainer. Target: 150–200 words.\n\n"
            f"STORY CLUSTER:\nHeadline: {meta['headline']}\n\n"
            f"SOURCE FACTS:\n{facts}\n\n"
            f"STRUCTURE TO FOLLOW:\n"
            f"1. State what happened, clearly and directly\n"
            f"2. Add one layer of factual context the short card did not include\n"
            f"3. One sentence on what this means for Australian businesses or consumers\n\n"
            f"Do not editorialize. Do not speculate. Facts only. "
            f"Do not label these sections. Write as continuous prose."
        )

    return _call_llm(system, user, max_tokens=tokens)


def _generate_card_summary(cluster_summary: str, facts: str) -> str:
    system = "You are OzShorts, an Australian news explainer. Write a short card summary for a news feed."
    user = (
        "Write a card summary in exactly 50-60 words. Plain English, no jargon. "
        "One paragraph. State what happened and why it matters to an Australian professional. "
        "Do not editorialize.\n\n"
        f"STORY:\n{cluster_summary}\n\nFACTS:\n{facts}\n\n"
        "Output the summary text only — no labels, no quotes."
    )
    return _call_llm(system, user, max_tokens=150)


# ---------------------------------------------------------------------------
# Guardrails (pure function — no DB, no LLM)
# ---------------------------------------------------------------------------

def _run_guardrails(content: str, facts: str, tier: int) -> dict:
    flags = []
    should_reject = False

    # 1. Word count
    word_count = len(content.split())
    ranges = {1: (500, 600), 2: (300, 400), 3: (150, 200)}
    min_w, max_w = ranges.get(tier, (150, 600))
    if word_count < min_w or word_count > max_w:
        flags.append(f"word-count-out-of-range: {word_count} words (target {min_w}–{max_w})")

    # 2. Forbidden sentence openers
    sentences = re.split(r"(?<=[.!?])\s+", content)
    for s in sentences:
        for opener in ("However", "Furthermore", "In conclusion"):
            if s.strip().startswith(opener):
                flags.append(f'forbidden-opener: sentence starts with "{opener}"')

    # 3. Forbidden phrases
    forbidden = [
        "It is worth noting that",
        "It is important to understand",
        "It remains to be seen",
        "In today's fast-moving",
        "Experts say",
    ]
    for phrase in forbidden:
        if phrase.lower() in content.lower():
            flags.append(f'forbidden-phrase: "{phrase}"')

    # 4. Passive voice ratio
    passive_matches = re.findall(r"\b(was|were|is|are|been|being)\s+\w+ed\b", content, re.IGNORECASE)
    passive_ratio = len(passive_matches) / max(len(sentences), 1)
    if passive_ratio > 0.15:
        flags.append(f"passive-voice-high: {round(passive_ratio * 100)}%")

    # 5. Summary ending
    last_para = content.strip().split("\n\n")[-1].lower()
    for ending in ("in summary", "in conclusion", "to summarise", "to sum up", "overall"):
        if ending in last_para:
            flags.append("ending-is-summary: should be forward-looking 'what to watch'")

    # 6. Ungrounded figures
    content_nums = re.findall(r"\$?[\d,.]+%?", content)
    fact_nums = set(re.findall(r"\$?[\d,.]+%?", facts))
    for num in content_nums:
        if len(num) <= 2 and "%" not in num and "$" not in num:
            continue
        if num not in fact_nums:
            flags.append(f"ungrounded-figure: {num} not in fact list")
            should_reject = True

    return {"flags": flags, "should_reject": should_reject}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_for_cluster(cluster_id: str) -> dict:
    """
    Run all 4 LLM steps for a cluster and return the result dict.
    Does NOT write to the database — callers handle persistence.
    """
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT sc.id, sc.oz_score, sc.tier,
                       json_agg(
                           json_build_object(
                               'source', a.source,
                               'title', a.title,
                               'description', a.description
                           )
                           ORDER BY a.source_authority DESC
                       ) AS articles
                FROM story_clusters sc
                JOIN articles a ON a.cluster_id = sc.id
                WHERE sc.id = %s
                GROUP BY sc.id, sc.oz_score, sc.tier
                """,
                (cluster_id,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        raise ValueError(f"Cluster {cluster_id} not found or has no articles")

    oz_score = float(row["oz_score"] or 0.0)
    tier = _derive_tier(oz_score, row["tier"])

    # Build cluster summary from top 5 articles
    articles = row["articles"] or []
    parts = []
    for art in articles[:5]:
        parts.append(f"[{art['source']}] {art['title']}\n{art['description'] or ''}")
    cluster_summary = "\n---\n".join(parts)

    logger.info("Cluster %s (tier %d): extracting facts...", cluster_id, tier)
    facts = _extract_facts(cluster_summary)

    logger.info("Cluster %s: generating headline...", cluster_id)
    meta = _generate_headline_meta(cluster_summary, facts, tier)

    logger.info("Cluster %s: generating card summary...", cluster_id)
    card_summary = _generate_card_summary(cluster_summary, facts)

    # Only Tier 1 gets a full explainer body + guardrails
    if tier == 1:
        logger.info("Cluster %s: writing explainer body (tier 1)...", cluster_id)
        explainer_body = _generate_explainer_body(meta, facts, tier)
        guardrail = _run_guardrails(explainer_body, facts, tier)
        if guardrail["flags"]:
            logger.warning("Cluster %s guardrail flags: %s", cluster_id, guardrail["flags"])
    else:
        explainer_body = ""
        guardrail = {"flags": [], "should_reject": False}

    return {
        "headline": meta["headline"],
        "why_it_matters": meta["why_it_matters"],
        "card_summary": card_summary,
        "explainer_body": explainer_body,
        "tier": tier,
        "guardrail_flags": guardrail["flags"],
        "should_reject": guardrail["should_reject"],
    }


def generate_all_pending(limit: int = 20) -> int:
    """
    Find editor_queue rows that have no AI headline and fill them in.
    Returns the number of queue items processed.
    """
    conn = get_connection()
    try:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT id, cluster_id
                FROM editor_queue
                WHERE ai_headline IS NULL
                LIMIT %s
                """,
                (limit,),
            )
            pending = cur.fetchall()
    finally:
        conn.close()

    if not pending:
        logger.info("No pending editor_queue items to generate")
        return 0

    logger.info("Generating AI content for %d queue item(s)...", len(pending))
    processed = 0
    for row in pending:
        queue_id = row["id"]
        cluster_id = row["cluster_id"]
        try:
            result = generate_for_cluster(cluster_id)
            _update_queue_item(queue_id, result)
            logger.info("Queue item %s done (cluster %s)", queue_id, cluster_id)
            processed += 1
        except Exception as exc:
            logger.error("Failed queue item %s (cluster %s): %s", queue_id, cluster_id, exc)

    logger.info("generate_all_pending complete: %d/%d processed", processed, len(pending))
    return processed


def _update_queue_item(queue_id: str, result: dict) -> None:
    """Write AI-generated content into an existing editor_queue row
    and persist the derived tier back to story_clusters."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE editor_queue
                SET ai_headline    = %s,
                    ai_summary     = %s,
                    ai_why_matters = %s,
                    ai_double_click = %s
                WHERE id = %s
                """,
                (
                    result["headline"],
                    result["card_summary"],
                    result["why_it_matters"],
                    result["explainer_body"],
                    queue_id,
                ),
            )
            # Write derived tier back to story_clusters so the publisher
            # picks up the correct tier instead of defaulting to 2.
            cur.execute(
                """
                UPDATE story_clusters
                SET tier = %s
                WHERE id = (SELECT cluster_id FROM editor_queue WHERE id = %s)
                """,
                (result["tier"], queue_id),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
