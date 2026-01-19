import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';

@Injectable()
export class ArticlesService {
  constructor(private prisma: PrismaService) {}

  async create(createArticleDto: CreateArticleDto) {
    // Check if article with URL already exists
    const existingArticle = await this.prisma.article.findUnique({
      where: { url: createArticleDto.url },
    });

    if (existingArticle) {
      // Update existing article instead of creating duplicate
      return this.prisma.article.update({
        where: { url: createArticleDto.url },
        data: createArticleDto,
      });
    }

    return this.prisma.article.create({
      data: createArticleDto,
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    category?: string;
    search?: string;
  }) {
    const { skip = 0, take = 20, category, search } = params;

    const where: any = {};

    if (category && category !== 'All') {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip,
        take,
        orderBy: { publishedAt: 'desc' },
        include: {
          _count: {
            select: {
              likes: true,
              bookmarks: true,
            },
          },
        },
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      articles,
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        pageSize: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async findOne(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            likes: true,
            bookmarks: true,
          },
        },
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
  }

  async findByCategory(category: string) {
    return this.prisma.article.findMany({
      where: { category },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });
  }

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  }
}

