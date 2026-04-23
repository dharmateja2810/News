import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EditorService } from './editor.service';
import { EditorAuthGuard } from './editor-auth.guard';

@ApiTags('editor')
@Controller('editor')
@UseGuards(EditorAuthGuard)
export class EditorController {
  constructor(private readonly editorService: EditorService) {}

  @Get('stats')
  getStats() {
    return this.editorService.getStats();
  }

  @Get('stories')
  getStories(
    @Query('status') status: string = 'pending',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.editorService.findStories(
      status,
      Math.max(1, parseInt(page) || 1),
      Math.min(100, Math.max(1, parseInt(limit) || 20)),
    );
  }

  @Patch('stories/bulk')
  async bulkUpdateStatus(@Body() body: { ids: string[]; status: string }) {
    if (!body.ids?.length) {
      throw new BadRequestException('ids array is required');
    }
    if (!['approved', 'rejected'].includes(body.status)) {
      throw new BadRequestException('Status must be "approved" or "rejected"');
    }
    return this.editorService.bulkUpdateStatus(
      body.ids,
      body.status as 'approved' | 'rejected',
    );
  }

  @Get('stories/:id')
  async getStory(@Param('id') id: string) {
    const story = await this.editorService.findStoryById(id);
    if (!story) throw new NotFoundException('Story not found');
    return story;
  }

  @Patch('stories/:id')
  async updateStoryStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    if (!['approved', 'rejected'].includes(body.status)) {
      throw new BadRequestException('Status must be "approved" or "rejected"');
    }
    return this.editorService.updateStatus(id, body.status as 'approved' | 'rejected');
  }

  @Post('stories')
  async createStory(
    @Body()
    body: {
      headline: string;
      summary: string;
      whyItMatters?: string;
      doubleClick?: string;
      tier: number;
      category: string;
      status?: string;
      ozScore?: number;
    },
  ) {
    if (!body.headline?.trim()) {
      throw new BadRequestException('Headline is required');
    }
    if (!body.summary?.trim()) {
      throw new BadRequestException('Summary is required');
    }
    if (![1, 2, 3].includes(body.tier)) {
      throw new BadRequestException('Tier must be 1, 2, or 3');
    }
    if (!body.category?.trim()) {
      throw new BadRequestException('Category is required');
    }
    if (body.status && !['pending', 'approved', 'rejected'].includes(body.status)) {
      throw new BadRequestException('Status must be "pending", "approved", or "rejected"');
    }
    return this.editorService.createManualStory({
      headline: body.headline.trim(),
      summary: body.summary.trim(),
      whyItMatters: body.whyItMatters?.trim(),
      doubleClick: body.doubleClick?.trim(),
      tier: body.tier,
      category: body.category.trim(),
      status: body.status || 'pending',
      ozScore: body.ozScore,
    });
  }
}
