import { Controller, Post, Param, Query, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PublisherService } from './publisher.service';

@ApiTags('publisher')
@Controller('publisher')
export class PublisherController {
  constructor(private readonly publisherService: PublisherService) {}

  @Post('queue/:id/publish')
  @ApiOperation({ summary: 'Publish a single approved queue item' })
  @ApiParam({ name: 'id' })
  @HttpCode(200)
  async publishItem(@Param('id') id: string) {
    const story = await this.publisherService.publishQueueItem(id);
    return { success: true, story };
  }

  @Post('edition/publish')
  @ApiOperation({ summary: 'Bulk publish all approved items for an edition' })
  @ApiQuery({ name: 'edition', enum: ['morning', 'evening', 'breaking'] })
  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
  @HttpCode(200)
  async publishEdition(
    @Query('edition') edition: string,
    @Query('date') date: string,
  ) {
    const stories = await this.publisherService.publishEdition(edition, date);
    return { success: true, count: stories.length, stories };
  }
}
