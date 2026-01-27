import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';

@Injectable()
export class ArticlesService {
  constructor(private prisma: PrismaService) {}

  private normalizeImageUrl(imageUrl?: string, articleUrl?: string): string | undefined {
    if (!imageUrl) return undefined;
    const trimmed = String(imageUrl).trim();
    if (!trimmed) return undefined;
    try {
      const u = new URL(trimmed, articleUrl);
      return u.toString();
    } catch {
      return undefined;
    }
  }

  private normalizeCategory(input: string | undefined, textForHeuristics: string): string {
    const allowed = new Set([
      'Technology',
      'Business',
      'Sports',
      'Health',
      'Science',
      'Entertainment',
      'Politics',
      'World',
    ]);

    const raw = (input || '').trim();
    if (raw && allowed.has(raw)) return raw;

    // Heuristic fallback (useful for n8n/general feeds that don't tag categories).
    const t = (textForHeuristics || '').toLowerCase();
    const has = (re: RegExp) => re.test(t);

    if (has(/\b(ai|machine learning|chip|apple|google|microsoft|cyber|software|startup|tech|quantum)\b/))
      return 'Technology';
    if (has(/\b(stock|market|asx|profit|earnings|rates|bank|economy|inflation|company|merger)\b/))
      return 'Business';
    if (has(/\b(match|league|tournament|championship|olympic|soccer|football|cricket|tennis)\b/))
      return 'Sports';
    if (has(/\b(health|hospital|cancer|vaccine|disease|medical|wellbeing)\b/)) return 'Health';
    if (has(/\b(science|research|space|telescope|climate|biology|physics)\b/)) return 'Science';
    if (has(/\b(movie|music|streaming|celebrity|entertainment)\b/)) return 'Entertainment';
    if (has(/\b(election|government|parliament|policy|diplomatic|minister|politics)\b/))
      return 'Politics';

    return 'Business';
  }

  async create(createArticleDto: CreateArticleDto) {
    const normalizedImageUrl = this.normalizeImageUrl(createArticleDto.imageUrl, createArticleDto.url);
    const normalizedCategory = this.normalizeCategory(
      createArticleDto.category,
      `${createArticleDto.title} ${createArticleDto.description || ''}`,
    );

    const data: CreateArticleDto = {
      ...createArticleDto,
      imageUrl: normalizedImageUrl,
      category: normalizedCategory,
    };

    // Check if article with URL already exists
    const existingArticle = await this.prisma.article.findUnique({
      where: { url: createArticleDto.url },
    });

    if (existingArticle) {
      // Update existing article instead of creating duplicate
      return this.prisma.article.update({
        where: { url: createArticleDto.url },
        data,
      });
    }

    return this.prisma.article.create({
      data,
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

