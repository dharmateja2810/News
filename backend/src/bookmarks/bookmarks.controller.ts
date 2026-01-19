import { Controller, Post, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { BookmarksService } from './bookmarks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('bookmarks')
@Controller('bookmarks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookmarksController {
  constructor(private bookmarksService: BookmarksService) {}

  @Post(':articleId')
  @ApiOperation({ summary: 'Toggle bookmark on article' })
  @ApiResponse({ status: 200, description: 'Bookmark toggled' })
  async toggleBookmark(@Request() req, @Param('articleId') articleId: string) {
    return this.bookmarksService.toggle(req.user.id, articleId);
  }

  @Get()
  @ApiOperation({ summary: 'Get user bookmarked articles' })
  @ApiResponse({ status: 200, description: 'Bookmarks retrieved' })
  async getUserBookmarks(@Request() req) {
    return this.bookmarksService.getUserBookmarks(req.user.id);
  }

  @Post('like/:articleId')
  @ApiOperation({ summary: 'Toggle like on article' })
  @ApiResponse({ status: 200, description: 'Like toggled' })
  async toggleLike(@Request() req, @Param('articleId') articleId: string) {
    return this.bookmarksService.toggleLike(req.user.id, articleId);
  }
}

