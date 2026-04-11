import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { EditorService } from './editor.service';

@ApiTags('editor')
@Controller('editor')
export class EditorController {
  constructor(private readonly editorService: EditorService) {}

  @Get('queue')
  @ApiOperation({ summary: 'Get editor queue for a specific edition and date' })
  @ApiQuery({ name: 'edition', enum: ['morning', 'evening', 'breaking'] })
  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
  async getQueue(
    @Query('edition') edition: string,
    @Query('date') date: string,
  ) {
    const items = await this.editorService.getQueue(edition, date);
    return { success: true, count: items.length, items };
  }

  @Patch('queue/:id')
  @ApiOperation({ summary: 'Update queue item status and editor overrides' })
  @ApiParam({ name: 'id' })
  async updateQueueItem(
    @Param('id') id: string,
    @Body()
    body: {
      status?: 'approved' | 'edited' | 'rejected' | 'deferred';
      editorHeadline?: string;
      editorSummary?: string;
      editorNotes?: string;
    },
  ) {
    const item = await this.editorService.updateQueueItem(id, body);
    return { success: true, item };
  }

  @Get('queue/stats')
  @ApiOperation({ summary: 'Get queue statistics for an edition and date' })
  @ApiQuery({ name: 'edition', enum: ['morning', 'evening', 'breaking'] })
  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })
  async getQueueStats(
    @Query('edition') edition: string,
    @Query('date') date: string,
  ) {
    const stats = await this.editorService.getQueueStats(edition, date);
    return { success: true, stats };
  }
}
