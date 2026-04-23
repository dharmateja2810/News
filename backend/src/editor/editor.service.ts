import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EditorService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [pending, approved, rejected] = await Promise.all([
      this.prisma.clusterContent.count({ where: { status: 'pending' } }),
      this.prisma.clusterContent.count({ where: { status: 'approved' } }),
      this.prisma.clusterContent.count({ where: { status: 'rejected' } }),
    ]);
    return { pending, approved, rejected, total: pending + approved + rejected };
  }

  async findStories(
    status: string = 'pending',
    page: number = 1,
    limit: number = 20,
  ) {
    const where = status === 'all' ? {} : { status };
    const [items, total] = await Promise.all([
      this.prisma.clusterContent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          cluster: {
            select: {
              id: true,
              topic: true,
              category: true,
              articleCount: true,
              uniqueSourceCount: true,
              ozScore: true,
            },
          },
        },
      }),
      this.prisma.clusterContent.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        headline: item.headline,
        summary: item.summary,
        whyItMatters: item.whyItMatters,
        doubleClick: item.doubleClick,
        tier: item.tier,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        cluster: {
          id: item.cluster.id,
          topic: item.cluster.topic,
          category: item.cluster.category,
          articleCount: item.cluster.articleCount,
          uniqueSourceCount: item.cluster.uniqueSourceCount,
          ozScore: item.cluster.ozScore,
        },
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findStoryById(id: string) {
    const item = await this.prisma.clusterContent.findUnique({
      where: { id },
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
                category: true,
              },
              orderBy: { sourceAuthority: 'desc' },
            },
          },
        },
      },
    });

    if (!item) return null;

    return {
      id: item.id,
      headline: item.headline,
      summary: item.summary,
      whyItMatters: item.whyItMatters,
      doubleClick: item.doubleClick,
      tier: item.tier,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      cluster: {
        id: item.cluster.id,
        topic: item.cluster.topic,
        category: item.cluster.category,
        articleCount: item.cluster.articleCount,
        uniqueSourceCount: item.cluster.uniqueSourceCount,
        ozScore: item.cluster.ozScore,
        articles: item.cluster.articles.map((a) => ({
          id: a.id,
          title: a.title,
          source: a.source,
          url: a.url,
          publishedAt: a.publishedAt?.toISOString() || null,
          category: a.category,
        })),
      },
    };
  }

  async updateStatus(id: string, status: 'approved' | 'rejected') {
    return this.prisma.clusterContent.update({
      where: { id },
      data: { status },
    });
  }

  async bulkUpdateStatus(ids: string[], status: 'approved' | 'rejected') {
    return this.prisma.clusterContent.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
  }

  async createManualStory(data: {
    headline: string;
    summary: string;
    whyItMatters?: string;
    doubleClick?: string;
    tier: number;
    category: string;
    status: string;
    ozScore?: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const cluster = await tx.storyCluster.create({
        data: {
          topic: data.headline,
          category: data.category,
          status: 'active',
          articleCount: 0,
          uniqueSourceCount: 0,
          ozScore: data.ozScore ?? 50,
          tier: data.tier,
          firstSeenAt: new Date(),
          lastUpdatedAt: new Date(),
        },
      });

      const content = await tx.clusterContent.create({
        data: {
          clusterId: cluster.id,
          headline: data.headline,
          summary: data.summary,
          whyItMatters: data.whyItMatters || null,
          doubleClick: data.doubleClick || null,
          tier: data.tier,
          status: data.status || 'pending',
        },
      });

      return {
        id: content.id,
        headline: content.headline,
        summary: content.summary,
        whyItMatters: content.whyItMatters,
        doubleClick: content.doubleClick,
        tier: content.tier,
        status: content.status,
        createdAt: content.createdAt.toISOString(),
        updatedAt: content.updatedAt.toISOString(),
        cluster: {
          id: cluster.id,
          topic: cluster.topic,
          category: cluster.category,
          articleCount: cluster.articleCount,
          uniqueSourceCount: cluster.uniqueSourceCount,
          ozScore: cluster.ozScore,
        },
      };
    });
  }
}
