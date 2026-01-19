import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookmarksService {
  constructor(private prisma: PrismaService) {}

  async toggle(userId: string, articleId: string) {
    // Check if bookmark exists
    const existing = await this.prisma.bookmark.findUnique({
      where: {
        userId_articleId: {
          userId,
          articleId,
        },
      },
    });

    if (existing) {
      // Remove bookmark
      await this.prisma.bookmark.delete({
        where: { id: existing.id },
      });
      return { bookmarked: false };
    } else {
      // Create bookmark
      await this.prisma.bookmark.create({
        data: { userId, articleId },
      });
      return { bookmarked: true };
    }
  }

  async getUserBookmarks(userId: string) {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId },
      include: {
        article: {
          include: {
            _count: {
              select: {
                likes: true,
                bookmarks: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookmarks.map((b) => b.article);
  }

  async toggleLike(userId: string, articleId: string) {
    // Check if like exists
    const existing = await this.prisma.like.findUnique({
      where: {
        userId_articleId: {
          userId,
          articleId,
        },
      },
    });

    if (existing) {
      // Remove like
      await this.prisma.like.delete({
        where: { id: existing.id },
      });
      return { liked: false };
    } else {
      // Create like
      await this.prisma.like.create({
        data: { userId, articleId },
      });
      return { liked: true };
    }
  }
}

