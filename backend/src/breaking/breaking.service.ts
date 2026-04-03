import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ExplainerService } from '../explainer/explainer.service';

/**
 * Breaking Card Detector
 * Scans active clusters every 5 minutes for breaking thresholds:
 *   - OzScore >= 0.82
 *   - Impact >= 0.88
 *   - unique_source_count >= 3
 *   - cluster_quality >= 0.6
 *   - Not already breaking
 *   - Not published today
 * Daily cap: 3 breaking cards.
 * Auto-defers if no editor action within 15 minutes.
 */
@Injectable()
export class BreakingService {
  private readonly logger = new Logger(BreakingService.name);

  /** Thresholds from TechSpec section 10 */
  private readonly OZ_SCORE_THRESHOLD = 0.82;
  private readonly IMPACT_THRESHOLD = 0.88;
  private readonly MIN_SOURCES = 3;
  private readonly MIN_QUALITY = 0.6;
  private readonly DAILY_CAP = 3;
  private readonly AUTO_DEFER_MINUTES = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly explainerService: ExplainerService,
  ) {}

  /** Runs every 5 minutes to detect breaking stories. */
  @Cron('*/5 * * * *')
  async detectBreaking(): Promise<void> {
    this.logger.log('Scanning for breaking stories...');

    try {
      // Check daily cap
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayBreakingCount = await this.prisma.storyCluster.count({
        where: {
          isBreaking: true,
          breakingFiredAt: { gte: todayStart },
        },
      });

      if (todayBreakingCount >= this.DAILY_CAP) {
        this.logger.log(`Daily breaking cap reached (${todayBreakingCount}/${this.DAILY_CAP})`);
        return;
      }

      const remaining = this.DAILY_CAP - todayBreakingCount;

      // Find candidate clusters that meet all hard conditions
      const candidates = await this.prisma.storyCluster.findMany({
        where: {
          status: 'active',
          isBreaking: false,
          ozScore: { gte: this.OZ_SCORE_THRESHOLD },
          impactScore: { gte: this.IMPACT_THRESHOLD },
          uniqueSourceCount: { gte: this.MIN_SOURCES },
          clusterQuality: { gte: this.MIN_QUALITY },
        },
        orderBy: { ozScore: 'desc' },
        take: remaining,
      });

      if (candidates.length === 0) {
        this.logger.log('No breaking candidates found');
        return;
      }

      // Check each candidate hasn't been published today already
      for (const cluster of candidates) {
        const publishedToday = await this.prisma.publishedStory.findFirst({
          where: {
            clusterId: cluster.id,
            publishedAt: { gte: todayStart },
          },
        });

        if (publishedToday) {
          this.logger.log(`Cluster ${cluster.id} already published today, skipping`);
          continue;
        }

        // Mark as breaking
        await this.prisma.storyCluster.update({
          where: { id: cluster.id },
          data: {
            isBreaking: true,
            breakingFiredAt: new Date(),
          },
        });

        this.logger.warn(`BREAKING: Cluster ${cluster.id} (${cluster.topic}) — OzScore: ${cluster.ozScore}, Impact: ${cluster.impactScore}`);

        // Auto-trigger AI generation pipeline
        try {
          const aiResult = await this.explainerService.generateForCluster(cluster.id);

          // Create an EditorQueue entry for the breaking item
          await this.prisma.editorQueue.create({
            data: {
              clusterId: cluster.id,
              edition: 'breaking',
              editionDate: new Date(todayStart),
              suggestedRank: 1,
              aiHeadline: aiResult.headline,
              aiSummary: aiResult.cardSummary,
              aiWhyMatters: aiResult.whyItMatters,
              aiDoubleClick: aiResult.explainerBody,
              status: 'pending',
            },
          });

          this.logger.log(`AI generation complete for breaking cluster ${cluster.id}`);
        } catch (err) {
          this.logger.error(`AI generation failed for breaking cluster ${cluster.id}: ${err.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Breaking detector failed: ${error.message}`);
    }
  }

  /** Auto-defer breaking queue items with no editor action after 15 minutes. */
  @Cron('*/5 * * * *')
  async autoDeferStale(): Promise<void> {
    const cutoff = new Date(Date.now() - this.AUTO_DEFER_MINUTES * 60 * 1000);

    const staleItems = await this.prisma.editorQueue.updateMany({
      where: {
        edition: 'breaking',
        status: 'pending',
        createdAt: { lt: cutoff },
      },
      data: {
        status: 'deferred',
        reviewedAt: new Date(),
      },
    });

    if (staleItems.count > 0) {
      this.logger.warn(`Auto-deferred ${staleItems.count} stale breaking queue items`);
    }
  }
}
