# OzShorts News Pipeline — How It Works

This document explains every stage of the OzShorts news pipeline in plain language.
The pipeline takes raw news from the internet and turns it into the polished, scored,
and categorised story cards you see in the app.

---

## Table of Contents

1. [The Big Picture](#the-big-picture)
2. [Stage 1 — Scraping](#stage-1--scraping)
3. [Stage 2 — AI Summarisation](#stage-2--ai-summarisation)
4. [Stage 3 — Normalisation](#stage-3--normalisation)
5. [Stage 4 — Deduplication](#stage-4--deduplication)
6. [Stage 5 — Clustering](#stage-5--clustering)
7. [Stage 6 — OzScore](#stage-6--ozscore)
8. [Stage 7 — Content Generation](#stage-7--content-generation)
9. [End-to-End Example](#end-to-end-example)

---

## The Big Picture

Think of the pipeline like a newsroom assembly line:

```
Raw News ─→ Scrape ─→ Summarise ─→ Clean Up ─→ Remove Duplicates ─→ Group by Story ─→ Score ─→ Write Final Content
```

Each stage does one job and passes its output to the next stage. You can run
the full pipeline end-to-end, or run individual stages on their own.

---

## Stage 1 — Scraping

**What it does:** Goes out to news websites, fetches the latest articles, and saves
the raw data into our database.

### How it works

1. The system reads a list of **news sources** from the database (e.g. ABC News, AFR,
   Reuters, SBS). Each source has an RSS feed URL or a web page URL to scrape.
2. For each source, it fetches the RSS feed (a structured list of recent articles).
3. For every article in the feed, it:
   - Checks if the article already exists in our database (by URL) — if so, it skips it.
   - Applies an **Australian relevance filter** for international sources — the article
     must mention Australian entities (e.g. "RBA", "ASX", "Sydney", "BHP") or global
     macro topics (e.g. "Fed rates", "oil prices") to be included.
   - Fetches the full article text from the original webpage.
   - Assigns a basic category (Tech, Markets, Business, etc.) based on keywords in the title.
   - Saves the article to the database with metadata: title, description, body text, source,
     URL, author, publication date, and the source's authority score.

### Key detail: Source Authority

Every news source has an **authority score** (a number between 0 and 1). High-quality,
well-known outlets like Reuters or the ABC have higher scores. This score is used later
in deduplication and scoring to prefer more reliable sources.

---

## Stage 2 — AI Summarisation

**What it does:** Takes articles that have full body text but no summary yet, and asks
an AI (OpenAI GPT-4o) to write a concise 8–10 sentence summary of each one.

### How it works

1. Finds all articles from the last 72 hours that have body text but no summary.
2. Processes them **one at a time** (not in parallel) to avoid hitting API rate limits.
3. For each article, sends the title and body text to GPT-4o with the instruction:
   *"Summarise the article in 8–10 sentences. Be neutral, factual, concise."*
4. Saves the AI-generated summary back onto the article in the database.
5. Waits **1 second** between each call to stay within API rate limits.

### Rate limiting and retries

- If the AI service returns a rate-limit error (HTTP 429), the system retries up to
  **3 times** with increasing wait times (5s, 10s, 15s) between attempts.
- Articles are processed in batches of up to **50 at a time**.

---

## Stage 3 — Normalisation

**What it does:** Cleans up raw article data and enriches it with structured metadata.
Think of this as the "quality control" step — it standardises messy scraped data into
a clean, consistent format.

### The five sub-steps

#### 3a. Text Cleaning

Removes junk from titles and descriptions:
- Strips **HTML tags** (e.g. `<b>`, `<p>`)
- Fixes **typographic characters** (e.g. curly quotes → straight quotes, em dashes → hyphens)
- Decodes **HTML entities** (e.g. `&amp;` → `&`, `&nbsp;` → space)
- Removes **publisher suffixes** from titles. For example:
  - `"RBA Holds Rates Steady | AFR"` → `"RBA Holds Rates Steady"`
  - `"Housing Prices Fall - ABC News"` → `"Housing Prices Fall"`
- Removes **byline prefixes** (e.g. `"By John Smith: ..."` → `"..."`)

#### 3b. Opinion Detection

Scans the title for opinion keywords: **"opinion"**, **"analysis"**, **"comment"**,
**"column"**, **"editorial"**. If any are found, the article is flagged as an opinion piece.
This is used later to calculate cluster quality (too many opinions = lower quality).

#### 3c. Category Detection

Assigns one of 8 categories by scanning the title and description for keyword patterns.
The rules are checked **in order** — the first match wins:

| Priority | Category               | Example keywords                                             |
|----------|------------------------|--------------------------------------------------------------|
| 1        | Business & Companies   | company, corporate, merger, CEO, BHP, Woolworths, profit     |
| 2        | Markets & Economy      | market, stock, ASX, inflation, RBA, interest rate, GDP       |
| 3        | Property & Housing     | property, housing, mortgage, rent, auction, home loan        |
| 4        | Politics & Policy      | government, parliament, election, Albanese, budget, tax      |
| 5        | World News             | Ukraine, China, NATO, Gaza, sanctions, trade war             |
| 6        | Tech & Innovation      | AI, startup, software, cyber, Apple, Google, semiconductor   |
| 7        | Employment & Wages     | job, unemployment, wage, salary, hiring, layoff, Fair Work   |
| 8        | Lifestyle              | travel, food, fashion, wellness, film, restaurant            |

If no keywords match, the article defaults to **"Business & Companies"**.

#### 3d. Entity Extraction

Identifies known **Australian entities** mentioned in the article by matching against
curated lists:

- **Organisations:** RBA, ASX, APRA, ASIC, BHP, CBA, ANZ, Westpac, Telstra, Qantas, etc. (36 total)
- **Places (GPEs):** Australia, Sydney, Melbourne, Brisbane, NSW, Victoria, Queensland, etc. (24 total)
- **People:** Anthony Albanese, Peter Dutton, Jim Chalmers, Michele Bullock, Gina Rinehart, etc. (20 total)

These entities are stored as structured data (JSON) on each article and used later in
clustering and scoring.

#### 3e. Dedup Hash Generation

Creates a simplified "fingerprint" of the title by:
1. Removing all punctuation
2. Converting to lowercase
3. Collapsing whitespace
4. Taking the first 80 characters

Example: `"RBA Holds Interest Rates: What It Means!"` → `"rba holds interest rates what it means"`

This hash is used in the next stage to quickly find duplicate articles.

### After normalisation

The article is marked as `processed = true`, meaning it's ready for deduplication
and clustering.

---

## Stage 4 — Deduplication

**What it does:** Finds and removes duplicate articles so the same news story doesn't
appear multiple times. Uses two different methods to catch duplicates.

### Pass 1: Hash-Based Deduplication

**How it works:**
1. Groups all recently processed articles (last 2 hours) by their **dedup hash**
   (the title fingerprint from normalisation).
2. Also checks against older articles with the same hash within the last **48 hours**.
3. If two or more articles have the same hash, it keeps the one from the
   **highest-authority source** and marks the rest as duplicates.

**Example:**
- ABC News (authority 0.8): `"rba holds interest rates steady"`
- SBS News (authority 0.6): `"rba holds interest rates steady"`
- Both have the same dedup hash → keep the ABC version, mark SBS as duplicate.

### Pass 2: Title Similarity (Jaccard)

**Purpose:** Catches near-duplicates where the titles are slightly different but cover
the same story.

**The Jaccard Similarity Formula:**

```
Jaccard(A, B) = |A ∩ B| / |A ∪ B|
```

In plain English: take the meaningful words from each title, count how many words
they share, and divide by the total number of unique words across both titles.

**Step by step:**
1. For each title, extract meaningful words (remove "the", "a", "and", "is", etc.
   — these are called **stop words**).
2. Compare every pair of articles published within **6 hours** of each other.
3. Calculate the Jaccard similarity score (0.0 = completely different, 1.0 = identical).
4. If the score is **above 0.85** (85% similar), the articles are considered duplicates.
5. Keep the one from the higher-authority source.

**Example:**

Article A: *"RBA Keeps Interest Rates on Hold for Third Month"*
→ Word set: {rba, keeps, interest, rates, hold, third, month}

Article B: *"RBA Holds Interest Rates Steady for Third Consecutive Month"*
→ Word set: {rba, holds, interest, rates, steady, third, consecutive, month}

- Shared words (intersection): {rba, interest, rates, third, month} → 5 words
- All unique words (union): {rba, keeps, holds, interest, rates, hold, steady, third, consecutive, month} → 10 words
- **Jaccard = 5 / 10 = 0.50**

In this case, 0.50 < 0.85, so these would **not** be flagged as duplicates — they're
related but different enough. If the titles were more similar (sharing 85%+ of their words),
they would be merged.

### What happens to duplicates?

Duplicate articles have their `cluster_id` set to `NULL`, which means they won't be
picked up by the clustering stage. They remain in the database but are effectively
invisible to the rest of the pipeline.

---

## Stage 5 — Clustering

**What it does:** Groups related articles about the same topic/event into **story clusters**.
Instead of showing 5 separate articles about the RBA holding rates, the app shows
one story card that represents all of them.

### The Algorithm

For each unassigned article (processed but not yet in a cluster):

1. **Compare against every existing active cluster.** For each article already in
   a cluster, check three conditions:

   | Condition | Threshold | What it means |
   |-----------|-----------|---------------|
   | Title similarity (Jaccard) | > 0.4 (40%) | The titles share enough words |
   | Shared entities | ≥ 1 | At least one entity in common (e.g. both mention "RBA") |
   | Time window | Within 24 hours | Published within a day of each other |

   **All three conditions must be met** for a match.

2. **If a match is found:** Assign the article to the cluster with the highest
   similarity score.

3. **If no match is found:** Create a **new cluster** with this article as the
   seed (primary article).

### Cluster Metadata

After articles are assigned, the system recalculates metadata for each affected cluster:

- **Article count:** How many articles are in the cluster
- **Unique source count:** How many different news outlets are covering this story
- **Category:** The most common category among the cluster's articles
- **Opinion ratio:** What percentage of articles in the cluster are opinion pieces
- **Has paywalled:** Whether any article in the cluster is behind a paywall
- **Primary article:** The highest-authority, non-opinion, non-paywalled article
  becomes the "primary" article for the cluster

### Cluster Quality Score

Each cluster gets a quality score (0.0 to 1.0) based on four factors:

```
Cluster Quality = (Source Diversity × 0.35)
                + (Non-Opinion Ratio × 0.30)
                + (Non-Paywalled Ratio × 0.20)
                + (Has Newswire × 0.15)
```

| Factor | Weight | How it's calculated |
|--------|--------|---------------------|
| Source Diversity | 35% | `min(unique_sources / 5, 1.0)` — more sources = better; maxes out at 5 |
| Non-Opinion Ratio | 30% | Percentage of articles that are NOT opinion pieces |
| Non-Paywalled Ratio | 20% | Percentage of articles that are NOT behind a paywall |
| Has Newswire | 15% | 1.0 if the cluster includes Reuters, AAP, or Bloomberg; otherwise 0.0 |

**Example:** A cluster with 4 unique sources, 80% non-opinion articles, 100% free articles,
and a Reuters article would score:
```
(4/5 × 0.35) + (0.80 × 0.30) + (1.0 × 0.20) + (1.0 × 0.15)
= 0.28 + 0.24 + 0.20 + 0.15
= 0.87 (high quality)
```

### Archiving Old Clusters

Clusters that haven't been updated in **48 hours** are automatically archived
(status set to "archived"). They no longer appear in the scoring or content
generation stages.

---

## Stage 6 — OzScore

**What it does:** Calculates a single importance score (0.0 to 1.0) for each story
cluster. This score determines the order stories appear in the feed and which
tier they get assigned to. A higher OzScore means the story is more important
and more relevant to Australian readers.

### The 8 Signals

The OzScore is built from **8 individual signals**, each measuring a different
aspect of a story's importance:

| Signal | Code | What it measures |
|--------|------|------------------|
| **Impact** | I | How significant is this news? (policy, economic, regulatory) |
| **Volume** | V | How many different sources are covering it? |
| **Authority** | A | How reliable are the sources? |
| **AU Relevance** | R | How connected is this story to Australia? |
| **Freshness** | F | How recent is this story? |
| **Novelty** | N | Have we already covered this story recently? |
| **Engagement** | E | How relevant is this to everyday Australians (money, jobs, housing)? |
| **Strategic Fit** | S | Does this fit OzShorts' focus areas? |

### How Each Signal Is Calculated

#### Signal 1: Impact (I)

Scans the combined text of all articles in the cluster for keywords:

| Keywords found | Score |
|----------------|-------|
| **High-impact** words: "interest rate", "rate cut", "inflation", "budget", "RBA", "tariff", "regulation", "tax", "monetary policy", etc. | **0.8** |
| **Medium-impact** words: "business", "market", "profit", "ASX", "merger", "shares", "investment", etc. | **0.6** |
| No impact keywords found | **0.4** |

#### Signal 2: Volume (V)

Based on how many unique news sources are covering the story:

```
Volume = min(unique_source_count / 10, 1.0)
```

| Sources | Score |
|---------|-------|
| 1 source | 0.10 |
| 3 sources | 0.30 |
| 5 sources | 0.50 |
| 10+ sources | 1.00 |

#### Signal 3: Authority (A)

The average authority score of all sources covering this story:

```
Authority = average(source_authority for each article in cluster)
```

Authority scores range from 0.0 to 1.0, where outlets like Reuters, ABC, and
the AFR have higher scores.

#### Signal 4: AU Relevance (R)

Counts how many of the extracted entities are Australian:

```
AU Relevance = min(au_entity_count / (total_entity_count + 1), 1.0)
```

The "+1" prevents division by zero. A story where most entities are Australian
(e.g. "RBA", "Sydney", "CBA") scores higher than one where most entities are
international.

#### Signal 5: Freshness (F)

Based on how many hours ago the story first appeared:

| Hours since first seen | Score |
|------------------------|-------|
| 0–2 hours | **1.0** (breaking news) |
| 2–6 hours | **0.8** (still fresh) |
| 6–12 hours | **0.55** (ageing) |
| 12–24 hours | **0.3** (old) |
| 24+ hours | **0.1** (stale) |

#### Signal 6: Novelty (N)

Checks if we've already generated content for this cluster recently:

| Condition | Score |
|-----------|-------|
| No existing content for this cluster | **1.0** (completely new) |
| Content exists but is older than 12 hours | **0.5** (might need a refresh) |
| Content exists and is less than 12 hours old | **0.0** (already covered) |

#### Signal 7: Engagement (E)

Scans for keywords that affect everyday Australians personally:

| Keywords found | Score |
|----------------|-------|
| **High-engagement** words: "salary", "mortgage", "rent", "housing", "superannuation", "cost of living", "energy bill", "grocery", "insurance", etc. | **0.8** |
| **Medium-engagement** words: "business", "market", "investment", "trade", "economy", "growth", etc. | **0.6** |
| No engagement keywords found | **0.4** |

#### Signal 8: Strategic Fit (S)

Checks whether the story's category is one of OzShorts' focus areas:

| Category | Score |
|----------|-------|
| Business, Economy, Property, Policy, Markets, Finance, Employment | **0.8** |
| Any other category | **0.3** |

### The Weighted Formula

The 8 signals are combined using a **weighted sum**. The weights change depending
on the time of day:

| Signal | Base Weight | Morning Weight | Evening Weight |
|--------|-------------|----------------|----------------|
| I (Impact) | 0.24 | 0.26 | 0.22 |
| V (Volume) | 0.18 | 0.18 | 0.16 |
| A (Authority) | 0.14 | 0.14 | 0.14 |
| R (AU Relevance) | 0.12 | 0.12 | 0.12 |
| F (Freshness) | 0.10 | 0.14 | 0.06 |
| N (Novelty) | 0.08 | 0.06 | 0.16 |
| E (Engagement) | 0.08 | 0.06 | 0.12 |
| S (Strategic Fit) | 0.06 | 0.04 | 0.02 |

**Why different weights?**
- **Morning:** People want the latest breaking news → **Freshness gets a higher weight** (0.14 vs 0.10).
  Impact is also boosted because mornings are when big policy/market decisions land.
- **Evening:** People want deeper reads → **Novelty and Engagement get higher weights**
  (0.16 and 0.12). Freshness matters less because evening readers are catching up on the day.

```
OzScore = (I × weight_I) + (V × weight_V) + (A × weight_A) + (R × weight_R)
        + (F × weight_F) + (N × weight_N) + (E × weight_E) + (S × weight_S)
```

### Boosts

After the weighted sum, the score can receive **bonus points** for certain characteristics:

| Condition | Boost |
|-----------|-------|
| **5+ unique sources** covering the story | +0.05 |
| Mentions a **government entity** (RBA, ATO, Federal Government, Treasurer, PM, ACCC, etc.) | +0.04 |
| Mentions **consumer finance** topics (mortgage, rent, cost of living, energy bills, superannuation, tax, etc.) | +0.03 |

These boosts stack — a story mentioning the RBA's rate decision with 6 sources covering
it would get +0.05 + 0.04 + 0.03 = **+0.12**.

### Penalties

The score can also be **penalised** (multiplied down) to prevent repeats:

| Condition | Penalty |
|-----------|---------|
| Cluster quality score is below 0.4 | Score × **0.0** (completely suppressed) |
| Content was already generated for this cluster within the last 12 hours | Score × **0.3** (heavily reduced) |
| Otherwise | Score × **1.0** (no penalty) |

### Worked Example

Let's say we have a cluster about *"RBA Cuts Interest Rates for First Time in 4 Years"*
with 6 sources (ABC, AFR, Reuters, SBS, Bloomberg, SMH), first seen 1 hour ago,
no existing content:

| Signal | Value | Calculation |
|--------|-------|-------------|
| Impact (I) | 0.8 | "interest rate" + "rate cut" found (high-impact) |
| Volume (V) | 0.6 | min(6/10, 1.0) = 0.6 |
| Authority (A) | 0.75 | Average of source authorities |
| AU Relevance (R) | 0.7 | Most entities are Australian (RBA, Australia, etc.) |
| Freshness (F) | 1.0 | First seen 1 hour ago (< 2 hours) |
| Novelty (N) | 1.0 | No existing content |
| Engagement (E) | 0.8 | "mortgage", "rate cut" found (high-engagement) |
| Strategic Fit (S) | 0.8 | Category is "Markets & Economy" (strategic) |

**Base OzScore:**
```
= (0.8 × 0.24) + (0.6 × 0.18) + (0.75 × 0.14) + (0.7 × 0.12)
  + (1.0 × 0.10) + (1.0 × 0.08) + (0.8 × 0.08) + (0.8 × 0.06)
= 0.192 + 0.108 + 0.105 + 0.084 + 0.100 + 0.080 + 0.064 + 0.048
= 0.781
```

**After boosts:**
```
+0.05 (6 sources) + 0.04 (RBA = government entity) + 0.03 (rate cut = consumer finance)
= 0.781 + 0.12 = 0.901
```

**After penalties:** No penalty (no existing content, quality > 0.4)

**Final OzScore: 0.901** — This is a very high score, meaning this story will
appear near the top of the feed and be assigned Tier 1.

### What makes a story get a very high score?

A story will score above **0.8** (and likely become Tier 1) when it has most of these:
- Mentions high-impact topics (interest rates, budget, inflation, regulation)
- Covered by 5+ different news outlets
- From high-authority sources (Reuters, ABC, AFR)
- Strongly connected to Australia (mentions Australian entities)
- Very recent (under 2 hours old)
- Not already covered by OzShorts
- Personally relevant to readers (mortgage, salary, cost of living)
- Falls in a strategic category (business, economy, markets, policy)

### What makes a story get a low score?

A story will score below **0.3** (Tier 3 or not shown) when it has most of these:
- Only covered by 1 source
- From a low-authority source
- Mostly about international entities with no Australian angle
- More than 24 hours old
- Already has recent content generated
- Doesn't touch personal finance or core business topics
- Low cluster quality (mostly opinion pieces or paywalled articles)

---

## Stage 7 — Content Generation

**What it does:** Takes scored clusters and produces the final editorial content
that users see in the app — headlines, summaries, explainer articles, and
"why it matters" text.

### Step 1: Tier Assignment

Clusters are sorted by OzScore (highest first) and split into three tiers based
on their percentile position:

| Tier | Percentile | Meaning | Content produced |
|------|------------|---------|-----------------|
| **Tier 1** | Top 25% | The most important stories today | Headline + card summary (50 words) + "Why it matters" + full explainer (500–600 words) |
| **Tier 2** | Next 35% | Important but not critical | Headline + card summary (100 words) |
| **Tier 3** | Bottom 40% | Worth knowing about | Headline + card summary (100 words) |

### Step 2: AI Content Generation (4 LLM Calls per Cluster)

For each cluster, the system makes up to **4 calls to OpenAI GPT-4o**:

#### Call 1: Fact Extraction

The AI reads the top 5 articles in the cluster and extracts only **verified factual claims**:
numbers, dates, names, decisions, direct quotes. Each fact is tagged:
- **confirmed** — appears in multiple sources
- **single-source** — only one outlet reported this
- **conflicting** — sources disagree on this figure

#### Call 2: Headline + "Why It Matters"

Generates a headline (max 12 words) following strict rules:
- Plain English, no jargon
- Active voice
- States what happened (not why it might matter)
- No question marks or colons

For **Tier 1 only**, also generates a "Why it matters" line (max 20 words) from the
perspective of an Australian professional.

#### Call 3: Card Summary

A short paragraph for the feed card:
- Tier 1: max 50 words
- Tier 2/3: max 100 words

#### Call 4: Double Click Explainer (Tier 1 Only)

A full explainer article written in OzShorts' signature style (inspired by Finshots):
- Conversational and clear
- Written like explaining to a smart friend
- Short paragraphs, one idea each
- Active voice, plain English
- Ends with a "what to watch" observation, not a conclusion
- **500–600 words** for Tier 1

The explainer follows this structure:
1. Hook — the event, then zoom out to the bigger picture
2. What happened — core facts
3. Why this entity did what it did
4. The other side of the story
5. The deeper pattern — a broader trend
6. Australian impact
7. What to watch

### Step 3: Guardrails

Before saving Tier 1 content, it passes through automated quality checks:

| Check | What it catches |
|-------|-----------------|
| **Word count** | Must be within the target range for the tier |
| **Forbidden openers** | Sentences must not start with "However", "Furthermore", "In conclusion" |
| **Forbidden phrases** | Blocks cliché phrases: "It is worth noting", "Experts say", "It remains to be seen" |
| **Passive voice** | Flags if more than 15% of sentences use passive voice |
| **Bad endings** | Must end with a forward-looking observation, not "in summary" or "to conclude" |
| **Ungrounded figures** | Any number in the explainer that doesn't appear in the extracted facts → **automatic rejection** |

If an ungrounded figure is found (a number the AI made up), the entire piece is
**rejected** and won't be published.

### Step 4: Save to Database

The generated content is saved to the `cluster_content` table with status **"pending"**,
meaning it needs editor approval before appearing in the app.

---

## End-to-End Example

Let's follow one news story through the entire pipeline:

### 1. Scraping

The ABC News RSS feed includes a new article:
> *"Reserve Bank of Australia Cuts Cash Rate to 3.85% — ABC News"*

It's saved to the database with source authority 0.8.

AFR also has a similar article:
> *"RBA Delivers First Rate Cut in Four Years as Inflation Eases | AFR"*

Saved with source authority 0.85.

### 2. AI Summarisation

Both articles get an 8–10 sentence AI summary generated by GPT-4o, capturing the
key facts, context, and quotes from each article.

### 3. Normalisation

**ABC article after normalisation:**
- Title cleaned: `"Reserve Bank of Australia Cuts Cash Rate to 3.85%"` (removed "— ABC News")
- Category: `"Markets & Economy"` (matched "rate", "bank")
- Entities: `{orgs: ["RBA", "Reserve Bank of Australia"], gpes: ["Australia"], persons: ["Michele Bullock"]}`
- Opinion: `false`
- Dedup hash: `"reserve bank of australia cuts cash rate to 385"`

**AFR article after normalisation:**
- Title cleaned: `"RBA Delivers First Rate Cut in Four Years as Inflation Eases"`
- Category: `"Markets & Economy"`
- Entities: `{orgs: ["RBA"], gpes: ["Australia"], persons: []}`
- Dedup hash: `"rba delivers first rate cut in four years as inflation eases"`

### 4. Deduplication

- **Hash check:** Different dedup hashes → not hash-duplicates.
- **Title similarity:**
  - ABC words: {reserve, bank, australia, cuts, cash, rate, 385}
  - AFR words: {rba, delivers, first, rate, cut, four, years, inflation, eases}
  - Shared: {rate} → Jaccard = 1/15 = 0.07
  - 0.07 < 0.85 → **Not duplicates** (they're related but worded differently enough)

Both articles survive dedup.

### 5. Clustering

- ABC article is processed first. No existing cluster matches → **new cluster created**.
- AFR article is compared to the new cluster:
  - Jaccard similarity with ABC title: 0.07 → below 0.4? But wait — "rate" is shared, and
    both mention "RBA" as an entity. **However**, the title similarity must be > 0.4, so
    this particular comparison might not match on title alone.
  - If matching fails, a second cluster is created. (In practice, with more articles from
    more sources using similar wording, they'd converge into one cluster.)

Let's assume 4 more articles come in from Reuters, SBS, Bloomberg, and SMH with similar
titles — the cluster grows to 6 articles.

**Cluster metadata:**
- Article count: 6
- Unique sources: 6
- Category: Markets & Economy
- Cluster quality: 0.87 (high — multiple sources, no opinion, includes Reuters)

### 6. OzScore

Using the worked example from the OzScore section above:
**Final OzScore = 0.901** (very high).

### 7. Content Generation

- **Tier assignment:** With a 0.901 score, this is in the **top 25%** → **Tier 1**.
- **Fact extraction:** The AI extracts: "Cash rate cut from 4.10% to 3.85%",
  "First cut since November 2020", "Michele Bullock cited falling inflation", etc.
- **Headline generated:** `"RBA Cuts Rates to 3.85% in First Reduction Since 2020"`
- **Why it matters:** `"Lower rates could ease mortgage repayments for millions of Australian homeowners."`
- **Card summary:** A 50-word paragraph stating what happened and why it matters.
- **Double Click explainer:** A 500–600 word article explaining the rate cut, why the RBA
  acted, what it means for mortgages and savings, and what to watch for next.
- **Guardrails pass:** All figures match the fact list, no passive voice issues, no forbidden
  phrases → content is **approved**.
- **Saved as "pending"** → waits for editor approval in the Editor UI.

---

*This document reflects the pipeline as implemented in `automation/pipeline/`. Each stage
can be run independently via `python run_pipeline.py --<stage>` or all stages can run
together in sequence.*
