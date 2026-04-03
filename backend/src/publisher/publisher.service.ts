import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublisherService {
  private readonly logger = new Logger(PublisherService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Publish a single editor queue item.
   * Creates a PublishedStory from the approved/edited queue item.
   */
  async publishQueueItem(queueItemId: string) {
    const item = await this.prisma.editorQueue.findUnique({
      where: { id: queueItemId },
      include: {
        cluster: {
          select: {
            category: true,
            tier: true,
            isBreaking: true,
            ozScore: true,
          },
        },
      },
    });

    if (!item) throw new Error(`Queue item ${queueItemId} not found`);
    if (item.status !== 'approved' && item.status !== 'edited') {
      throw new Error(`Queue item must be approved or edited to publish (current: ${item.status})`);
    }

    // Check if already published
    const existing = await this.prisma.publishedStory.findUnique({
      where: { queueId: queueItemId },
    });
    if (existing) return existing;

    // Determine content: prefer editor overrides, then AI generated
    const headline = item.editorHeadline || item.aiHeadline || 'Untitled';
    const summary = item.editorSummary || item.aiSummary || '';
    const whyMatters = item.aiWhyMatters || '';
    const doubleClick = item.aiDoubleClick || '';
    const category = item.cluster?.category || 'Business';
    const tier = item.cluster?.tier || 2;
    const isBreaking = item.cluster?.isBreaking || false;

    // Calculate feed rank: count existing published stories for this edition+date
    const existingCount = await this.prisma.publishedStory.count({
      where: {
        edition: item.edition,
        editionDate: item.editionDate,
      },
    });

    const story = await this.prisma.publishedStory.create({
      data: {
        clusterId: item.clusterId,
        queueId: queueItemId,
        edition: item.edition,
        editionDate: item.editionDate,
        feedRank: existingCount + 1,
        headline,
        summary,
        whyMatters,
        doubleClick,
        category,
        tier,
        isBreaking,
      },
    });

    this.logger.log(`Published story ${story.id} from queue item ${queueItemId}`);
    return story;
  }

  /**
   * Bulk publish all approved/edited items for an edition+date.
   */
  async publishEdition(edition: string, date: string) {
    const editionDate = new Date(date);

    const items = await this.prisma.editorQueue.findMany({
      where: {
        edition,
        editionDate,
        status: { in: ['approved', 'edited'] },
        publishedStory: null, // not yet published
      },
      orderBy: { suggestedRank: 'asc' },
    });

    const published = [];
    for (const item of items) {
      const story = await this.publishQueueItem(item.id);
      published.push(story);
    }

    this.logger.log(`Published ${published.length} stories for ${edition} edition ${date}`);
    return published;
  }
}
