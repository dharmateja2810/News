import { Controller, Post, Param, HttpCode, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ScraperService } from './scraper.service';

@ApiTags('admin/scrape')
@Controller('admin/scrape')
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);

  constructor(private readonly scraperService: ScraperService) {}

  @Post(':sourceSlug')
  @HttpCode(200)
  @ApiOperation({ summary: 'Trigger manual scrape for a single source' })
  @ApiParam({ name: 'sourceSlug', description: 'Slug of the source to scrape' })
  async scrapeOne(@Param('sourceSlug') sourceSlug: string) {
    this.logger.log(`Manual scrape triggered for source: ${sourceSlug}`);
    try {
      const inserted = await this.scraperService.scrapeSource(sourceSlug);
      return { success: true, source: sourceSlug, articlesInserted: inserted };
    } catch (error) {
      this.logger.error(`Manual scrape failed for "${sourceSlug}": ${error.message}`);
      return { success: false, source: sourceSlug, error: error.message };
    }
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Trigger manual scrape for all active sources' })
  async scrapeAll() {
    this.logger.log('Manual scrape triggered for all active sources');
    try {
      const results = await this.scraperService.scrapeAllActive();
      const totalInserted = Object.values(results).reduce((sum, n) => sum + n, 0);
      return {
        success: true,
        totalArticlesInserted: totalInserted,
        sources: results,
      };
    } catch (error) {
      this.logger.error(`Manual scrape-all failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
