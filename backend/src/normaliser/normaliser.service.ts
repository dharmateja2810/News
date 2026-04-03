import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NormaliserService {
  private readonly logger = new Logger(NormaliserService.name);

  // ── Publisher suffixes to strip from titles ────────────────────────────────
  private readonly TITLE_SUFFIXES = [
    / \| AFR$/i,
    / \| Australian Financial Review$/i,
    / - ABC News$/i,
    / \| ABC News$/i,
    / - BBC News$/i,
    / \| BBC News$/i,
    / - Reuters$/i,
    / \| Reuters$/i,
    / - The Guardian$/i,
    / \| The Guardian$/i,
    / - SBS News$/i,
    / \| SBS News$/i,
    / - The Sydney Morning Herald$/i,
    / \| The Sydney Morning Herald$/i,
    / - The Age$/i,
    / \| The Age$/i,
    / - Nine News$/i,
    / \| Nine News$/i,
    / - news\.com\.au$/i,
    / \| news\.com\.au$/i,
    / - Sky News Australia$/i,
    / \| Sky News Australia$/i,
    / - The Australian$/i,
    / \| The Australian$/i,
    / - Bloomberg$/i,
    / \| Bloomberg$/i,
    / - CNBC$/i,
    / \| CNBC$/i,
    / - AP News$/i,
    / \| AP News$/i,
  ];

  // ── Byline patterns ──────────────────────────────────────────────────────
  private readonly BYLINE_PATTERNS = [
    /^By [A-Z][a-z]+ [A-Z][a-z]+[,:]?\s*/,
  ];

  // ── Opinion keywords (case-insensitive match against title) ───────────────
  private readonly OPINION_KEYWORDS = [
    'opinion',
    'analysis',
    'comment',
    'column',
    'editorial',
  ];

  // ── Category keyword maps ────────────────────────────────────────────────
  private readonly CATEGORY_RULES: {
    category: string;
    appCategory: string;
    pattern: RegExp;
  }[] = [
    {
      category: 'business_companies',
      appCategory: 'Business',
      pattern:
        /\b(company|corporate|merger|acquisition|ceo|board|shareholder|dividend|profit|revenue|bhp|rio tinto|woodside|wesfarmers|woolworths|cba|nab|anz|westpac|macquarie|telstra|qantas)\b/i,
    },
    {
      category: 'markets_economy',
      appCategory: 'Business',
      pattern:
        /\b(market|stock|share|asx|wall street|dow|nasdaq|s&p|bond|yield|rba|interest rate|inflation|gdp|recession|economy|economic|reserve bank|monetary policy|fiscal)\b/i,
    },
    {
      category: 'property_housing',
      appCategory: 'Business',
      pattern:
        /\b(property|housing|real estate|mortgage|rent|auction|dwelling|apartment|house price|home loan|corelogic|domain|realestate)\b/i,
    },
    {
      category: 'politics_policy',
      appCategory: 'Politics',
      pattern:
        /\b(government|parliament|minister|election|labor|liberal|coalition|albanese|dutton|policy|legislation|budget|senate|regulation|tax reform)\b/i,
    },
    {
      category: 'world_news',
      appCategory: 'World',
      pattern:
        /\b(ukraine|russia|china|usa|us president|nato|un |united nations|middle east|gaza|israel|war|geopolitical|summit|diplomatic|trade war|sanctions)\b/i,
    },
    {
      category: 'tech_innovation',
      appCategory: 'Technology',
      pattern:
        /\b(ai|artificial intelligence|machine learning|tech|startup|software|cyber|quantum|chip|semiconductor|apple|google|microsoft|meta|amazon|openai)\b/i,
    },
    {
      category: 'employment_wages',
      appCategory: 'Business',
      pattern:
        /\b(job|employment|unemployment|wage|salary|workforce|hiring|layoff|redundan|fair work|union|industrial action|strike|work from home|remote work)\b/i,
    },
    {
      category: 'lifestyle_general',
      appCategory: 'Entertainment',
      pattern:
        /\b(lifestyle|travel|food|wine|fashion|wellness|fitness|culture|art|music|film|streaming|celebrity|restaurant)\b/i,
    },
  ];

  // ── Australian entity patterns ────────────────────────────────────────────
  private readonly AU_ORGS = [
    'RBA',
    'Reserve Bank of Australia',
    'ASX',
    'APRA',
    'ASIC',
    'ATO',
    'ACCC',
    'ABC',
    'SBS',
    'BHP',
    'CBA',
    'Commonwealth Bank',
    'ANZ',
    'Westpac',
    'NAB',
    'National Australia Bank',
    'Macquarie Group',
    'Telstra',
    'Optus',
    'Qantas',
    'Virgin Australia',
    'Woolworths',
    'Coles',
    'Wesfarmers',
    'Rio Tinto',
    'Woodside',
    'Fortescue',
    'CSL',
    'Atlassian',
    'Afterpay',
    'Canva',
    'Nine Entertainment',
    'News Corp',
    'Transurban',
    'AGL',
    'Origin Energy',
    'Santos',
  ];

  private readonly AU_GPES = [
    'Australia',
    'Sydney',
    'Melbourne',
    'Brisbane',
    'Perth',
    'Adelaide',
    'Canberra',
    'Hobart',
    'Darwin',
    'Gold Coast',
    'Newcastle',
    'Wollongong',
    'Geelong',
    'Cairns',
    'Townsville',
    'New South Wales',
    'NSW',
    'Victoria',
    'Queensland',
    'Western Australia',
    'South Australia',
    'Tasmania',
    'Northern Territory',
    'ACT',
  ];

  private readonly AU_PERSONS = [
    'Anthony Albanese',
    'Albanese',
    'Peter Dutton',
    'Dutton',
    'Jim Chalmers',
    'Chalmers',
    'Michele Bullock',
    'Bullock',
    'Philip Lowe',
    'Chris Minns',
    'Jacinta Allan',
    'Steven Miles',
    'Roger Cook',
    'Peter Malinauskas',
    'Andrew Barr',
    'Jeremy Rockliff',
    'Gina Rinehart',
    'Andrew Forrest',
    'Mike Cannon-Brookes',
    'Scott Farquhar',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Scheduled job
  // ──────────────────────────────────────────────────────────────────────────

  @Cron('*/5 * * * *')
  async handleCron(): Promise<void> {
    this.logger.log('Cron: processing unprocessed articles');
    await this.processUnprocessed();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Find all unprocessed articles and run processArticle on each.
   */
  async processUnprocessed(): Promise<number> {
    const articles = await this.prisma.article.findMany({
      where: { processed: false },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 200, // batch cap to avoid overloading
    });

    if (articles.length === 0) {
      this.logger.log('No unprocessed articles found');
      return 0;
    }

    this.logger.log(`Processing ${articles.length} unprocessed article(s)`);

    let processed = 0;
    for (const article of articles) {
      try {
        await this.processArticle(article.id);
        processed++;
      } catch (error) {
        this.logger.error(
          `Failed to process article ${article.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(`Successfully processed ${processed}/${articles.length} article(s)`);
    return processed;
  }

  /**
   * Run all normalisation steps on a single article and mark it as processed.
   */
  async processArticle(articleId: string): Promise<void> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      this.logger.warn(`Article ${articleId} not found — skipping`);
      return;
    }

    // ── 1. Text cleaning ─────────────────────────────────────────────────
    const cleanedTitle = this.cleanTitle(article.title);
    const cleanedDescription = this.cleanText(article.description || '');

    // ── 2. Opinion detection ─────────────────────────────────────────────
    const isOpinion = this.detectOpinion(cleanedTitle);

    // ── 3. Category detection ────────────────────────────────────────────
    const category = this.detectCategory(cleanedTitle, cleanedDescription);

    // ── 4. Entity extraction ─────────────────────────────────────────────
    const entities = this.extractEntities(cleanedTitle, cleanedDescription);

    // ── 5. Generate dedup hash ───────────────────────────────────────────
    const dedupHash = this.generateDedupHash(cleanedTitle);

    // ── 6. Persist ───────────────────────────────────────────────────────
    await this.prisma.article.update({
      where: { id: articleId },
      data: {
        title: cleanedTitle,
        description: cleanedDescription || null,
        isOpinion,
        category,
        entities,
        dedupHash,
        processed: true,
      },
    });

    this.logger.debug(`Article ${articleId} processed: category=${category}, opinion=${isOpinion}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Text cleaning
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Strip HTML tags, normalise quotes/dashes, and remove publisher suffixes
   * and bylines from a title.
   */
  private cleanTitle(title: string): string {
    let cleaned = this.cleanText(title);

    // Strip publisher suffixes
    for (const suffix of this.TITLE_SUFFIXES) {
      cleaned = cleaned.replace(suffix, '');
    }

    // Strip bylines
    for (const pattern of this.BYLINE_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.trim();
  }

  /**
   * Strip HTML tags and normalise typographic characters.
   */
  private cleanText(text: string): string {
    // Strip HTML tags
    let cleaned = text.replace(/<[^>]*>/g, '');

    // Normalise smart quotes
    cleaned = cleaned.replace(/[\u2018\u2019]/g, "'");
    cleaned = cleaned.replace(/[\u201C\u201D]/g, '"');

    // Normalise dashes
    cleaned = cleaned.replace(/[\u2013\u2014]/g, '-');

    // Normalise whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Strip HTML entities
    cleaned = cleaned.replace(/&amp;/g, '&');
    cleaned = cleaned.replace(/&lt;/g, '<');
    cleaned = cleaned.replace(/&gt;/g, '>');
    cleaned = cleaned.replace(/&quot;/g, '"');
    cleaned = cleaned.replace(/&#39;/g, "'");
    cleaned = cleaned.replace(/&nbsp;/g, ' ');

    return cleaned.trim();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Opinion detection
  // ──────────────────────────────────────────────────────────────────────────

  private detectOpinion(title: string): boolean {
    const lowerTitle = title.toLowerCase();
    return this.OPINION_KEYWORDS.some((keyword) =>
      new RegExp(`\\b${keyword}\\b`, 'i').test(lowerTitle),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Category detection
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Keyword-based classification. Returns the fine-grained pipeline category
   * but falls back to an app-level category for the `category` field.
   */
  private detectCategory(title: string, description: string): string {
    const text = `${title} ${description}`;

    for (const rule of this.CATEGORY_RULES) {
      if (rule.pattern.test(text)) {
        return rule.appCategory;
      }
    }

    // Fallback: keep existing heuristics from ArticlesService
    return 'Business';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Entity extraction
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Simple regex/string-matching entity extraction for Australian entities.
   * Returns JSON-compatible object: { orgs: [], gpes: [], persons: [] }
   */
  private extractEntities(
    title: string,
    description: string,
  ): { orgs: string[]; gpes: string[]; persons: string[] } {
    const text = `${title} ${description}`;

    const orgs = this.AU_ORGS.filter((org) =>
      new RegExp(`\\b${this.escapeRegex(org)}\\b`, 'i').test(text),
    );

    const gpes = this.AU_GPES.filter((gpe) =>
      new RegExp(`\\b${this.escapeRegex(gpe)}\\b`, 'i').test(text),
    );

    const persons = this.AU_PERSONS.filter((person) =>
      new RegExp(`\\b${this.escapeRegex(person)}\\b`, 'i').test(text),
    );

    return { orgs, gpes, persons };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Dedup hash
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Lowercase title, strip punctuation, collapse whitespace, take first 80 chars.
   */
  private generateDedupHash(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Utilities
  // ──────────────────────────────────────────────────────────────────────────

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
