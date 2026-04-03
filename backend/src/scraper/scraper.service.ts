import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as Parser from 'rss-parser';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly parser: Parser;

  /** Australian-relevance keywords (case-insensitive match against title + summary). */
  private readonly AU_ENTITIES = [
    'RBA',
    'ASX',
    'ATO',
    'APRA',
    'ASIC',
    'BHP',
    'CBA',
    'ANZ',
    'Westpac',
    'NAB',
    'Macquarie',
    'Woodside',
    'Rio Tinto',
    'Wesfarmers',
    'Woolworths',
    'Australia',
    'Australian',
    'AUD',
    'Sydney',
    'Melbourne',
    'Brisbane',
    'Perth',
    'Adelaide',
    'Canberra',
  ];

  /** Global macro terms that are still relevant to Australian audiences. */
  private readonly GLOBAL_MACRO_TERMS = [
    'Fed rates',
    'oil prices',
    'China GDP',
  ];

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.parser = new Parser({
      timeout: 15_000,
      headers: {
        'User-Agent': 'DailyDigest-Scraper/1.0',
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Scheduled jobs
  // ──────────────────────────────────────────────────────────────────────────────

  /** High-priority sources (scrapeInterval <= 15 min). */
  @Cron('*/15 * * * *')
  async scrapeHighPriority(): Promise<void> {
    this.logger.log('Cron: scraping high-priority sources (interval <= 15 min)');
    const sources = await this.prisma.source.findMany({
      where: { isActive: true, scrapeInterval: { lte: 15 } },
    });
    for (const source of sources) {
      await this.scrapeSourceInternal(source);
    }
  }

  /** Standard sources (scrapeInterval > 15 min). */
  @Cron('*/30 * * * *')
  async scrapeStandard(): Promise<void> {
    this.logger.log('Cron: scraping standard sources (interval > 15 min)');
    const sources = await this.prisma.source.findMany({
      where: { isActive: true, scrapeInterval: { gt: 15 } },
    });
    for (const source of sources) {
      await this.scrapeSourceInternal(source);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Public API (called by controller / other services)
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Scrape a single source by its slug.
   * Returns the number of new articles inserted.
   */
  async scrapeSource(sourceSlug: string): Promise<number> {
    const source = await this.prisma.source.findUnique({
      where: { slug: sourceSlug },
    });

    if (!source) {
      throw new Error(`Source with slug "${sourceSlug}" not found`);
    }

    return this.scrapeSourceInternal(source);
  }

  /**
   * Scrape every active source.
   * Returns a summary map of slug -> articles inserted.
   */
  async scrapeAllActive(): Promise<Record<string, number>> {
    const sources = await this.prisma.source.findMany({
      where: { isActive: true },
    });

    const results: Record<string, number> = {};
    for (const source of sources) {
      results[source.slug] = await this.scrapeSourceInternal(source);
    }
    return results;
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Core scraping logic
  // ──────────────────────────────────────────────────────────────────────────────

  private async scrapeSourceInternal(source: {
    id: string;
    name: string;
    slug: string;
    rssUrl: string | null;
    authorityScore: number;
    requiresAuFilter: boolean;
    isPaywalled: boolean;
  }): Promise<number> {
    if (!source.rssUrl) {
      this.logger.warn(`Source "${source.slug}" has no RSS URL — skipping`);
      return 0;
    }

    let feed: Parser.Output<Record<string, unknown>>;
    try {
      feed = await this.parser.parseURL(source.rssUrl);
    } catch (error) {
      this.logger.error(
        `Failed to fetch RSS for "${source.slug}": ${error.message}`,
      );
      return 0;
    }

    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
    let inserted = 0;

    for (const item of feed.items) {
      try {
        // ── Age gate ──────────────────────────────────────────────────────
        const publishedAt = item.pubDate
          ? new Date(item.pubDate)
          : item.isoDate
            ? new Date(item.isoDate)
            : null;

        if (publishedAt && publishedAt < cutoff) {
          continue; // older than 48 h
        }

        // ── Source URL / link ─────────────────────────────────────────────
        const sourceUrl = item.link?.trim();
        if (!sourceUrl) {
          continue; // no link — nothing to store
        }

        // ── Duplicate check (url is unique in the articles table) ─────────
        const existing = await this.prisma.article.findUnique({
          where: { url: sourceUrl },
        });
        if (existing) {
          continue;
        }

        // ── Australian relevance filter ───────────────────────────────────
        const title = (item.title || '').trim();
        const summary = (
          item.contentSnippet ||
          item.content ||
          item.summary ||
          ''
        ).trim();

        if (source.requiresAuFilter && !this.passesAuFilter(title, summary)) {
          continue;
        }

        // ── Dedup hash ────────────────────────────────────────────────────
        const dedupHash = this.generateDedupHash(title);

        // ── Derive a category from title + summary (best-effort) ──────────
        const category = this.deriveCategory(title, summary);

        // ── Persist ───────────────────────────────────────────────────────
        await this.prisma.article.create({
          data: {
            title,
            description: summary || null,
            url: sourceUrl,
            source: source.name,
            category,
            author:
              ((item.creator as string) || item.author || null) as
              | string
              | null,
            publishedAt: publishedAt || new Date(),
            imageUrl: this.extractImageUrl(item),
            sourceAuthority: source.authorityScore,
            isPaywalled: source.isPaywalled,
            dedupHash,
            processed: false,
          },
        });

        inserted++;
      } catch (error) {
        // Log and continue so one bad entry does not abort the whole feed.
        this.logger.error(
          `Error processing item "${item.title}" from "${source.slug}": ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Source "${source.slug}": ${inserted} new article(s) inserted from ${feed.items.length} item(s)`,
    );
    return inserted;
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────────

  /**
   * Generate a dedup hash: lowercase, strip punctuation, collapse whitespace,
   * take first 80 characters.
   */
  private generateDedupHash(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // strip punctuation
      .replace(/\s+/g, ' ') // collapse whitespace
      .trim()
      .slice(0, 80);
  }

  /**
   * Returns `true` if the title + summary contain at least one Australian
   * entity OR one global macro term. Sources flagged with `requiresAuFilter`
   * must pass this check.
   */
  private passesAuFilter(title: string, summary: string): boolean {
    const text = `${title} ${summary}`.toLowerCase();

    const hasAuEntity = this.AU_ENTITIES.some((entity) =>
      text.includes(entity.toLowerCase()),
    );
    if (hasAuEntity) return true;

    const hasGlobalMacro = this.GLOBAL_MACRO_TERMS.some((term) =>
      text.includes(term.toLowerCase()),
    );
    return hasGlobalMacro;
  }

  /**
   * Best-effort category derivation from title + summary text using keyword
   * heuristics (mirrors ArticlesService.normalizeCategory).
   */
  private deriveCategory(title: string, summary: string): string {
    const text = `${title} ${summary}`.toLowerCase();
    const has = (re: RegExp) => re.test(text);

    if (
      has(
        /\b(ai|machine learning|chip|apple|google|microsoft|cyber|software|startup|tech|quantum)\b/,
      )
    )
      return 'Technology';
    if (
      has(
        /\b(stock|market|asx|profit|earnings|rates|bank|economy|inflation|company|merger)\b/,
      )
    )
      return 'Business';
    if (
      has(
        /\b(match|league|tournament|championship|olympic|soccer|football|cricket|tennis)\b/,
      )
    )
      return 'Sports';
    if (has(/\b(health|hospital|cancer|vaccine|disease|medical|wellbeing)\b/))
      return 'Health';
    if (has(/\b(science|research|space|telescope|climate|biology|physics)\b/))
      return 'Science';
    if (has(/\b(movie|music|streaming|celebrity|entertainment)\b/))
      return 'Entertainment';
    if (
      has(
        /\b(election|government|parliament|policy|diplomatic|minister|politics)\b/,
      )
    )
      return 'Politics';

    return 'Business'; // sensible default for a finance-focused app
  }

  /**
   * Try to pull an image URL from the RSS item's media or enclosure fields.
   */
  private extractImageUrl(
    item: Parser.Item & Record<string, unknown>,
  ): string | undefined {
    // media:content or media:thumbnail (rss-parser exposes these under various keys)
    const media = item['media:content'] as
      | { $?: { url?: string } }
      | undefined;
    if (media?.$?.url) return media.$.url;

    const thumbnail = item['media:thumbnail'] as
      | { $?: { url?: string } }
      | undefined;
    if (thumbnail?.$?.url) return thumbnail.$.url;

    // Enclosure (common in podcasts / media feeds)
    const enclosure = item.enclosure as { url?: string } | undefined;
    if (enclosure?.url) return enclosure.url;

    return undefined;
  }
}
