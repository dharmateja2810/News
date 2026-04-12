import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the latest feed: active clusters that have generated content,
   * ordered by ozScore descending, limited to top 50.
   */
  async getLatestFeed() {
    const clusters = await this.prisma.storyCluster.findMany({
      where: {
        status: 'active',
        clusterContent: { isNot: null },
      },
      orderBy: { ozScore: 'desc' },
      take: 50,
      include: {
        clusterContent: true,
      },
    });

    return clusters.map((cluster, index) => ({
      id: cluster.clusterContent!.id,
      headline: cluster.clusterContent!.headline,
      summary: cluster.clusterContent!.summary,
      whyMatters: cluster.clusterContent!.whyItMatters || '',
      doubleClick: cluster.clusterContent!.doubleClick || '',
      category: cluster.category || 'Business',
      tier: cluster.clusterContent!.tier,
      feedRank: index + 1,
      illustrationId: null,
      edition: 'latest',
      publishedAt: cluster.clusterContent!.createdAt.toISOString(),
      cluster: {
        id: cluster.id,
        topic: cluster.topic,
        uniqueSourceCount: cluster.uniqueSourceCount,
        articleCount: cluster.articleCount,
      },
    }));
  }

  /**
   * Get a single story by its cluster_content ID,
   * including the cluster's source articles.
   */
  async getStoryById(contentId: string) {
    const content = await this.prisma.clusterContent.findUnique({
      where: { id: contentId },
      include: {
        cluster: {
          include: {
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

    if (!content) return null;

    return {
      id: content.id,
      headline: content.headline,
      summary: content.summary,
      whyMatters: content.whyItMatters || '',
      doubleClick: content.doubleClick || '',
      category: content.cluster.category || 'Business',
      tier: content.tier,
      feedRank: null,
      illustrationId: null,
      edition: 'latest',
      publishedAt: content.createdAt.toISOString(),
      cluster: {
        id: content.cluster.id,
        topic: content.cluster.topic,
        uniqueSourceCount: content.cluster.uniqueSourceCount,
        articleCount: content.cluster.articleCount,
        articles: content.cluster.articles.map((art) => ({
          id: art.id,
          title: art.title,
          source: art.source,
          url: art.url,
          publishedAt: art.publishedAt?.toISOString() || null,
        })),
      },
    };
  }
}
