import {
  Controller,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { UuidPipe } from '../common/pipes/uuid.pipe';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Get the latest feed of stories ordered by OzScore' })
  @ApiResponse({ status: 200, description: 'Latest feed returned' })
  async getLatestFeed() {
    const stories = await this.feedService.getLatestFeed();

    return {
      success: true,
      count: stories.length,
      stories,
    };
  }

  @Get('story/:id')
  @ApiOperation({ summary: 'Get a full story including double_click content' })
  @ApiParam({ name: 'id', description: 'Cluster content UUID' })
  @ApiResponse({ status: 200, description: 'Story returned' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async getStory(@Param('id', new UuidPipe()) id: string) {
    const story = await this.feedService.getStoryById(id);

    if (!story) {
      throw new NotFoundException(`Story with ID ${id} not found`);
    }

    return {
      success: true,
      story,
    };
  }
}
