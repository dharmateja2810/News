import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ExplainerService {
  private readonly logger = new Logger(ExplainerService.name);
  private apiProvider: 'ollama' | 'openai' | 'anthropic';
  private apiKey: string;
  private ollamaUrl = 'http://localhost:11434/api/generate';
  private modelName = 'llama2';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (openaiKey) {
      this.apiProvider = 'openai';
      this.apiKey = openaiKey;
      this.modelName = 'gpt-4o';
    } else if (anthropicKey) {
      this.apiProvider = 'anthropic';
      this.apiKey = anthropicKey;
      this.modelName = 'claude-sonnet-4-20250514';
    } else {
      this.apiProvider = 'ollama';
      this.modelName =
        this.configService.get<string>('OLLAMA_MODEL') || 'llama2';
    }

    this.logger.log(
      `Initialized ExplainerService using provider: ${this.apiProvider} with model: ${this.modelName}`,
    );
  }

  async generateExplainer(articleId: string) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      throw new Error(`Article with ID ${articleId} not found.`);
    }

    // Check if explainer already exists
    const existing = await this.prisma.explainer.findUnique({
      where: { articleId },
    });
    if (existing) {
      return existing;
    }

    const contentForPrompt = `${article.title}\n\n${article.description || ''}\n\n${article.content || ''}`;

    try {
      this.logger.log(`Extracting facts for article ${articleId}...`);
      const facts = await this.extractFacts(contentForPrompt);

      this.logger.log(`Generating headline and why it matters...`);
      const meta = await this.generateHeadlineMeta(contentForPrompt, facts);

      // Determine tier and OzScore from cluster (if article belongs to one),
      // otherwise fall back to content-length heuristic.
      let tier = 2;
      let ozScore = 0.5;

      if (article.clusterId) {
        const cluster = await this.prisma.storyCluster.findUnique({
          where: { id: article.clusterId },
          select: { ozScore: true, tier: true },
        });

        if (cluster) {
          ozScore = cluster.ozScore ?? 0.5;
          if (cluster.tier) {
            tier = cluster.tier;
          } else {
            // Derive tier from OzScore if cluster has no tier yet
            if (ozScore >= 0.7) tier = 1;
            else if (ozScore >= 0.4) tier = 2;
            else tier = 3;
          }
        }
      } else {
        // Fallback: rule-based on content length
        if (article.content && article.content.length > 5000) {
          tier = 1;
          ozScore = 0.9;
        } else if (article.content && article.content.length < 1000) {
          tier = 3;
          ozScore = 0.3;
        }
      }

      this.logger.log(`Generating explainer at Tier ${tier}...`);
      const explainerBody = await this.generateExplainerBody(meta, facts, tier);

      // Run quality guardrails
      const guardrailResult = this.runGuardrails(explainerBody, facts, tier);
      const status = guardrailResult.shouldReject ? 'draft' : 'published';
      if (guardrailResult.flags.length > 0) {
        this.logger.warn(`Guardrail flags for article ${articleId}: ${guardrailResult.flags.join(', ')}`);
      }

      // Save to database
      const newExplainer = await this.prisma.explainer.create({
        data: {
          articleId,
          tier,
          headline: meta.headline,
          whyItMatters: meta.whyItMatters,
          content: explainerBody,
          ozScore,
          status,
        },
      });

      return newExplainer;
    } catch (error) {
      this.logger.error(`Failed to generate explainer: ${error.message}`);
      throw error;
    }
  }

  private async callLlm(systemPrompt: string, userPrompt: string, maxTokens: number = 1000): Promise<string> {
    if (this.apiProvider === 'ollama') {
      const response = await fetch(this.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          system: systemPrompt,
          prompt: userPrompt,
          stream: false,
          options: {
            temperature: 0.5,
            num_predict: maxTokens
          }
        }),
      });
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }
      const data = await response.json();
      return data.response.trim();
    } else if (this.apiProvider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.5,
          max_tokens: maxTokens,
          top_p: 0.9,
        }),
      });
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }
      const data = await response.json();
      return data.choices[0].message.content.trim();
    } else if (this.apiProvider === 'anthropic') {
       const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.modelName,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.5,
          max_tokens: maxTokens,
          top_p: 0.9,
        }),
      });
      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }
      const data = await response.json();
      return data.content[0].text.trim();
    }
    
    throw new Error('No valid API provider matched.');
  }

  private async extractFacts(clusterSummary: string): Promise<string> {
    const systemPrompt = `You are a fact extraction engine for OzShorts, an Australian news service.
Given the article cluster below, extract only verified factual claims — numbers, dates, names, decisions, statements — in a structured list.
Rules:
- Extract facts only. No interpretation, no inference.
- Include: figures, percentages, named entities, direct quotes, dates, outcomes
- Flag any claims that appear in only one source as (single-source)
- Flag any figures that conflict across sources as (conflicting)
- Do not include opinion or analysis from the source articles

Output format:
FACT: [the fact]
SOURCE: [publication name]
FLAG: [single-source / conflicting / confirmed]`;
    
    return this.callLlm(systemPrompt, `ARTICLE CLUSTER:\n${clusterSummary}`, 800);
  }

  private async generateHeadlineMeta(clusterSummary: string, facts: string): Promise<{headline: string, whyItMatters: string}> {
    const systemPrompt = `Generate an OzShorts headline for the following story.
Rules:
- Maximum 12 words
- Plain English — no jargon
- Active voice
- States what happened, not why it might matter
- No question marks
- No colons
Also generate a "Why it matters" line — maximum 20 words, from the perspective of an Australian professional.

Output MUST be exactly in this format:
HEADLINE: <headline text>
WHY IT MATTERS: <why it matters text>`;
    
    const userPrompt = `STORY SUMMARY:\n${clusterSummary}\n\nFacts:\n${facts}\n\nOutput:\n`;
    const result = await this.callLlm(systemPrompt, userPrompt, 200);
    
    // Parse result
    const lines = result.split('\n');
    let headline = 'Default Headline';
    let whyItMatters = 'Why it matters not available.';
    
    for (const line of lines) {
      if (line.trim().toUpperCase().startsWith('HEADLINE:')) {
        headline = line.substring(9).trim();
      } else if (line.trim().toUpperCase().startsWith('WHY IT MATTERS:')) {
        whyItMatters = line.substring(15).trim();
      }
    }
    return { headline, whyItMatters };
  }

  private async generateExplainerBody(meta: {headline: string, whyItMatters: string}, facts: string, tier: number): Promise<string> {
    const systemPrompt = `You are OzShorts, an Australian financial and business news explainer. Your job is to write a short-form story in the style of Finshots — conversational, clear, and genuinely helpful to a busy professional who wants to understand not just what happened, but why it matters.

VOICE AND STYLE:
- Write like you are explaining the story to a smart friend, not filing a report
- Use short paragraphs. One idea per paragraph.
- Ask rhetorical questions to lead the reader forward ("But here's the thing.", "So why does this matter?")
- Use plain English. Translate jargon immediately after using it.
- Never editorialize or express an opinion. Present facts and let the reader decide.
- Avoid passive voice. Prefer "The RBA held rates" over "Rates were held by the RBA".
- Do not start paragraphs with "However", "Furthermore", or "In conclusion".
- Never write "It is worth noting that..." or "It is important to understand..."
- End with a forward-looking "what to watch" observation — not a conclusion or summary.

FORMAT:
- No markdown headers or bullet points in the output. Plain prose only.
- Paragraph breaks between every idea shift.
- Do not include a headline. That is handled separately.`;

    let userPrompt = '';
    let tokens = 500;
    
    if (tier === 1) {
      tokens = 1200;
      userPrompt = `Write a Tier 1 OzShorts Double Click explainer. Target: 500–600 words.

STORY CLUSTER:
Headline: ${meta.headline}
Why It Matters: ${meta.whyItMatters}

SOURCE FACTS (use these — do not invent figures):
${facts}

STRUCTURE TO FOLLOW:
1. Hook — open with the event, but immediately zoom out to the bigger picture
2. What happened — the core facts, cleanly stated
3. Why this company/institution did what it did — their motivation and logic
4. The other side of the story — counterparty, market, or sector perspective
5. The deeper pattern — what this reveals about a broader trend
6. Australian impact — how this lands for workers, investors, or consumers in Australia
7. What to watch — the one or two signals that will tell us what happens next

Do not label these sections. Write as continuous prose.`;
    } else if (tier === 2) {
      tokens = 700;
      userPrompt = `Write a Tier 2 OzShorts Double Click explainer. Target: 300–400 words.

STORY CLUSTER:
Headline: ${meta.headline}
Why It Matters: ${meta.whyItMatters}

SOURCE FACTS (use these — do not invent figures):
${facts}

STRUCTURE TO FOLLOW:
1. Open with the news in one sentence — then immediately explain the "so what"
2. The key context a reader needs to understand why this happened
3. Who this affects in Australia and how
4. One forward-looking signal — what to watch

Do not label these sections. Write as continuous prose.`;
    } else {
      tokens = 400;
      userPrompt = `Write a Tier 3 OzShorts Double Click explainer. Target: 150–200 words.

STORY CLUSTER:
Headline: ${meta.headline}
Why It Matters: ${meta.whyItMatters}

SOURCE FACTS:
${facts}

STRUCTURE TO FOLLOW:
1. State what happened, clearly and directly
2. Add one layer of factual context that the short card did not include
3. One sentence on what this means for Australian businesses or consumers

Do not editorialize. Do not speculate. Facts only. Do not label these sections. Write as continuous prose.`;
    }

    return this.callLlm(systemPrompt, userPrompt, tokens);
  }

  /** Generate a 50-60 word card summary for the feed card. */
  async generateCardSummary(clusterSummary: string, facts: string): Promise<string> {
    const systemPrompt = `You are OzShorts, an Australian news explainer. Write a short card summary for a news feed.`;
    const userPrompt = `Write a card summary in exactly 50–60 words. Plain English, no jargon. One paragraph. State what happened and why it matters to an Australian professional. Do not editorialize.

STORY:
${clusterSummary}

FACTS:
${facts}

Output the summary text only — no labels, no quotes.`;
    return this.callLlm(systemPrompt, userPrompt, 150);
  }

  /** Generate a full Double Click package for a cluster: headline, why it matters, card summary, and explainer body. */
  async generateForCluster(clusterId: string): Promise<{
    headline: string;
    whyItMatters: string;
    cardSummary: string;
    explainerBody: string;
    tier: number;
    guardrailFlags: string[];
  }> {
    const cluster = await this.prisma.storyCluster.findUnique({
      where: { id: clusterId },
      include: {
        articles: { orderBy: { sourceAuthority: 'desc' }, take: 5 },
      },
    });
    if (!cluster) throw new Error(`Cluster ${clusterId} not found`);

    // Build cluster summary from top articles
    const clusterSummary = cluster.articles
      .map(a => `[${a.source}] ${a.title}\n${a.description || ''}\n${a.content || a.body || ''}`)
      .join('\n---\n');

    const tier = cluster.tier ?? (cluster.ozScore >= 0.7 ? 1 : cluster.ozScore >= 0.4 ? 2 : 3);

    const facts = await this.extractFacts(clusterSummary);
    const meta = await this.generateHeadlineMeta(clusterSummary, facts);
    const explainerBody = await this.generateExplainerBody(meta, facts, tier);
    const cardSummary = await this.generateCardSummary(clusterSummary, facts);

    const guardrailResult = this.runGuardrails(explainerBody, facts, tier);

    return {
      headline: meta.headline,
      whyItMatters: meta.whyItMatters,
      cardSummary,
      explainerBody,
      tier,
      guardrailFlags: guardrailResult.flags,
    };
  }

  /**
   * Quality guardrails from Double Click Framework section 5.6.
   * Returns flags for editor review and whether to reject + regenerate.
   */
  private runGuardrails(
    content: string,
    facts: string,
    tier: number,
  ): { flags: string[]; shouldReject: boolean } {
    const flags: string[] = [];
    let shouldReject = false;

    // 1. Word count check
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const ranges: Record<number, [number, number]> = {
      1: [500, 600],
      2: [300, 400],
      3: [150, 200],
    };
    const [min, max] = ranges[tier] || [150, 600];
    if (wordCount < min || wordCount > max) {
      flags.push(`word-count-out-of-range: ${wordCount} words (target ${min}-${max})`);
    }

    // 2. Forbidden opening words
    const forbiddenStarts = ['However', 'Furthermore', 'In conclusion'];
    const sentences = content.split(/(?<=[.!?])\s+/);
    for (const s of sentences) {
      const trimmed = s.trim();
      for (const f of forbiddenStarts) {
        if (trimmed.startsWith(f)) {
          flags.push(`forbidden-opener: sentence starts with "${f}"`);
        }
      }
    }

    // 3. Forbidden phrases
    const forbiddenPhrases = [
      'It is worth noting that',
      'It is important to understand',
      'It remains to be seen',
      "In today's fast-moving",
      'Experts say',
    ];
    for (const phrase of forbiddenPhrases) {
      if (content.toLowerCase().includes(phrase.toLowerCase())) {
        flags.push(`forbidden-phrase: "${phrase}"`);
      }
    }

    // 4. Passive voice ratio estimate (simple heuristic: "was/were + past participle")
    const passivePattern = /\b(was|were|is|are|been|being)\s+\w+ed\b/gi;
    const passiveMatches = content.match(passivePattern) || [];
    const passiveRatio = sentences.length > 0 ? passiveMatches.length / sentences.length : 0;
    if (passiveRatio > 0.15) {
      flags.push(`passive-voice-high: ${Math.round(passiveRatio * 100)}%`);
    }

    // 5. Check ending — should be forward-looking, not a summary
    const lastParagraph = content.trim().split('\n\n').pop()?.trim() || '';
    const summaryEndings = ['in summary', 'in conclusion', 'to summarise', 'to sum up', 'overall'];
    for (const ending of summaryEndings) {
      if (lastParagraph.toLowerCase().includes(ending)) {
        flags.push('ending-is-summary: should be forward-looking "what to watch"');
      }
    }

    // 6. Check for figures not in fact list (simple heuristic: numbers with % or $)
    const contentNumbers = content.match(/\$?[\d,.]+%?/g) || [];
    const factNumbers = facts.match(/\$?[\d,.]+%?/g) || [];
    const factSet = new Set(factNumbers);
    for (const num of contentNumbers) {
      // Skip simple numbers like "1", "2", "3" which may be structural
      if (num.length <= 2 && !num.includes('%') && !num.includes('$')) continue;
      if (!factSet.has(num)) {
        flags.push(`ungrounded-figure: ${num} not found in fact list`);
        shouldReject = true;
      }
    }

    return { flags, shouldReject };
  }
}
