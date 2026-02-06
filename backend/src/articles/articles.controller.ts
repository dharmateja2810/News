import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiHeader,
} from '@nestjs/swagger';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { ConfigService } from '@nestjs/config';

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(
    private articlesService: ArticlesService,
    private configService: ConfigService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create article (for n8n webhook)' })
  @ApiHeader({ name: 'x-webhook-secret', required: true })
  @ApiResponse({ status: 201, description: 'Article created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createArticleDto: CreateArticleDto,
    @Headers('x-webhook-secret') webhookSecret: string,
  ) {
    // Verify webhook secret
    const expectedSecret = this.configService.get('N8N_WEBHOOK_SECRET');
    if (webhookSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    return this.articlesService.create(createArticleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all articles with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Articles retrieved successfully' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    return this.articlesService.findAll({
      skip,
      take: limitNum,
      category,
      search,
    });
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async getCategories() {
    return this.articlesService.getCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single article by ID' })
  @ApiResponse({ status: 200, description: 'Article retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async findOne(@Param('id') id: string) {
    return this.articlesService.findOne(id);
  }
}

