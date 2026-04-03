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

/** Newswire source slugs used in quality scoring. */
const NEWSWIRE_SOURCES = ['reuters', 'aap', 'bloomberg'];

@Injectable()
export class ClusteringService {
  private readonly logger = new Logger(ClusteringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Scheduled job
  // ──────────────────────────────────────────────────────────────────────────

  @Cron('*/30 * * * *')
  async handleCron(): Promise<void> {
    this.logger.log('Cron: running clustering pass');
    await this.runClustering();
    await this.archiveOldClusters();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Main clustering pass:
   * 1. Find unassigned articles (clusterId = null, processed = true)
   * 2. For each, find candidate clusters or create a new one
   * 3. Update cluster metadata
   */
  async runClustering(): Promise<{ assigned: number; newClusters: number }> {
    const unassigned = await this.prisma.article.findMany({
      where: {
        processed: true,
        clusterId: null,
      },
      orderBy: { publishedAt: 'desc' },
    });

    if (unassigned.length === 0) {
      this.logger.log('No unassigned articles to cluster');
      return { assigned: 0, newClusters: 0 };
    }

    this.logger.log(`Clustering ${unassigned.length} unassigned article(s)`);

    let assigned = 0;
    let newClusters = 0;

    // Load all active clusters with their articles for matching
    const activeClusters = await this.prisma.storyCluster.findMany({
      where: { status: 'active' },
      include: {
        articles: {
          select: {
            id: true,
            title: true,
            entities: true,
            publishedAt: true,
            source: true,
            sourceAuthority: true,
            isOpinion: true,
            isPaywalled: true,
            category: true,
          },
        },
      },
    });

    // Build a mutable map of cluster -> articles for quick lookup
    const clusterMap = new Map<
      string,
      {
        cluster: (typeof activeClusters)[0];
        articles: (typeof activeClusters)[0]['articles'];
      }
    >();

    for (const cluster of activeClusters) {
      clusterMap.set(cluster.id, { cluster, articles: cluster.articles });
    }

    for (const article of unassigned) {
      const articleWordSet = this.titleToWordSet(article.title);
      const articleEntities = this.parseEntities(article.entities);

      let bestClusterId: string | null = null;
      let bestScore = 0;

      for (const [clusterId, { articles: clusterArticles }] of clusterMap) {
        // Check if any article in the cluster matches
        for (const clusterArticle of clusterArticles) {
          // Time window: published within 24h of each other
          if (article.publishedAt && clusterArticle.publishedAt) {
            const timeDiff = Math.abs(
              article.publishedAt.getTime() -
                clusterArticle.publishedAt.getTime(),
            );
            if (timeDiff > 24 * 60 * 60 * 1000) continue;
          }

          // Condition 1: Title word overlap (Jaccard) > 0.4
          const clusterWordSet = this.titleToWordSet(clusterArticle.title);
          const similarity = this.jaccardSimilarity(
            articleWordSet,
            clusterWordSet,
          );
          if (similarity <= 0.4) continue;

          // Condition 2: At least 1 shared entity
          const clusterEntities = this.parseEntities(clusterArticle.entities);
          const sharedEntities = this.countSharedEntities(
            articleEntities,
            clusterEntities,
          );
          if (sharedEntities < 1) continue;

          // This article matches — score by similarity
          if (similarity > bestScore) {
            bestScore = similarity;
            bestClusterId = clusterId;
          }
        }
      }

      if (bestClusterId) {
        // Assign to existing cluster
        await this.assignToCluster(article.id, bestClusterId);

        // Update local cache
        const entry = clusterMap.get(bestClusterId)!;
        entry.articles.push({
          id: article.id,
          title: article.title,
          entities: article.entities,
          publishedAt: article.publishedAt,
          source: article.source,
          sourceAuthority: article.sourceAuthority,
          isOpinion: article.isOpinion,
          isPaywalled: article.isPaywalled,
          category: article.category,
        });

        assigned++;
      } else {
        // Create new cluster
        const newCluster = await this.createCluster(article);
        clusterMap.set(newCluster.id, {
          cluster: newCluster as any,
          articles: [
            {
              id: article.id,
              title: article.title,
              entities: article.entities,
              publishedAt: article.publishedAt,
              source: article.source,
              sourceAuthority: article.sourceAuthority,
              isOpinion: article.isOpinion,
              isPaywalled: article.isPaywalled,
              category: article.category,
            },
          ],
        });

        assigned++;
        newClusters++;
      }
    }

    // Update metadata for all affected clusters
    const affectedClusterIds = new Set<string>();
    for (const article of unassigned) {
      const updated = await this.prisma.article.findUnique({
        where: { id: article.id },
        select: { clusterId: true },
      });
      if (updated?.clusterId) {
        affectedClusterIds.add(updated.clusterId);
      }
    }

    for (const clusterId of affectedClusterIds) {
      await this.updateClusterMetadata(clusterId);
    }

    this.logger.log(
      `Clustering complete: ${assigned} assigned, ${newClusters} new cluster(s)`,
    );

    return { assigned, newClusters };
  }

  /**
   * Archive clusters older than 48h by setting status = 'archived'.
   */
  async archiveOldClusters(): Promise<number> {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const result = await this.prisma.storyCluster.updateMany({
      where: {
        status: 'active',
        lastUpdatedAt: { lt: fortyEightHoursAgo },
      },
      data: { status: 'archived' },
    });

    if (result.count > 0) {
      this.logger.log(`Archived ${result.count} cluster(s) older than 48h`);
    }

    return result.count;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cluster operations
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Create a new cluster seeded by a single article.
   */
  private async createCluster(article: {
    id: string;
    title: string;
    category: string;
    publishedAt: Date | null;
  }) {
    const now = new Date();

    const cluster = await this.prisma.storyCluster.create({
      data: {
        topic: article.title,
        category: article.category,
        firstSeenAt: article.publishedAt || now,
        lastUpdatedAt: now,
        articleCount: 1,
        uniqueSourceCount: 1,
        status: 'active',
      },
    });

    // Link article to cluster
    await this.prisma.article.update({
      where: { id: article.id },
      data: { clusterId: cluster.id },
    });

    // Create ClusterArticle join record
    await this.prisma.clusterArticle.create({
      data: {
        clusterId: cluster.id,
        articleId: article.id,
        isPrimary: true,
      },
    });

    this.logger.debug(
      `Created new cluster ${cluster.id} for article "${article.title.slice(0, 60)}"`,
    );

    return cluster;
  }

  /**
   * Assign an article to an existing cluster.
   */
  private async assignToCluster(
    articleId: string,
    clusterId: string,
  ): Promise<void> {
    await this.prisma.article.update({
      where: { id: articleId },
      data: { clusterId },
    });

    // Create ClusterArticle join record (not primary by default)
    await this.prisma.clusterArticle.upsert({
      where: {
        clusterId_articleId: { clusterId, articleId },
      },
      create: {
        clusterId,
        articleId,
        isPrimary: false,
      },
      update: {},
    });
  }

  /**
   * Recalculate and persist all cluster metadata.
   */
  private async updateClusterMetadata(clusterId: string): Promise<void> {
    const articles = await this.prisma.article.findMany({
      where: { clusterId },
      select: {
        id: true,
        source: true,
        sourceAuthority: true,
        isOpinion: true,
        isPaywalled: true,
        category: true,
        publishedAt: true,
      },
    });

    if (articles.length === 0) return;

    const uniqueSources = new Set(
      articles.map((a) => a.source.toLowerCase()),
    );
    const articleCount = articles.length;
    const uniqueSourceCount = uniqueSources.size;
    const opinionCount = articles.filter((a) => a.isOpinion).length;
    const paywallCount = articles.filter((a) => a.isPaywalled).length;
    const hasPaywalled = paywallCount > 0;
    const opinionRatio = articleCount > 0 ? opinionCount / articleCount : 0;

    // Most common category
    const categoryCounts = new Map<string, number>();
    for (const a of articles) {
      categoryCounts.set(a.category, (categoryCounts.get(a.category) || 0) + 1);
    }
    let topCategory = 'Business';
    let topCategoryCount = 0;
    for (const [cat, count] of categoryCounts) {
      if (count > topCategoryCount) {
        topCategory = cat;
        topCategoryCount = count;
      }
    }

    // Cluster quality score
    const clusterQuality = this.calculateClusterQuality(
      uniqueSourceCount,
      opinionCount,
      articleCount,
      paywallCount,
      uniqueSources,
    );

    // Primary article selection: highest sourceAuthority where
    // isOpinion = false and isPaywalled = false
    const primaryCandidates = articles
      .filter((a) => !a.isOpinion && !a.isPaywalled)
      .sort((a, b) => b.sourceAuthority - a.sourceAuthority);

    const primaryArticleId =
      primaryCandidates.length > 0
        ? primaryCandidates[0].id
        : articles.sort((a, b) => b.sourceAuthority - a.sourceAuthority)[0].id;

    // Reset all isPrimary flags for this cluster, then set the primary
    await this.prisma.clusterArticle.updateMany({
      where: { clusterId },
      data: { isPrimary: false },
    });

    await this.prisma.clusterArticle.updateMany({
      where: { clusterId, articleId: primaryArticleId },
      data: { isPrimary: true },
    });

    // Update cluster record
    await this.prisma.storyCluster.update({
      where: { id: clusterId },
      data: {
        articleCount,
        uniqueSourceCount,
        hasPaywalled,
        opinionRatio,
        category: topCategory,
        clusterQuality,
        lastUpdatedAt: new Date(),
      },
    });
  }

  /**
   * Cluster quality formula:
   *   (sourceDiversity * 0.35)
   * + (nonOpinionRatio * 0.30)
   * + (nonPaywalledRatio * 0.20)
   * + (hasNewswireSource * 0.15)
   *
   * sourceDiversity = uniqueSourceCount / 5, capped at 1.0
   * hasNewswireSource = 1 if any source in ['reuters', 'aap', 'bloomberg']
   */
  private calculateClusterQuality(
    uniqueSourceCount: number,
    opinionCount: number,
    articleCount: number,
    paywallCount: number,
    uniqueSources: Set<string>,
  ): number {
    const sourceDiversity = Math.min(uniqueSourceCount / 5, 1.0);
    const nonOpinionRatio =
      articleCount > 0 ? (articleCount - opinionCount) / articleCount : 1;
    const nonPaywalledRatio =
      articleCount > 0 ? (articleCount - paywallCount) / articleCount : 1;
    const hasNewswireSource = NEWSWIRE_SOURCES.some((ns) =>
      uniqueSources.has(ns),
    )
      ? 1
      : 0;

    return (
      sourceDiversity * 0.35 +
      nonOpinionRatio * 0.3 +
      nonPaywalledRatio * 0.2 +
      hasNewswireSource * 0.15
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Text / entity utilities
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Convert a title to a set of normalised words for Jaccard comparison.
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

  /**
   * Safely parse the entities JSON field from an article.
   */
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

  /**
   * Count how many entities are shared between two entity sets.
   */
  private countSharedEntities(
    a: ArticleEntities,
    b: ArticleEntities,
  ): number {
    const normalize = (s: string) => s.toLowerCase().trim();

    const setA = new Set([
      ...a.orgs.map(normalize),
      ...a.gpes.map(normalize),
      ...a.persons.map(normalize),
    ]);

    const allB = [
      ...b.orgs.map(normalize),
      ...b.gpes.map(normalize),
      ...b.persons.map(normalize),
    ];

    let shared = 0;
    for (const entity of allB) {
      if (setA.has(entity)) shared++;
    }

    return shared;
  }
}
