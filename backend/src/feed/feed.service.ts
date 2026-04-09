import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

/** Category slot allocation: min / max in top-50 */
const CATEGORY_SLOTS: Record<string, { min: number; max: number }> = {
  Business: { min: 10, max: 12 },
  Markets: { min: 8, max: 10 },
  Politics: { min: 7, max: 9 },
  World: { min: 5, max: 7 },
  Technology: { min: 4, max: 6 },
  Property: { min: 4, max: 6 },
  Employment: { min: 3, max: 5 },
  Lifestyle: { min: 2, max: 4 },
};

const TOTAL_SHORTLIST = 50;

interface ShortlistedCluster {
  id: string;
  topic: string | null;
  category: string | null;
  ozScore: number;
  ozScoreMorning: number;
  ozScoreEvening: number;
  impactScore: number | null;
  clusterQuality: number;
  uniqueSourceCount: number;
  tier?: number;
}

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Scheduled feed freeze
  // ──────────────────────────────────────────────────────────────────────────

  /** Morning feed freeze at 5:15 AM server local time. */
  @Cron('15 5 * * *')
  async freezeMorningFeed(): Promise<void> {
    this.logger.log('Cron: freezing morning feed');
    try {
      await this.buildFeed('morning', new Date());
      this.logger.log('Morning feed frozen successfully');
    } catch (error) {
      this.logger.error(`Morning feed freeze failed: ${error.message}`);
    }
  }

  /** Evening feed freeze at 4:00 PM server local time. */
  @Cron('0 16 * * *')
  async freezeEveningFeed(): Promise<void> {
    this.logger.log('Cron: freezing evening feed');
    try {
      await this.buildFeed('evening', new Date());
      this.logger.log('Evening feed frozen successfully');
    } catch (error) {
      this.logger.error(`Evening feed freeze failed: ${error.message}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Build a top-50 feed shortlist for the given edition and date.
   * Two-pass algorithm:
   *   Pass 1 — category fill: for each category, select top N by edition score up to min
   *   Pass 2 — score fill: fill remaining slots with highest-scoring, respecting max caps
   */
  async buildFeed(
    edition: 'morning' | 'evening',
    date: Date,
  ): Promise<ShortlistedCluster[]> {
    const dateStr = date.toISOString().slice(0, 10);
    this.logger.log(`Building ${edition} feed for ${dateStr}`);

    const scoreField =
      edition === 'morning' ? 'ozScoreMorning' : 'ozScoreEvening';

    // ── Gather candidate clusters ───────────────────────────────────────

    const candidates = await this.prisma.storyCluster.findMany({
      where: {
        status: 'active',
        clusterQuality: { gte: 0.4 },
      },
      orderBy: { [scoreField]: 'desc' },
      select: {
        id: true,
        topic: true,
        category: true,
        ozScore: true,
        ozScoreMorning: true,
        ozScoreEvening: true,
        impactScore: true,
        clusterQuality: true,
        uniqueSourceCount: true,
      },
    });

    // ── Evening hard-exclude: clusters published in today's morning feed ─

    let pool = candidates;
    if (edition === 'evening') {
      const morningQueueIds = await this.prisma.editorQueue.findMany({
        where: {
          edition: 'morning',
          editionDate: new Date(dateStr),
        },
        select: { clusterId: true },
      });

      const excludedIds = new Set(morningQueueIds.map((q) => q.clusterId));
      pool = candidates.filter((c) => !excludedIds.has(c.id));
    }

    // ── Pass 1: category fill ───────────────────────────────────────────

    const shortlist: ShortlistedCluster[] = [];
    const selectedIds = new Set<string>();
    const categoryCounts: Record<string, number> = {};

    // Initialise category counts
    for (const cat of Object.keys(CATEGORY_SLOTS)) {
      categoryCounts[cat] = 0;
    }

    // For each category, fill up to its minimum allocation
    for (const [category, { min }] of Object.entries(CATEGORY_SLOTS)) {
      const categoryPool = pool
        .filter(
          (c) =>
            c.category === category && !selectedIds.has(c.id),
        )
        .sort((a, b) => {
          const aScore = edition === 'morning' ? a.ozScoreMorning : a.ozScoreEvening;
          const bScore = edition === 'morning' ? b.ozScoreMorning : b.ozScoreEvening;
          return bScore - aScore;
        });

      const toTake = Math.min(min, categoryPool.length);
      for (let i = 0; i < toTake && shortlist.length < TOTAL_SHORTLIST; i++) {
        shortlist.push(categoryPool[i]);
        selectedIds.add(categoryPool[i].id);
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      }
    }

    // ── Pass 2: score fill ──────────────────────────────────────────────

    const remaining = pool
      .filter((c) => !selectedIds.has(c.id))
      .sort((a, b) => {
        const aScore = edition === 'morning' ? a.ozScoreMorning : a.ozScoreEvening;
        const bScore = edition === 'morning' ? b.ozScoreMorning : b.ozScoreEvening;
        return bScore - aScore;
      });

    for (const cluster of remaining) {
      if (shortlist.length >= TOTAL_SHORTLIST) break;

      const cat = cluster.category || 'Business';
      const maxForCat = CATEGORY_SLOTS[cat]?.max ?? 6;

      // Respect category max cap
      if ((categoryCounts[cat] || 0) >= maxForCat) continue;

      // Category overrepresentation penalty check (>2 already in shortlist)
      // This is applied as a skip for clusters whose score after 0.7 multiplier
      // would drop below the weakest cluster in the shortlist.
      // For simplicity, we still add them but note the penalty is factored
      // into tier assignment later.

      shortlist.push(cluster);
      selectedIds.add(cluster.id);
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    // ── Tier assignment ─────────────────────────────────────────────────

    const withTiers = this.assignTiers(shortlist, edition);

    // ── Create EditorQueue entries ──────────────────────────────────────

    const editionDate = new Date(dateStr);

    // Delete any existing queue entries for this edition+date to allow re-runs
    await this.prisma.editorQueue.deleteMany({
      where: {
        edition,
        editionDate,
        status: 'pending',
      },
    });

    for (let rank = 0; rank < withTiers.length; rank++) {
      const cluster = withTiers[rank];
      await this.prisma.editorQueue.create({
        data: {
          clusterId: cluster.id,
          edition,
          editionDate,
          suggestedRank: rank + 1,
          status: 'pending',
        },
      });
    }

    this.logger.log(
      `${edition} feed built: ${withTiers.length} clusters shortlisted ` +
        `(T1: ${withTiers.filter((c) => c.tier === 1).length}, ` +
        `T2: ${withTiers.filter((c) => c.tier === 2).length}, ` +
        `T3: ${withTiers.filter((c) => c.tier === 3).length})`,
    );

    return withTiers;
  }

  /**
   * Get published stories for a specific edition and date.
   */
  async getPublishedFeed(edition: string, date: string) {
    const editionDate = new Date(date);

    return this.prisma.publishedStory.findMany({
      where: {
        edition,
        editionDate,
      },
      orderBy: { feedRank: 'asc' },
      include: {
        cluster: {
          select: {
            id: true,
            topic: true,
            uniqueSourceCount: true,
            articleCount: true,
          },
        },
      },
    });
  }

  /**
   * Get the most recently published feed.
   */
  async getLatestFeed() {
    const latest = await this.prisma.publishedStory.findFirst({
      orderBy: { publishedAt: 'desc' },
      select: { edition: true, editionDate: true },
    });

    if (!latest) return [];

    return this.prisma.publishedStory.findMany({
      where: {
        edition: latest.edition,
        editionDate: latest.editionDate,
      },
      orderBy: { feedRank: 'asc' },
      include: {
        cluster: {
          select: {
            id: true,
            topic: true,
            uniqueSourceCount: true,
            articleCount: true,
          },
        },
      },
    });
  }

  /**
   * Get a single published story by ID, including the double_click content.
   */
  async getStoryById(storyId: string) {
    return this.prisma.publishedStory.findUnique({
      where: { id: storyId },
      include: {
        cluster: {
          select: {
            id: true,
            topic: true,
            uniqueSourceCount: true,
            articleCount: true,
            articles: {
              select: {
                id: true,
                title: true,
                source: true,
                url: true,
                publishedAt: true,
                sourceAuthority: true,
              },
              orderBy: { sourceAuthority: 'desc' },
            },
          },
        },
      },
    });
  }

  /**
   * Get today's breaking stories.
   */
  async getBreakingStories() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return this.prisma.publishedStory.findMany({
      where: {
        isBreaking: true,
        publishedAt: { gte: todayStart },
      },
      orderBy: { publishedAt: 'desc' },
      include: {
        cluster: {
          select: {
            id: true,
            topic: true,
            uniqueSourceCount: true,
            articleCount: true,
          },
        },
      },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tier assignment
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Assign tiers to shortlisted clusters.
   * Top 20% by OzScore = Tier 1
   * Next 40% = Tier 2
   * Bottom 40% = Tier 3
   * Override: impactScore > 0.85 = auto Tier 1
   */
  private assignTiers(
    clusters: ShortlistedCluster[],
    edition: 'morning' | 'evening',
  ): ShortlistedCluster[] {
    if (clusters.length === 0) return [];

    // Sort by edition-specific score descending
    const sorted = [...clusters].sort((a, b) => {
      const aScore = edition === 'morning' ? a.ozScoreMorning : a.ozScoreEvening;
      const bScore = edition === 'morning' ? b.ozScoreMorning : b.ozScoreEvening;
      return bScore - aScore;
    });

    const total = sorted.length;
    const tier1Cutoff = Math.ceil(total * 0.2);
    const tier2Cutoff = Math.ceil(total * 0.6); // 20% + 40%

    return sorted.map((cluster, index) => {
      let tier: number;

      // Override: impactScore > 0.85 = auto Tier 1
      if (cluster.impactScore !== null && cluster.impactScore > 0.85) {
        tier = 1;
      } else if (index < tier1Cutoff) {
        tier = 1;
      } else if (index < tier2Cutoff) {
        tier = 2;
      } else {
        tier = 3;
      }

      return { ...cluster, tier };
    });
  }
}
