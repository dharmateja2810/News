import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Breaking Card Detector (threshold check only)
 * AI generation and editor_queue creation is handled by the Python breaking.py script.
 * This service only auto-defers stale breaking queue items.
 *
 * Run python breaking.py on a */5 cron for full breaking detection + AI generation.
 */
@Injectable()
export class BreakingService {
  private readonly logger = new Logger(BreakingService.name);

  private readonly AUTO_DEFER_MINUTES = 15;

  constructor(private readonly prisma: PrismaService) {}

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
