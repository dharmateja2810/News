import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExplainerService } from '../explainer/explainer.service';

@Injectable()
export class EditorService {
  private readonly logger = new Logger(EditorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly explainerService: ExplainerService,
  ) {}

  /**
   * Get the editor queue for a specific edition and date.
   * Returns 50 items sorted by suggested_rank.
   */
  async getQueue(edition: string, date: string) {
    const editionDate = new Date(date);

    return this.prisma.editorQueue.findMany({
      where: { edition, editionDate },
      orderBy: { suggestedRank: 'asc' },
      include: {
        cluster: {
          select: {
            id: true,
            topic: true,
            category: true,
            ozScore: true,
            ozScoreMorning: true,
            ozScoreEvening: true,
            impactScore: true,
            uniqueSourceCount: true,
            articleCount: true,
            clusterQuality: true,
            tier: true,
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
              take: 3,
            },
          },
        },
      },
    });
  }

  /**
   * Update a queue item's status and optional editor overrides.
   */
  async updateQueueItem(
    id: string,
    data: {
      status?: 'approved' | 'edited' | 'rejected' | 'deferred';
      editorHeadline?: string;
      editorSummary?: string;
      editorNotes?: string;
    },
  ) {
    return this.prisma.editorQueue.update({
      where: { id },
      data: {
        ...data,
        reviewedAt: data.status ? new Date() : undefined,
      },
    });
  }

  /**
   * Trigger AI generation for a specific queue item's cluster.
   * Populates aiHeadline, aiSummary, aiWhyMatters, aiDoubleClick.
   */
  async triggerAiGeneration(queueItemId: string) {
    const item = await this.prisma.editorQueue.findUnique({
      where: { id: queueItemId },
      select: { clusterId: true },
    });
    if (!item) throw new Error(`Queue item ${queueItemId} not found`);

    const result = await this.explainerService.generateForCluster(item.clusterId);

    return this.prisma.editorQueue.update({
      where: { id: queueItemId },
      data: {
        aiHeadline: result.headline,
        aiSummary: result.cardSummary,
        aiWhyMatters: result.whyItMatters,
        aiDoubleClick: result.explainerBody,
      },
    });
  }

  /**
   * Get queue stats for a specific edition and date.
   */
  async getQueueStats(edition: string, date: string) {
    const editionDate = new Date(date);

    const items = await this.prisma.editorQueue.findMany({
      where: { edition, editionDate },
      select: { status: true },
    });

    const total = items.length;
    const statusCounts = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total,
      pending: statusCounts['pending'] || 0,
      approved: statusCounts['approved'] || 0,
      edited: statusCounts['edited'] || 0,
      rejected: statusCounts['rejected'] || 0,
      deferred: statusCounts['deferred'] || 0,
    };
  }
}
