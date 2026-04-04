import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { UuidPipe } from '../common/pipes/uuid.pipe';

@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @ApiOperation({ summary: 'Get published stories for a specific edition and date' })
  @ApiQuery({ name: 'edition', required: false, type: String, description: 'morning or evening' })
  @ApiQuery({ name: 'date', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiResponse({ status: 200, description: 'Published stories returned' })
  async getFeed(
    @Query('edition') edition?: string,
    @Query('date') date?: string,
  ) {
    const resolvedEdition = edition || 'morning';
    const resolvedDate = date || new Date().toISOString().slice(0, 10);

    const stories = await this.feedService.getPublishedFeed(
      resolvedEdition,
      resolvedDate,
    );

    return {
      success: true,
      edition: resolvedEdition,
      date: resolvedDate,
      count: stories.length,
      stories,
    };
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get the most recently published feed' })
  @ApiResponse({ status: 200, description: 'Latest feed returned' })
  async getLatestFeed() {
    const stories = await this.feedService.getLatestFeed();

    return {
      success: true,
      count: stories.length,
      stories,
    };
  }

  @Get('breaking')
  @ApiOperation({ summary: "Get today's breaking cards" })
  @ApiResponse({ status: 200, description: 'Breaking stories returned' })
  async getBreaking() {
    const stories = await this.feedService.getBreakingStories();

    return {
      success: true,
      count: stories.length,
      stories,
    };
  }

  @Post('build')
  @ApiOperation({ summary: 'Manually trigger feed build for an edition' })
  @ApiQuery({ name: 'edition', required: false, type: String })
  async buildFeed(@Query('edition') edition?: string) {
    const ed = (edition === 'evening' ? 'evening' : 'morning') as 'morning' | 'evening';
    const result = await this.feedService.buildFeed(ed, new Date());
    return { success: true, edition: ed, shortlisted: result.length };
  }

  @Get('story/:id')
  @ApiOperation({ summary: 'Get a full story including double_click content' })
  @ApiParam({ name: 'id', description: 'Published story UUID' })
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
