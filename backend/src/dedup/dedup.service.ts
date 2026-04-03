import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DedupService {
  private readonly logger = new Logger(DedupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Scheduled job
  // ──────────────────────────────────────────────────────────────────────────

  @Cron('*/30 * * * *')
  async handleCron(): Promise<void> {
    this.logger.log('Cron: running deduplication pass');
    await this.runDedup();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Run both dedup passes on articles from the last 2 hours.
   */
  async runDedup(): Promise<{ hashDups: number; titleDups: number }> {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const recentArticles = await this.prisma.article.findMany({
      where: {
        processed: true,
        createdAt: { gte: twoHoursAgo },
      },
      orderBy: { sourceAuthority: 'desc' },
    });

    if (recentArticles.length === 0) {
      this.logger.log('No recent processed articles to deduplicate');
      return { hashDups: 0, titleDups: 0 };
    }

    this.logger.log(`Running dedup on ${recentArticles.length} recent article(s)`);

    const hashDups = await this.hashDedup(recentArticles);
    const titleDups = await this.titleSimilarityDedup(recentArticles);

    this.logger.log(
      `Dedup complete: ${hashDups} hash duplicate(s), ${titleDups} title duplicate(s)`,
    );

    return { hashDups, titleDups };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pass 1: Hash-based dedup
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Find articles with matching dedupHash within the last 48h.
   * Keep the one with the higher sourceAuthority; mark the other as a
   * duplicate by setting clusterId = null.
   */
  private async hashDedup(
    recentArticles: {
      id: string;
      dedupHash: string | null;
      sourceAuthority: number;
      publishedAt: Date | null;
    }[],
  ): Promise<number> {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    let dupCount = 0;

    // Group recent articles by dedupHash
    const hashGroups = new Map<string, typeof recentArticles>();
    for (const article of recentArticles) {
      if (!article.dedupHash) continue;
      const existing = hashGroups.get(article.dedupHash) || [];
      existing.push(article);
      hashGroups.set(article.dedupHash, existing);
    }

    for (const [hash, group] of hashGroups) {
      // Also look for older articles with the same hash within 48h
      const olderMatches = await this.prisma.article.findMany({
        where: {
          dedupHash: hash,
          createdAt: { gte: fortyEightHoursAgo },
          id: { notIn: group.map((a) => a.id) },
        },
        select: { id: true, sourceAuthority: true },
      });

      const allMatches = [
        ...group.map((a) => ({ id: a.id, sourceAuthority: a.sourceAuthority })),
        ...olderMatches,
      ];

      if (allMatches.length <= 1) continue;

      // Sort by authority descending — keep the first, mark rest as dupes
      allMatches.sort((a, b) => b.sourceAuthority - a.sourceAuthority);
      const dupeIds = allMatches.slice(1).map((a) => a.id);

      if (dupeIds.length > 0) {
        await this.prisma.article.updateMany({
          where: { id: { in: dupeIds } },
          data: { clusterId: null },
        });
        dupCount += dupeIds.length;
        this.logger.debug(
          `Hash dedup: kept article ${allMatches[0].id}, marked ${dupeIds.length} duplicate(s) for hash "${hash.slice(0, 40)}..."`,
        );
      }
    }

    return dupCount;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pass 2: Title similarity dedup (Jaccard on word sets)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Compare titles using Jaccard similarity on word sets.
   * If similarity > 0.85 and published within 6h of each other, treat as
   * duplicates. Keep the higher authority version.
   */
  private async titleSimilarityDedup(
    recentArticles: {
      id: string;
      title: string;
      sourceAuthority: number;
      publishedAt: Date | null;
    }[],
  ): Promise<number> {
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    const SIMILARITY_THRESHOLD = 0.85;
    const markedAsDupe = new Set<string>();
    let dupCount = 0;

    // Pre-compute word sets for all articles
    const wordSets = new Map<string, Set<string>>();
    for (const article of recentArticles) {
      wordSets.set(article.id, this.titleToWordSet(article.title));
    }

    // Pairwise comparison
    for (let i = 0; i < recentArticles.length; i++) {
      const a = recentArticles[i];
      if (markedAsDupe.has(a.id)) continue;

      for (let j = i + 1; j < recentArticles.length; j++) {
        const b = recentArticles[j];
        if (markedAsDupe.has(b.id)) continue;

        // Time window check
        if (a.publishedAt && b.publishedAt) {
          const timeDiff = Math.abs(
            a.publishedAt.getTime() - b.publishedAt.getTime(),
          );
          if (timeDiff > SIX_HOURS_MS) continue;
        }

        // Jaccard similarity
        const setA = wordSets.get(a.id)!;
        const setB = wordSets.get(b.id)!;
        const similarity = this.jaccardSimilarity(setA, setB);

        if (similarity > SIMILARITY_THRESHOLD) {
          // Mark the lower-authority article as a dupe
          const dupe =
            a.sourceAuthority >= b.sourceAuthority ? b : a;

          markedAsDupe.add(dupe.id);

          await this.prisma.article.update({
            where: { id: dupe.id },
            data: { clusterId: null },
          });

          dupCount++;
          this.logger.debug(
            `Title dedup: similarity=${similarity.toFixed(2)} between "${a.title.slice(0, 50)}" and "${b.title.slice(0, 50)}"`,
          );
        }
      }
    }

    return dupCount;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Utilities
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Convert a title to a set of normalised words (lowercase, no punctuation,
   * stop words removed).
   */
  private titleToWordSet(title: string): Set<string> {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'has',
      'have',
      'had',
      'it',
      'its',
      'as',
      'from',
      'that',
      'this',
      'not',
      'will',
      'can',
      'do',
      'does',
      'did',
      'no',
      'so',
      'if',
      'up',
    ]);

    const words = title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopWords.has(w));

    return new Set(words);
  }

  /**
   * Jaccard similarity: |A intersect B| / |A union B|
   */
  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 1;
    if (a.size === 0 || b.size === 0) return 0;

    let intersection = 0;
    for (const item of a) {
      if (b.has(item)) intersection++;
    }

    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}
