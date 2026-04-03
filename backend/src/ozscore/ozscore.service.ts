import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

/** Shape of the entities JSON stored on each article. */
interface ArticleEntities {
  orgs: string[];
  gpes: string[];
  persons: string[];
}

/** Default weight set (base OzScore). */
const BASE_WEIGHTS = {
  I: 0.24,
  V: 0.18,
  A: 0.14,
  R: 0.12,
  F: 0.10,
  N: 0.08,
  E: 0.08,
  S: 0.06,
};

/** Morning edition weights. */
const MORNING_WEIGHTS = {
  I: 0.26,
  V: 0.18,
  A: 0.14,
  R: 0.12,
  F: 0.14,
  N: 0.06,
  E: 0.06,
  S: 0.04,
};

/** Evening edition weights. */
const EVENING_WEIGHTS = {
  I: 0.22,
  V: 0.16,
  A: 0.14,
  R: 0.12,
  F: 0.06,
  N: 0.16,
  E: 0.12,
  S: 0.02,
};

/** Keywords that signal high impact (financial/rate/budget/policy). */
const HIGH_IMPACT_KEYWORDS = [
  'interest rate',
  'rate cut',
  'rate hike',
  'inflation',
  'budget',
  'fiscal',
  'monetary policy',
  'rba',
  'reserve bank',
  'tax',
  'tariff',
  'regulation',
  'policy',
  'financial',
  'deficit',
  'surplus',
  'stimulus',
  'subsidy',
  'levy',
];

/** Keywords that signal medium impact (business/market). */
const MEDIUM_IMPACT_KEYWORDS = [
  'business',
  'market',
  'profit',
  'revenue',
  'earnings',
  'ipo',
  'merger',
  'acquisition',
  'shares',
  'stock',
  'asx',
  'company',
  'corporate',
  'investment',
  'venture',
];

/** Australian entity keywords for AU-relevance scoring. */
const AU_ENTITIES = [
  'australia',
  'australian',
  'aud',
  'rba',
  'asx',
  'ato',
  'apra',
  'asic',
  'bhp',
  'cba',
  'anz',
  'westpac',
  'nab',
  'macquarie',
  'woodside',
  'rio tinto',
  'wesfarmers',
  'woolworths',
  'sydney',
  'melbourne',
  'brisbane',
  'perth',
  'adelaide',
  'canberra',
  'nsw',
  'vic',
  'qld',
  'queensland',
  'victoria',
  'new south wales',
];

/** Keywords signalling engagement (money/career/housing). */
const HIGH_ENGAGEMENT_KEYWORDS = [
  'salary',
  'wage',
  'income',
  'mortgage',
  'rent',
  'housing',
  'property',
  'superannuation',
  'super',
  'pension',
  'cost of living',
  'price',
  'energy bill',
  'grocery',
  'insurance',
  'career',
  'job',
  'employment',
  'money',
  'savings',
  'debt',
  'loan',
];

const MEDIUM_ENGAGEMENT_KEYWORDS = [
  'business',
  'market',
  'investment',
  'trade',
  'economy',
  'growth',
  'sector',
  'industry',
];

/** Categories that count as strategic fit. */
const STRATEGIC_CATEGORIES = [
  'business',
  'economy',
  'property',
  'policy',
  'markets',
  'finance',
  'employment',
];

/** Government / regulator entities that trigger a boost. */
const GOVT_ENTITIES = [
  'rba',
  'reserve bank',
  'ato',
  'australian taxation office',
  'federal government',
  'federal budget',
  'treasurer',
  'prime minister',
  'apra',
  'asic',
  'accc',
];

/** Consumer financial impact keywords. */
const CONSUMER_FINANCE_KEYWORDS = [
  'mortgage',
  'rent',
  'cost of living',
  'energy bill',
  'grocery',
  'insurance',
  'superannuation',
  'super',
  'tax cut',
  'tax increase',
  'rate cut',
  'rate hike',
  'price rise',
  'price drop',
];

@Injectable()
export class OzscoreService {
  private readonly logger = new Logger(OzscoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Scheduled job — runs every 30 minutes (after clustering)
  // ──────────────────────────────────────────────────────────────────────────

  @Cron('*/30 * * * *')
  async handleCron(): Promise<void> {
    this.logger.log('Cron: running OzScore scoring pass');
    await this.scoreAllActive();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Score all active clusters.
   */
  async scoreAllActive(): Promise<number> {
    const clusters = await this.prisma.storyCluster.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    this.logger.log(`Scoring ${clusters.length} active cluster(s)`);

    let scored = 0;
    for (const cluster of clusters) {
      try {
        await this.scoreCluster(cluster.id);
        scored++;
      } catch (error) {
        this.logger.error(
          `Failed to score cluster ${cluster.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(`Scoring complete: ${scored}/${clusters.length} scored`);
    return scored;
  }

  /**
   * Calculate all scores for a single cluster and persist them.
   */
  async scoreCluster(clusterId: string): Promise<{
    ozScore: number;
    ozScoreMorning: number;
    ozScoreEvening: number;
  }> {
    const cluster = await this.prisma.storyCluster.findUnique({
      where: { id: clusterId },
      include: {
        articles: {
          select: {
            id: true,
            title: true,
            source: true,
            sourceAuthority: true,
            entities: true,
            category: true,
            publishedAt: true,
          },
        },
        publishedStories: {
          select: {
            id: true,
            edition: true,
            editionDate: true,
            publishedAt: true,
          },
        },
      },
    });

    if (!cluster) {
      throw new Error(`Cluster ${clusterId} not found`);
    }

    // ── Compute individual signal scores ────────────────────────────────

    const topicText = (cluster.topic || '').toLowerCase();
    const allArticleText = cluster.articles
      .map((a) => a.title.toLowerCase())
      .join(' ');
    const combinedText = `${topicText} ${allArticleText}`;

    // I — Impact
    const impactScore = this.computeImpact(combinedText);

    // V — Velocity
    const velocity = Math.min(cluster.uniqueSourceCount / 10, 1.0);

    // A — Authority
    const authority = this.computeAuthority(cluster.articles);

    // R — AU Relevance
    const auRelevanceScore = this.computeAuRelevance(cluster.articles);

    // F — Freshness
    const freshness = this.computeFreshness(cluster.firstSeenAt);

    // N — Novelty
    const novelty = this.computeNovelty(cluster.publishedStories);

    // E — Engagement
    const engagementScore = this.computeEngagement(combinedText);

    // S — Strategic Fit
    const strategicFit = this.computeStrategicFit(cluster.category);

    const signals = {
      I: impactScore,
      V: velocity,
      A: authority,
      R: auRelevanceScore,
      F: freshness,
      N: novelty,
      E: engagementScore,
      S: strategicFit,
    };

    // ── Weighted sums ───────────────────────────────────────────────────

    let ozScore = this.weightedSum(signals, BASE_WEIGHTS);
    let ozScoreMorning = this.weightedSum(signals, MORNING_WEIGHTS);
    let ozScoreEvening = this.weightedSum(signals, EVENING_WEIGHTS);

    // ── Adjustments (boosts) ────────────────────────────────────────────

    const boost = this.computeBoosts(combinedText, cluster.uniqueSourceCount);
    ozScore += boost;
    ozScoreMorning += boost;
    ozScoreEvening += boost;

    // ── Adjustments (penalties) ─────────────────────────────────────────

    const penaltyMultiplier = this.computePenalties(
      cluster.publishedStories,
      cluster.clusterQuality,
    );

    ozScore *= penaltyMultiplier;
    ozScoreMorning *= penaltyMultiplier;
    ozScoreEvening *= penaltyMultiplier;

    // Clamp to [0, 1]
    ozScore = Math.max(0, Math.min(1, ozScore));
    ozScoreMorning = Math.max(0, Math.min(1, ozScoreMorning));
    ozScoreEvening = Math.max(0, Math.min(1, ozScoreEvening));

    // ── Persist ─────────────────────────────────────────────────────────

    await this.prisma.storyCluster.update({
      where: { id: clusterId },
      data: {
        ozScore,
        ozScoreMorning,
        ozScoreEvening,
        impactScore,
        auRelevanceScore,
        engagementScore,
      },
    });

    this.logger.debug(
      `Cluster ${clusterId}: ozScore=${ozScore.toFixed(3)} ` +
        `morning=${ozScoreMorning.toFixed(3)} evening=${ozScoreEvening.toFixed(3)}`,
    );

    return { ozScore, ozScoreMorning, ozScoreEvening };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Signal computation helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * I — Impact heuristic:
   * financial/rate/budget/policy keywords → 0.8
   * business/market keywords → 0.6
   * else → 0.4
   */
  private computeImpact(text: string): number {
    if (HIGH_IMPACT_KEYWORDS.some((kw) => text.includes(kw))) {
      return 0.8;
    }
    if (MEDIUM_IMPACT_KEYWORDS.some((kw) => text.includes(kw))) {
      return 0.6;
    }
    return 0.4;
  }

  /**
   * A — Authority: mean sourceAuthority of all articles in the cluster.
   */
  private computeAuthority(
    articles: { sourceAuthority: number }[],
  ): number {
    if (articles.length === 0) return 0.5;
    const sum = articles.reduce((acc, a) => acc + a.sourceAuthority, 0);
    return sum / articles.length;
  }

  /**
   * R — AU Relevance: count of AU entity mentions across cluster articles
   * divided by (total entity count + 1), capped at 1.0.
   */
  private computeAuRelevance(
    articles: { entities: unknown }[],
  ): number {
    let auEntityCount = 0;
    let totalEntityCount = 0;

    for (const article of articles) {
      const entities = this.parseEntities(article.entities);
      const allEntities = [
        ...entities.orgs,
        ...entities.gpes,
        ...entities.persons,
      ];
      totalEntityCount += allEntities.length;

      for (const entity of allEntities) {
        const lower = entity.toLowerCase();
        if (AU_ENTITIES.some((au) => lower.includes(au))) {
          auEntityCount++;
        }
      }
    }

    return Math.min(auEntityCount / (totalEntityCount + 1), 1.0);
  }

  /**
   * F — Freshness: time decay based on firstSeenAt.
   * <=2h → 1.0, <=6h → 0.8, <=12h → 0.55, <=24h → 0.3, else → 0.1
   */
  private computeFreshness(firstSeenAt: Date | null): number {
    if (!firstSeenAt) return 0.1;

    const hoursAgo =
      (Date.now() - firstSeenAt.getTime()) / (1000 * 60 * 60);

    if (hoursAgo <= 2) return 1.0;
    if (hoursAgo <= 6) return 0.8;
    if (hoursAgo <= 12) return 0.55;
    if (hoursAgo <= 24) return 0.3;
    return 0.1;
  }

  /**
   * N — Novelty:
   * 1.0 if cluster NOT in any published feed
   * 0.5 if published >12h ago
   * 0.0 if in most recent feed
   */
  private computeNovelty(
    publishedStories: { publishedAt: Date }[],
  ): number {
    if (publishedStories.length === 0) return 1.0;

    // Find most recent publication
    const mostRecent = publishedStories.reduce((latest, story) =>
      story.publishedAt > latest.publishedAt ? story : latest,
    );

    const hoursAgo =
      (Date.now() - mostRecent.publishedAt.getTime()) / (1000 * 60 * 60);

    if (hoursAgo > 12) return 0.5;
    return 0.0;
  }

  /**
   * E — Engagement heuristic:
   * money/career/housing keywords → 0.8
   * business keywords → 0.6
   * else → 0.4
   */
  private computeEngagement(text: string): number {
    if (HIGH_ENGAGEMENT_KEYWORDS.some((kw) => text.includes(kw))) {
      return 0.8;
    }
    if (MEDIUM_ENGAGEMENT_KEYWORDS.some((kw) => text.includes(kw))) {
      return 0.6;
    }
    return 0.4;
  }

  /**
   * S — Strategic Fit:
   * 0.8 if category in business/economy/property/policy/markets
   * 0.3 otherwise
   */
  private computeStrategicFit(category: string | null): number {
    if (!category) return 0.3;
    return STRATEGIC_CATEGORIES.includes(category.toLowerCase()) ? 0.8 : 0.3;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Boosts & penalties
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Compute additive boosts:
   * - 5+ unique sources → +0.05
   * - involves RBA/ATO/federal govt → +0.04
   * - financial impact on consumers → +0.03
   */
  private computeBoosts(text: string, uniqueSourceCount: number): number {
    let boost = 0;

    if (uniqueSourceCount >= 5) {
      boost += 0.05;
    }

    if (GOVT_ENTITIES.some((kw) => text.includes(kw))) {
      boost += 0.04;
    }

    if (CONSUMER_FINANCE_KEYWORDS.some((kw) => text.includes(kw))) {
      boost += 0.03;
    }

    return boost;
  }

  /**
   * Compute multiplicative penalty factor.
   * Returns a multiplier in [0, 1].
   *
   * - already published in current feed edition → 0.0
   * - published within past 12h → 0.3
   * - clusterQuality < 0.4 → 0.0
   *
   * NOTE: category overrepresentation (>2 in shortlist) is applied at
   * feed-build time, not here, because it depends on the shortlist context.
   */
  private computePenalties(
    publishedStories: { publishedAt: Date; edition: string; editionDate: Date }[],
    clusterQuality: number,
  ): number {
    // Quality gate
    if (clusterQuality < 0.4) return 0.0;

    if (publishedStories.length > 0) {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      // Check if published in current feed edition (today)
      const publishedToday = publishedStories.some(
        (s) => s.editionDate.toISOString().slice(0, 10) === todayStr,
      );
      if (publishedToday) return 0.0;

      // Check if published within past 12h
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      const publishedRecently = publishedStories.some(
        (s) => s.publishedAt >= twelveHoursAgo,
      );
      if (publishedRecently) return 0.3;
    }

    return 1.0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Utilities
  // ──────────────────────────────────────────────────────────────────────────

  private weightedSum(
    signals: Record<string, number>,
    weights: Record<string, number>,
  ): number {
    let sum = 0;
    for (const key of Object.keys(weights)) {
      sum += (signals[key] || 0) * weights[key];
    }
    return sum;
  }

  private parseEntities(entities: unknown): ArticleEntities {
    if (!entities || typeof entities !== 'object') {
      return { orgs: [], gpes: [], persons: [] };
    }

    const e = entities as Record<string, unknown>;
    return {
      orgs: Array.isArray(e.orgs) ? (e.orgs as string[]) : [],
      gpes: Array.isArray(e.gpes) ? (e.gpes as string[]) : [],
      persons: Array.isArray(e.persons) ? (e.persons as string[]) : [],
    };
  }
}
