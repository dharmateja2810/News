**OzShorts**
Technical Build Specification
End-to-end developer guide: scraping, clustering, scoring, feed construction, breaking cards, editorial queue and API
wmwtech  |  2025  |  Confidential

# 0. System Overview
OzShorts is an AI-assisted, editorially-reviewed Australian news product. The backend is a fully automated pipeline that ingests news from multiple RSS and scraping sources, groups articles into story clusters, scores them for relevance and importance, and surfaces a curated shortlist for a human editor to review before publishing.

The system publishes two feeds per day — morning and evening — with a third pathway for breaking news that bypasses the scheduled cycle when a story crosses a high-importance threshold.

Core pipeline: Scrape → Normalise → Deduplicate → Cluster → Score → Shortlist → AI Generation → Editor Review → Publish

## System Components at a Glance
**Component**
**Purpose**
**Trigger**
**Scraper**
**Fetches articles from RSS feeds and web sources**
**Cron — every 15–45 mins per source**
**Normaliser**
**Cleans and structures raw article data**
**Per article on ingest**
**Deduplicator**
**Removes near-identical articles across sources**
**Batch — every 30 mins**
**Clusterer**
**Groups deduplicated articles into story events**
**Batch — every 30 mins**
**OzScore Engine**
**Scores each cluster for importance and relevance**
**After each cluster pass**
**Feed Builder**
**Assembles the top-50 shortlist with category balance**
**At freeze times: 5:15am / 4:00pm**
**AI Generator**
**Produces headline, summary, why-it-matters, Double Click**
**After feed freeze**
**Editor Queue**
**Human review interface — approve, edit, reject, defer**
**5:45am–6:30am / 4:15pm–5:15pm**
**Publisher**
**Publishes approved stories to API**
**On editor approval or scheduled**
**Breaking Detector**
**Monitors OzScore in real-time for threshold breaches**
**Continuous — every 5 mins**
**Notification Service**
**Sends push notifications for breaking cards**
**On breaking threshold trigger**

## Tech Stack Recommendations
**Layer**
**Recommended**
**Reason**
**Language**
**Python 3.11+**
**Strong NLP ecosystem (spaCy, sentence-transformers, scikit-learn)**
**Task queue**
**Celery + Redis**
**Reliable async job processing for scraping and batch passes**
**Database**
**PostgreSQL**
**Relational structure suits the articles → clusters → feeds model**
**Vector similarity**
**pgvector (Postgres extension)**
**Enables cosine similarity queries directly in DB — no separate vector DB needed at MVP**
**LLM API**
**Anthropic Claude (claude-sonnet-4-6)**
**Strong narrative generation; reliable instruction-following for structured outputs**
**Scheduler**
**APScheduler or cron**
**Feed freeze jobs, scrape intervals, score decay**
**Push notifications**
**Firebase Cloud Messaging (FCM)**
**iOS and Android support, reliable delivery**
**API**
**FastAPI**
**Fast, typed, auto-documented — good fit for mobile app consumers**
**Hosting**
**AWS or Fly.io**
**Scraper and batch jobs need reliable uptime; Fly.io simpler for MVP**


# 1. Database Schema
Design the schema first. Every component in the pipeline reads from or writes to these tables. Getting the structure right upfront avoids migrations mid-build.

## Core Tables
### articles
Raw storage for every scraped article. One row per article, regardless of whether it ends up in a cluster or a feed.

**articles table**
CREATE TABLE articles (
id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
source          TEXT NOT NULL,            -- e.g. 'abc_news', 'afr', 'reuters'
source_url      TEXT UNIQUE NOT NULL,     -- original article URL
title           TEXT NOT NULL,
body            TEXT,                     -- full article text (where accessible)
summary         TEXT,                     -- first 3 paragraphs if body is long
author          TEXT,
published_at    TIMESTAMPTZ NOT NULL,
scraped_at      TIMESTAMPTZ DEFAULT NOW(),
category        TEXT,                     -- detected category tag
is_opinion      BOOLEAN DEFAULT FALSE,
is_paywalled    BOOLEAN DEFAULT FALSE,
source_authority FLOAT DEFAULT 0.5,       -- 0.0–1.0 based on source tier
embedding       VECTOR(384),              -- sentence-transformer embedding for similarity
dedup_hash      TEXT,                     -- title normalisation hash for fast dedup
cluster_id      UUID REFERENCES story_clusters(id),
processed       BOOLEAN DEFAULT FALSE
);

### story_clusters
One row per real-world story event. Multiple articles map to a single cluster.

**story_clusters table**
CREATE TABLE story_clusters (
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
topic               TEXT,                  -- auto-generated topic label
category            TEXT,                  -- business, markets, politics, etc.
first_seen_at       TIMESTAMPTZ,           -- timestamp of earliest article in cluster
last_updated_at     TIMESTAMPTZ,
article_count       INT DEFAULT 0,
unique_source_count INT DEFAULT 0,         -- distinct sources (used in Velocity score)
has_paywalled       BOOLEAN DEFAULT FALSE,
opinion_ratio       FLOAT DEFAULT 0.0,     -- % of articles flagged as opinion
cluster_quality     FLOAT DEFAULT 0.0,     -- 0.0–1.0 quality gate score
oz_score            FLOAT DEFAULT 0.0,     -- final weighted OzScore
oz_score_morning    FLOAT DEFAULT 0.0,     -- morning-weighted score
oz_score_evening    FLOAT DEFAULT 0.0,     -- evening-weighted score
tier                INT,                   -- 1, 2, or 3 (set at generation time)
is_breaking         BOOLEAN DEFAULT FALSE,
breaking_fired_at   TIMESTAMPTZ,
status              TEXT DEFAULT 'active', -- active | archived | suppressed
centroid_embedding  VECTOR(384)            -- average embedding of cluster articles
);

### cluster_articles
Join table — maps articles to clusters. Allows one article to belong to one cluster.

**cluster_articles table**
CREATE TABLE cluster_articles (
cluster_id   UUID REFERENCES story_clusters(id),
article_id   UUID REFERENCES articles(id),
is_primary   BOOLEAN DEFAULT FALSE,   -- the 'best' article selected for this cluster
added_at     TIMESTAMPTZ DEFAULT NOW(),
PRIMARY KEY (cluster_id, article_id)
);

### editor_queue
Staging table for each editorial session. The editor works entirely from this table.

**editor_queue table**
CREATE TABLE editor_queue (
id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
cluster_id      UUID REFERENCES story_clusters(id),
edition         TEXT NOT NULL,             -- 'morning' | 'evening' | 'breaking'
edition_date    DATE NOT NULL,
suggested_rank  INT,                       -- system-suggested position (1–50)
ai_headline     TEXT,
ai_summary      TEXT,                      -- ~50–60 word card summary
ai_why_matters  TEXT,
ai_double_click TEXT,                      -- full Double Click explainer
ai_image_prompt TEXT,                      -- prompt for illustration generation
status          TEXT DEFAULT 'pending',    -- pending | approved | edited | rejected | deferred
editor_headline TEXT,                      -- overrides ai_headline if edited
editor_summary  TEXT,
editor_notes    TEXT,
created_at      TIMESTAMPTZ DEFAULT NOW(),
reviewed_at     TIMESTAMPTZ
);

### published_stories
Final output table. The app API reads from here.

**published_stories table**
CREATE TABLE published_stories (
id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
cluster_id      UUID REFERENCES story_clusters(id),
queue_id        UUID REFERENCES editor_queue(id),
edition         TEXT NOT NULL,             -- 'morning' | 'evening' | 'breaking'
edition_date    DATE NOT NULL,
feed_rank       INT,                       -- final position in feed (1–20)
headline        TEXT NOT NULL,
summary         TEXT NOT NULL,
why_matters     TEXT NOT NULL,
double_click    TEXT NOT NULL,
category        TEXT NOT NULL,
tier            INT NOT NULL,
illustration_id TEXT,                      -- e.g. 'ozshorts-02-stock-market-up'
is_breaking     BOOLEAN DEFAULT FALSE,
published_at    TIMESTAMPTZ DEFAULT NOW()
);

### sources
Configuration table for all scraping sources. Editable without code changes.

**sources table**
CREATE TABLE sources (
id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name            TEXT NOT NULL,             -- e.g. 'AFR', 'ABC News'
slug            TEXT UNIQUE NOT NULL,      -- e.g. 'afr', 'abc_news'
rss_url         TEXT,
scrape_url      TEXT,
authority_score FLOAT DEFAULT 0.5,         -- 0.0–1.0, used in OzScore Authority
scrape_interval INT DEFAULT 30,            -- minutes between scrapes
is_active       BOOLEAN DEFAULT TRUE,
requires_au_filter BOOLEAN DEFAULT FALSE,  -- true for global sources (Reuters, Bloomberg)
is_paywalled    BOOLEAN DEFAULT FALSE
);


# 2. Scraping Layer
The scraper ingests articles from configured sources on a rolling schedule. For RSS feeds, the process is straightforward. For sources without reliable RSS, a lightweight HTML scraper is needed.

**2.1  RSS Ingestion**
Use feedparser (Python) to parse each RSS feed. Store every article that does not already exist in the articles table (deduplicated by source_url).
Schedule: high-priority sources (AFR, ABC, Reuters) every 15 minutes. Standard sources every 30–45 minutes. Run via Celery beat scheduler.
**Requirements**
Scrape interval per source — stored in the sources table, not hardcoded
Handle HTTP errors gracefully — 429 (rate limit), 503 (unavailable) should retry with exponential backoff, not crash
Respect robots.txt for all sources
Store raw RSS entry alongside parsed fields — useful for debugging
**Implementation Notes**
Use feedparser.parse(url) — it handles malformed RSS gracefully
Check published_at against NOW() - 48 hours — skip articles older than 48 hours on ingest
Extract: title, link (source_url), published (published_at), summary (first 500 chars), author
Set processed = FALSE on insert — the normaliser picks up unprocessed articles

**RSS Ingestion — Core Logic**
# rss_ingestor.py — simplified
import feedparser
from datetime import datetime, timedelta, timezone

def ingest_feed(source: dict, db_session):
feed = feedparser.parse(source['rss_url'])
cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
new_count = 0

for entry in feed.entries:
pub_date = parse_date(entry.get('published'))
if pub_date and pub_date < cutoff:
continue  # skip old articles

url = entry.get('link', '')
if db_session.query(Article).filter_by(source_url=url).first():
continue  # already stored

article = Article(
source=source['slug'],
source_url=url,
title=entry.get('title', '').strip(),
summary=entry.get('summary', '')[:500],
published_at=pub_date,
source_authority=source['authority_score'],
)
db_session.add(article)
new_count += 1

db_session.commit()
return new_count

**2.2  Australian Relevance Filter**
Global sources (Reuters, Bloomberg, Yahoo Finance) publish thousands of articles per day. The vast majority are irrelevant to an Australian audience. Before storing these articles, run a relevance check.
This is not a heavy ML model — a keyword and entity check is sufficient at MVP.
**Requirements**
Must run on all sources where requires_au_filter = TRUE in the sources table
False negative rate should be low — it is better to include a borderline article than exclude a relevant one
**Implementation Notes**
Check title + summary for: Australian entity names (RBA, ASX, ATO, APRA, ASIC, Canberra, Sydney, Melbourne, Brisbane, Perth, Adelaide), Australian companies (BHP, CBA, ANZ, Westpac, NAB, Macquarie, Woodside, Rio Tinto, Wesfarmers, Woolworths), country mentions (Australia, Australian), AUD, and core AU economic indicators
If none of the above match: check if the story has clear global macro relevance (Fed rates, oil prices, China GDP) — these qualify even without AU entity mentions
Skip the article if neither check passes

## Source Authority Scores
Assign a fixed authority score to each source. This is the A (Authority) input to OzScore. These are editorial judgements — adjust over time based on observed quality.

**Source**
**Authority Score**
**Rationale**
**AFR**
**0.95**
**Premium Australian financial journalism**
**ABC News**
**0.90**
**National public broadcaster — high editorial standards**
**Reuters**
**0.92**
**Global wire service — fast, accurate, factual**
**Bloomberg**
**0.90**
**Premium financial and markets coverage**
**The Age / SMH**
**0.82**
**Major metropolitan broadsheets**
**Guardian Australia**
**0.78**
**Strong editorial standards; some opinion volume**
**Yahoo Finance**
**0.55**
**Aggregator — high volume, lower editorial filter**
**MarketWatch**
**0.60**
**Reliable markets data; some clickbait headlines**
**TechCrunch**
**0.65**
**Strong tech coverage; US-centric perspective**
**The Verge**
**0.62**
**Strong tech editorial; limited AU relevance**


# 3. Normalisation Layer
Every ingested article passes through normalisation before it can be clustered or scored. This step structures the raw text into fields the pipeline can use.

**3.1  Text Cleaning**
Remove HTML tags, special characters, excessive whitespace. Decode HTML entities. Normalise quotes and dashes. Strip bylines and publisher suffixes from titles (e.g. ' | AFR').
**Implementation Notes**
Use Python's html.parser or BeautifulSoup for HTML stripping
Run title through a normalised hash (lowercase, strip punctuation, collapse whitespace) — store as dedup_hash for fast duplicate detection

**3.2  Category Detection**
Classify each article into one of OzShorts' content categories. This determines which illustration gets assigned and which feed slot the story competes for.
**Requirements**
Every article must receive a category — use 'general' as fallback, never NULL
**Implementation Notes**
Use a zero-shot classifier (HuggingFace transformers, facebook/bart-large-mnli) at MVP — no training data required
Categories: business_companies | markets_economy | property_housing | politics_policy | world_news | tech_innovation | employment_wages | lifestyle_general
If confidence < 0.6: fall back to keyword matching, then 'general'
Store raw confidence score alongside the label — useful for debugging and future fine-tuning

**3.3  Opinion Detection**
Flag articles as opinion/analysis vs. straight news reporting. Opinion articles carry lower weight in scoring and should not be the primary source for a cluster.
**Requirements**
is_opinion flag must be set on every article — FALSE is acceptable default but should not be skipped
**Implementation Notes**
Check for opinion signals: author byline with 'Opinion', 'Analysis', 'Comment', 'Column' in title or section tag
Check source section metadata from RSS (many publishers include section in the feed)
For ambiguous cases: run a simple classifier on the first paragraph — first-person language, modal verbs ('should', 'must', 'ought'), evaluative adjectives are strong opinion signals

**3.4  Entity Extraction**
Extract named entities from the article title and summary. Entities are used in the clustering step to group articles about the same people, companies, and topics.
**Implementation Notes**
Use spaCy (en_core_web_sm or en_core_web_md) for NER
Extract: ORG (companies, institutions), GPE (countries, cities), PERSON (named individuals), MONEY, PERCENT, DATE
Store extracted entities as a JSONB field on the articles table: { 'orgs': ['RBA', 'ANZ'], 'gpes': ['Australia'], 'persons': [] }
Normalise entity strings: uppercase, strip 'the', resolve common aliases (e.g. 'Commonwealth Bank' → 'CBA')

**3.5  Sentence Embedding**
Generate a vector embedding of the article title + first paragraph. This embedding is used for semantic similarity matching in the deduplication and clustering steps.
**Requirements**
Embedding generation must complete before the article is available for clustering
**Implementation Notes**
Use sentence-transformers: all-MiniLM-L6-v2 (384 dimensions) — fast, accurate, runs on CPU
Embed: title + ' ' + summary[:300]
Store in the embedding column (VECTOR(384) with pgvector extension)
Batch embed in groups of 64 for efficiency — do not embed one article at a time


# 4. Deduplication
Deduplication runs before clustering. Its job is to identify articles that cover the same event from the same angle — and keep only the best version. This is different from clustering, which groups articles about the same event regardless of perspective.

Dedup removes redundant articles. Clustering groups distinct articles. Run dedup first, then cluster on the deduplicated set.

**4.1  Hash-Based Fast Dedup**
The first dedup pass is fast and cheap — it catches exact or near-exact title matches using the normalised dedup_hash.
**Implementation Notes**
On ingest, compute dedup_hash: lowercase(title), strip punctuation, collapse whitespace, take first 80 characters
Before inserting, check if dedup_hash already exists in articles within the last 48 hours
If match found: keep the higher authority_score version; mark the duplicate as processed=TRUE and cluster_id=NULL

**4.2  Semantic Similarity Dedup**
The second pass catches articles with different titles but identical or near-identical content — common when aggregators repackage wire stories.
**Requirements**
Run every 30 minutes on articles ingested in the last 2 hours
Cosine similarity threshold: 0.88 — articles above this threshold are considered duplicates
**Implementation Notes**
Query pgvector for articles with cosine similarity > 0.88 published within 6 hours of each other
For each duplicate pair: keep the article with the higher source authority_score; mark the other as a duplicate
SQL: SELECT a.id, b.id, 1 - (a.embedding <=> b.embedding) AS similarity FROM articles a, articles b WHERE a.id != b.id AND a.published_at > NOW() - INTERVAL '6 hours' AND 1 - (a.embedding <=> b.embedding) > 0.88
Cap this query — only compare within the same category to avoid O(n²) performance issues at scale


# 5. Story Clustering
Clustering is the most important step in the pipeline. Every downstream component — scoring, editorial, content generation — depends on the quality of the clusters. A bad cluster produces a bad story card.

One cluster = one real-world event. The goal is to group every article about 'the RBA holding rates on Tuesday' into a single cluster — not to separate Reuters' version from the AFR's version.

**5.1  Clustering Logic**
Two articles belong in the same cluster if they are about the same real-world event. The definition of 'same event' uses three signals: semantic similarity, shared entities, and recency.
Run the clustering pass every 30 minutes on articles published in the last 24 hours that have not yet been assigned to a cluster.
**Requirements**
An article can only belong to one cluster
Clusters are created dynamically — if no suitable cluster exists for an article, create a new one
Clusters older than 48 hours should be marked status='archived' and no longer receive new articles
**Implementation Notes**
For each unassigned article, find candidate clusters: semantic similarity > 0.72 AND at least 1 shared named entity AND cluster.first_seen_at within 24 hours
If multiple candidates: assign to the cluster with highest cosine similarity
If no candidate: create a new cluster, set first_seen_at = article.published_at, set centroid_embedding = article.embedding
After assigning, update cluster centroid: new_centroid = mean(all article embeddings in cluster)
Update cluster.unique_source_count, cluster.article_count, cluster.has_paywalled, cluster.opinion_ratio

**5.2  Primary Article Selection**
Each cluster has one primary article — the best single source to use as the factual anchor for content generation. This is the article the LLM is given as its main source.
**Requirements**
Every cluster must have exactly one is_primary = TRUE article at all times
**Implementation Notes**
Select primary article based on: highest source authority_score WHERE is_opinion = FALSE AND is_paywalled = FALSE
If all non-paywalled articles are opinion: select highest authority regardless of opinion flag, note in cluster metadata
Re-evaluate primary article each time a new article is added to the cluster — a higher-authority article added later should become primary

**5.3  Cluster Quality Score**
Before a cluster can enter the editorial queue, it must pass a quality gate. The quality score prevents low-credibility clusters from wasting editor time.
**Requirements**
No cluster should enter the top-50 shortlist with cluster_quality < 0.4
**Implementation Notes**
cluster_quality = (source_diversity * 0.35) + (non_opinion_ratio * 0.30) + (non_paywalled_ratio * 0.20) + (has_newswire_source * 0.15)
source_diversity: unique_source_count / 5 — capped at 1.0 (5+ sources = full score)
non_opinion_ratio: 1 - opinion_ratio
non_paywalled_ratio: count of accessible articles / total articles
has_newswire_source: 1 if any article.source in ['reuters', 'aap', 'bloomberg'] else 0
Clusters with cluster_quality < 0.4: suppress from top-50 queue, flag as 'low_quality' in status


# 6. OzScore Engine
OzScore is the weighted importance score assigned to each story cluster. It determines which clusters surface in the top-50 shortlist and in what order the editor sees them. It also drives the breaking card threshold.

## 6.1 Score Formula
**OzScore = 0.24I + 0.18V + 0.14A + 0.12R + 0.10F + 0.08N + 0.08E + 0.06S**

**Factor**
**Weight**
**Variable**
**How to Calculate**
**Impact**
**0.24**
**I**
Significance of real-world consequences. Scored 0.0–1.0 by LLM classification against a rubric (see 6.2). Highest weight — this is the hardest to automate but the most important.
**Velocity**
**0.18**
**V**
unique_source_count / 10, capped at 1.0. 10+ unique sources covering a story = full Velocity score. Use source count, not article count.
**Authority**
**0.14**
**A**
Mean source_authority of all articles in the cluster. Reflects the credibility of who is covering the story.
**Australian Relevance**
**0.12**
**R**
0.0–1.0 scored by LLM. Did Australian entities, policy, or markets feature prominently? Not just mentioned — central to the story.
**Freshness**
**0.10**
**F**
Time-decayed. See formula in 6.3.
**Novelty**
**0.08**
**N**
1.0 if this cluster has not been published in a previous feed. 0.5 if it was published more than 12 hours ago. 0.0 if it ran in the most recent feed.
**Engagement**
**0.08**
**E**
Proxy for reader interest. Scored by LLM: does this story touch money, career, or decisions? High = 0.8–1.0. Low = 0.2–0.4.
**Strategic Fit**
**0.06**
**S**
Does this story align with OzShorts' content pillars (business, economy, property, policy, markets)? Binary: 0.8 or 0.3.

## 6.2 LLM-Scored Factors
Impact, Australian Relevance, and Engagement cannot be reliably computed from metadata alone. Use a single LLM call to score all three simultaneously, passing the cluster topic, primary article title, and a 300-word excerpt.

**OzScore LLM Scorer — Prompt**
SYSTEM:
You are a news importance scorer for OzShorts, an Australian professional news app.
Score the following news story on three dimensions. Return JSON only.

Scoring rules:
impact: How significant are the real-world consequences of this story for people's
money, jobs, safety, or major decisions? 0.9–1.0 = transformative (RBA rate change,
federal budget). 0.6–0.8 = significant (company earnings miss, housing data).
0.3–0.5 = moderate (minor policy update, sector movement). 0.1–0.2 = low.

au_relevance: How central is Australia to this story? 1.0 = exclusively Australian.
0.7–0.9 = primarily Australian. 0.4–0.6 = Australia mentioned but global story.
0.1–0.3 = minimal or no Australian angle.

engagement: How likely is a busy Australian professional to want to read this?
1.0 = directly affects their money, job, or major life decisions.
0.6–0.8 = professionally relevant. 0.3–0.5 = general interest.
0.1–0.2 = unlikely to resonate with target audience.

USER:
Story: {cluster_topic}
Headline: {primary_article_title}
Excerpt: {article_excerpt_300_words}

Respond with only: {"impact": 0.0, "au_relevance": 0.0, "engagement": 0.0}

## 6.3 Freshness Decay
Freshness must decay over time so that old stories do not compete with new ones on equal footing. Apply this to every cluster score recalculation.

**Freshness Decay Function**
def freshness_score(cluster_first_seen_at: datetime) -> float:
age_hours = (datetime.now(timezone.utc) - cluster_first_seen_at).total_seconds() / 3600
if   age_hours <= 2:   return 1.00   # Breaking — full score
elif age_hours <= 6:   return 0.80   # Recent — strong
elif age_hours <= 12:  return 0.55   # This morning/afternoon — moderate
elif age_hours <= 24:  return 0.30   # Yesterday — deprioritise
else:                  return 0.10   # Old — survives only on high Impact

## 6.4 Score Adjustments
### Penalties — applied after base score
Already published in current feed edition: multiply final score by 0.0 (hard exclude)
Published in a feed within past 12 hours: multiply by 0.3
Category overrepresented in current shortlist (>2 stories same category already selected): multiply by 0.7
cluster_quality < 0.4: multiply by 0.0 (hard exclude from top-50)

### Boosts — applied after base score
Confirmed by 5+ unique sources: add 0.05 flat bonus
Story involves direct RBA, ATO, or federal government decision: add 0.04 flat bonus
Story involves direct financial impact on Australian consumers (rate change, price change, wage change): add 0.03 flat bonus

## 6.5 Morning vs. Evening Weight Variants
At each freeze point, recalculate scores using edition-specific weights. The base formula remains the same — only the weights change.

**Factor**
**Base Weight**
**Morning Weight**
**Evening Weight**
**Reason**
**Impact (I)**
**0.24**
**0.26**
**0.22**
**Morning prioritises importance; evening slightly relaxes this**
**Velocity (V)**
**0.18**
**0.18**
**0.16**
**Consistent — source count matters equally**
**Authority (A)**
**0.14**
**0.14**
**0.14**
**No change**
**AU Relevance (R)**
**0.12**
**0.12**
**0.12**
**No change**
**Freshness (F)**
**0.10**
**0.14**
**0.06**
**Morning strongly favours newest stories; evening deprioritises age**
**Novelty (N)**
**0.08**
**0.06**
**0.16**
**Evening strongly favours stories not in morning feed**
**Engagement (E)**
**0.08**
**0.06**
**0.12**
**Evening leans toward what readers will find interesting after work**
**Strategic Fit (S)**
**0.06**
**0.04**
**0.02**
**Less important for edition variants**


# 7. Feed Construction
Feed construction takes the scored clusters and assembles the top-50 shortlist that goes to the editor. It is not simply 'top 50 by OzScore' — it applies category balance rules to ensure the feed covers OzShorts' content pillars.

**7.1  Top-50 Shortlist Assembly**
Run at 5:15am (morning freeze) and 4:00pm (evening freeze). Use the edition-appropriate score variant.
The shortlist is assembled in two passes: first fill the category slots, then fill remaining slots by score.
**Requirements**
Evening feed must hard-exclude any cluster published in today's morning feed
No cluster with cluster_quality < 0.4 may enter the shortlist
Total shortlist size: 50 stories. Editor selects 20 for publication.
**Implementation Notes**
Pass 1 — Category fill: for each category, select the top N clusters by edition score up to the category's minimum slot allocation
Pass 2 — Score fill: fill remaining slots (50 minus slots filled in Pass 1) with the highest-scoring clusters from any category, subject to max-per-category cap
Category minimums and maximums: see table 7.2 below
If a category has fewer qualifying clusters than its minimum: fill with the next-highest scoring clusters from other categories

## 7.2 Category Slot Allocation
**Category**
**Min in Top-50**
**Max in Top-50**
**Min in Published 20**
**Max in Published 20**
**Business & Companies**
**10**
**12**
**4**
**5**
**Markets & Economy**
**8**
**10**
**3**
**4**
**Politics & Policy**
**7**
**9**
**3**
**4**
**World News**
**5**
**7**
**2**
**3**
**Tech & Innovation**
**4**
**6**
**1**
**2**
**Property & Housing**
**4**
**6**
**1**
**2**
**Employment & Wages**
**3**
**5**
**1**
**2**
**Lifestyle / General**
**2**
**4**
**1**
**2**

**7.3  Tier Assignment**
Each cluster in the shortlist receives a tier (1, 2, or 3). Tier determines the depth of the Double Click explainer generated.
**Implementation Notes**
Tier 1 (top 20% of shortlist by OzScore): Deep narrative explainer, 500–600 words
Tier 2 (next 40%): Context explainer, 300–400 words
Tier 3 (bottom 40%): Minimal factual expansion, 150–200 words
Override: any cluster with Impact score > 0.85 is automatically Tier 1 regardless of OzScore rank


# 8. AI Content Generation
Once the shortlist is frozen, the system generates all editorial content for each cluster automatically. This runs between the freeze and the editor review window — approximately 30 minutes of processing time for 50 stories.

**8.1  Generation Pipeline Per Cluster**
Four LLM calls are made per cluster, in sequence. Each call is independent and can be retried individually on failure.
**Requirements**
All four must succeed before the cluster appears in the editor queue
**Implementation Notes**
Call 1 — Fact extraction: extract structured facts from the primary article + top 2 supporting articles
Call 2 — Headline + Why it matters: generate card headline (max 12 words) and a 20-word 'why it matters' sentence
Call 3 — Card summary: generate the 50–60 word summary that appears on the card face
Call 4 — Double Click explainer: generate the full explainer using the tier-appropriate prompt (see Double Click Framework document)
All calls use the extracted fact list as grounding — no call may introduce figures not in the fact list

**8.2  Illustration Assignment**
Select the appropriate illustration from the library based on the cluster category and, where applicable, sentiment direction (positive/negative for markets and property).
**Implementation Notes**
Map cluster.category to illustration ID using the mapping table in the Illustration Brief document
For markets_economy clusters: check if the primary headline contains 'rises', 'gains', 'jumps', 'rallies' (positive) or 'falls', 'drops', 'slumps', 'declines' (negative) — select illustration 02 or 03 accordingly
For property_housing clusters: same positive/negative detection → illustration 17-up or 17-down
If no match: default to illustration 40 (brand catch-all)
Store as illustration_id in editor_queue

## 8.3 Quality Guardrails — Automated Checks
Before each generated content item is written to the editor queue, run these automated checks. Flag failures to the editor rather than silently discarding.

**Check**
**Condition**
**Action on Failure**
**Word count — summary**
**summary word count NOT in 45–70 range**
**Flag: 'Summary word count out of range'**
**Word count — Double Click**
**word count NOT within ±20% of tier target**
**Flag: 'Double Click length out of range'**
**Hallucinated figures**
**Any number in output NOT present in extracted fact list**
**Reject and regenerate (max 2 retries)**
**Forbidden phrases**
**'However,' / 'Furthermore,' / 'In conclusion' / 'It is worth noting'**
**Flag: 'Forbidden phrase detected'**
**Direct quotes**
**Any text in quotes NOT found in source articles**
**Reject and regenerate**
**Ending check**
**Last paragraph contains 'in summary' / 'in conclusion' / 'overall'**
**Flag: 'Explainer ends with summary — needs forward-looking close'**


# 9. Editor Queue Interface
The editor queue is the most important interface in the product. The editor has a fixed review window — approximately 45 minutes — to process 50 stories. The UI must be purpose-built for triage speed, not general CMS editing.

## 9.1 Queue API Endpoints
**Editor Queue API**
GET  /api/editor/queue?edition=morning&date=2025-06-01
→ Returns all 50 queue items sorted by suggested_rank
→ Each item includes: cluster metadata, ai_headline, ai_summary,
ai_why_matters, ai_double_click, illustration_id, oz_score,
tier, cluster_quality, source_count, top 3 source URLs

PATCH /api/editor/queue/{id}
Body: { status, editor_headline, editor_summary, editor_notes }
→ Updates a single queue item
→ Valid status values: approved | edited | rejected | deferred

POST  /api/editor/queue/{id}/publish
→ Immediately publishes a single approved item (used for breaking cards)

GET  /api/editor/queue/stats?edition=morning&date=2025-06-01
→ Returns: total | approved | rejected | deferred | pending | time_remaining

## 9.2 Interface Requirements
The editor sees each story as a card with all relevant information above the fold. Actions are one click or one keystroke.

**UI Element**
**Content**
**Purpose**
**Story header**
**Tier badge, OzScore (e.g. 0.84), Category, Source count**
**Quick triage signal — editor decides whether to read before clicking**
**Headline**
**AI-generated headline — editable inline**
**Primary content to review**
**Why it matters**
**One-line significance statement**
**Sanity check on editorial angle**
**Summary**
**50–60 word card summary — editable inline**
**The content the app user sees**
**Source links**
**Top 2–3 source article links, opening in new tab**
**Allows quick fact-check without leaving queue**
**Double Click preview**
**Expandable — hidden by default to keep queue fast**
**Editor opens only when they want to review depth**
**Quality flags**
**Automated check results — shown as amber warnings**
**Alerts editor to flagged content without blocking**
**Action bar**
**Approve / Edit / Reject / Defer — always visible**
**One-click actions; keyboard shortcuts: A/E/R/D**
**Progress indicator**
**'12 of 50 reviewed — 34 mins remaining'**
**Keeps editor aware of time constraint**

## 9.3 Keyboard Shortcuts
**Key**
**Action**
**A**
**Approve — publish as-is**
**E**
**Edit — open inline editor for headline and summary**
**R**
**Reject — remove from this edition's queue**
**D**
**Defer — move to next edition's queue**
**J / ↓**
**Next story**
**K / ↑**
**Previous story**
**X**
**Expand Double Click preview**
**S**
**Save edits (when in edit mode)**
**Escape**
**Cancel edit, return to triage view**


# 10. Breaking Card System
Breaking cards allow OzShorts to surface genuinely important stories in real time — outside the scheduled morning and evening feeds. This is the escape valve for the two-feed model.

Breaking cards are rare. The threshold is designed so that fewer than 5 stories per week qualify. If more than that are firing, the threshold is too low.

**10.1  Breaking Threshold Detection**
A background job runs every 5 minutes. It checks all clusters updated in the last 10 minutes for threshold breaches. When a cluster crosses the threshold, a breaking card is created immediately — it does not wait for the scheduled freeze.
The threshold is intentionally high. Breaking cards interrupt the user experience. Use them sparingly.
**Requirements**
Threshold: OzScore >= 0.82 AND Impact score >= 0.88 AND cluster.is_breaking = FALSE
Additional hard conditions (ALL must be true): unique_source_count >= 3, cluster_quality >= 0.6, story has NOT been published in any previous feed today
Cooldown: once a breaking card fires for a cluster, set is_breaking = TRUE — it cannot fire again for the same cluster
Daily cap: maximum 3 breaking cards per day. If cap is reached, queue for next scheduled feed instead.
**Implementation Notes**
Run as a Celery beat task every 5 minutes
Query: SELECT * FROM story_clusters WHERE oz_score >= 0.82 AND impact_score >= 0.88 AND is_breaking = FALSE AND last_updated_at > NOW() - INTERVAL '10 minutes'
On threshold breach: immediately trigger AI generation pipeline for the cluster, create editor_queue entry with edition='breaking', send alert to editor via push notification or SMS
Editor has 15 minutes to approve. If no action in 15 minutes: auto-defer to next scheduled feed. Never auto-publish without editor approval.

## 10.2 Breaking Card — Story Types That Should Qualify
Use these as calibration examples when setting and adjusting the threshold. The editor can always reject a breaking card that slips through.

**Story Type**
**Typical OzScore**
**Should Break?**
**Reason**
**RBA surprise rate decision (not on meeting day)**
**0.92–0.96**
**Yes**
**Immediate financial impact on every Australian borrower**
**Federal budget announced**
**0.90–0.94**
**Yes**
**Transformative policy event**
**ASX circuit breaker triggered (>5% fall)**
**0.88–0.93**
**Yes**
**Immediate impact on super and investments**
**Major Australian company entering administration**
**0.84–0.90**
**Yes**
**Jobs, creditors, sector implications**
**Scheduled RBA meeting — rates held (expected)**
**0.75–0.82**
**No**
**Expected outcome — surfaces in next scheduled feed**
**ASX falls 1.5% on global sentiment**
**0.65–0.75**
**No**
**Normal market movement — not breaking**
**Quarterly CPI data released (within forecast)**
**0.72–0.80**
**No**
**Scheduled data release — morning feed timing fine**
**Major geopolitical event with AU trade impact**
**0.82–0.88**
**Maybe**
**Depends on specificity of AU impact — editor judgement**
**PM announces policy change**
**0.78–0.85**
**Maybe**
**Depends on significance — threshold should catch major ones**

## 10.3 Breaking Card — User Experience
Breaking card appears at the top of the feed regardless of time of day
Marked with a 'Breaking' label in the UI — visually distinct from standard cards
Push notification sent to all users with breaking news notifications enabled
Notification text: headline only — max 60 characters
Breaking card has the same structure as a standard card: illustration, headline, summary, why it matters, Double Click
Breaking cards do not count toward the 20-story limit of the next scheduled feed — they are additive

## 10.4 Notification Payload
**FCM Breaking Notification Payload**
// Firebase Cloud Messaging payload for breaking card
{
notification: {
title: 'OzShorts Breaking',
body: '{headline_max_60_chars}',
},
data: {
type: 'breaking_card',
story_id: '{published_story_id}',
category: '{category}',
deep_link: 'ozshorts://story/{published_story_id}'
},
android: { priority: 'high' },
apns: { payload: { aps: { sound: 'default', badge: 1 } } }
}


# 11. Publishing and App API
Once a story is approved by the editor, it is written to published_stories and immediately available via the app API. The API is the only layer the mobile app touches — it never reads directly from pipeline tables.

## 11.1 Key API Endpoints
**App API Endpoints**
# Feed endpoints
GET /api/feed?edition=morning&date=2025-06-01
→ Returns 20 published stories in feed_rank order
→ Fields: id, headline, summary, why_matters, category,
tier, illustration_id, is_breaking, published_at

GET /api/feed/latest
→ Returns the most recently published feed (morning or evening)
→ Used on app open to always show current feed

GET /api/story/{id}
→ Returns full story including double_click content
→ Called when user taps a card or double-clicks

GET /api/feed/breaking
→ Returns any breaking cards published today
→ App polls this every 10 minutes to check for breaking news

# Metadata
GET /api/categories
→ Returns category list with illustration mappings

## 11.2 Feed Response Structure
**Feed API Response**
// GET /api/feed response
{
edition: 'morning',
edition_date: '2025-06-01',
published_at: '2025-06-01T07:00:00+10:00',
story_count: 20,
stories: [
{
id: 'uuid',
feed_rank: 1,
headline: 'RBA holds rates at 4.10% for third consecutive meeting',
summary: '50–60 word summary text...',
why_matters: 'Mortgage costs stay elevated. Next decision in six weeks.',
category: 'markets_economy',
tier: 1,
illustration_id: 'ozshorts-01-interest-rates',
is_breaking: false,
published_at: '2025-06-01T06:58:00+10:00'
// double_click NOT included here — fetched on demand via /api/story/{id}
},
// ... 19 more stories
]
}


# 12. Recommended Build Phases
Build in three phases. Each phase produces a working, testable system. Do not skip to Phase 2 before Phase 1 is stable.

## Phase 1 — Working Pipeline (Weeks 1–4)
Goal: articles are being scraped, clustered, and scored. Editor can review and publish manually. No app yet.

Set up database schema — all tables from Section 1
Build RSS ingestor for 5 starter sources (ABC, AFR, Reuters, Bloomberg, SMH)
Build normaliser: text clean, category detection, entity extraction, embedding generation
Build deduplicator: hash-based fast pass + semantic similarity pass
Build clusterer: similarity + entity matching, cluster quality score
Build OzScore engine: base formula, freshness decay, LLM scoring for Impact/AU Relevance/Engagement
Build feed freezer: top-50 shortlist with category balance rules
Build AI generation pipeline: fact extraction, headline, summary, Double Click
Build basic editor queue: web page showing the 50 stories with approve/reject buttons
Build publisher: writes approved stories to published_stories table
Test end-to-end: run pipeline for 3 consecutive days, review output quality

## Phase 2 — Breaking Cards and App API (Weeks 5–7)
Goal: app can consume the feed. Breaking cards are live. Editor queue is purpose-built.

Build breaking detector: Celery beat task, threshold logic, daily cap
Build notification service: FCM integration for breaking card alerts
Build proper editor queue UI: fast triage interface with keyboard shortcuts
Build app API: all endpoints from Section 11
Build illustration assignment logic: category-to-illustration mapping
Add remaining sources (Guardian AU, The Age, Yahoo Finance, TechCrunch, The Verge, MarketWatch)
Add Australian relevance filter for global sources
Add evening re-score with evening weight variant

## Phase 3 — Hardening and Monitoring (Weeks 8–10)
Goal: system is reliable enough for daily production use. Metrics visible. Failure modes handled.

Add error alerting: Slack or email notification on pipeline failures
Add pipeline monitoring dashboard: scrape success rates, cluster counts, score distributions
Add editor analytics: average review time, approve/reject ratios, most-edited stories
Add automated guardrail checks (Section 8.3) with editor flag surfacing
Load test the API: simulate 1,000 concurrent app users
Build admin panel: enable/disable sources, adjust score weights, view pipeline logs
Write runbook: what to do when each pipeline component fails


# 13. Open Questions for Developer Review
These are decisions that require developer input before or during Phase 1. Flag them in your first technical review session.

**Question**
**Why It Matters**
**Decision Needed By**
**Self-hosted vs. managed Postgres?**
pgvector requires Postgres 15+ and the extension installed. Supabase and Neon both support it managed. AWS RDS also supports it. Self-hosting gives more control but more ops overhead.
**Before Phase 1 starts**
**Embedding model: local vs. API?**
Running all-MiniLM-L6-v2 locally (CPU) adds ~200ms per article. Using an API (OpenAI text-embedding-3-small) costs ~$0.02 per 1M tokens. At MVP scale, local is fine. At production scale, API may be faster.
**Phase 1 Week 2**
**LLM cost ceiling per day?**
At 50 stories per feed x 4 LLM calls x 2 feeds = 400 LLM calls/day minimum. At ~$0.003 per call (Claude Sonnet), that's ~$1.20/day. Breaking cards add ~5 calls. Comfortable — but needs a daily spend alert.
**Phase 1 Week 3**
**Editor authentication?**
The editor queue must be behind auth. A simple email/password login (Supabase Auth or Auth0) is sufficient for MVP. Do not expose the editor queue publicly.
**Phase 1 Week 1**
**Paywall handling for body text?**
Many AFR articles are paywalled. The scraper gets title and summary from RSS but not full body. Content generation will use summary only for paywalled sources. This limits Double Click quality for AFR stories. Acceptable at MVP.
**Phase 1 Week 2**
**Mobile app: React Native or native?**
The backend is app-agnostic. The API works for any client. This spec does not cover the app build — that is a separate scope.
**Before Phase 2**
**Time zone handling?**
All timestamps in the database should be UTC. Convert to AEST/AEDT at the API layer using the user's local time. Feed freeze times (5:15am, 4:00pm) are AEST.
**Phase 1 Week 1**


OzShorts Technical Build Specification  |  wmwtech  |  Confidential