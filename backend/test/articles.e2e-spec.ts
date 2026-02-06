/**
 * Articles E2E Tests
 * Tests for article CRUD operations, pagination, filtering, and search
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  cleanupDatabase,
  createTestUser,
  createTestArticle,
} from './test-utils';

describe('ArticlesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDatabase(prisma);

    // Create test user and get auth token
    const testUser = await createTestUser(prisma);
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });
    authToken = loginResponse.body.token;
  });

  describe('GET /api/articles', () => {
    it('should return empty array when no articles exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/articles')
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body.items).toEqual([]);
      expect(response.body).toHaveProperty('total', 0);
    });

    it('should return articles with pagination', async () => {
      // Create 15 test articles
      for (let i = 0; i < 15; i++) {
        await createTestArticle(prisma, {
          title: `Article ${i}`,
          url: `https://example.com/article-${i}-${Date.now()}`,
        });
      }

      const response = await request(app.getHttpServer())
        .get('/api/articles')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.items).toHaveLength(10);
      expect(response.body.total).toBe(15);
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('totalPages', 2);
    });

    it('should filter articles by category', async () => {
      await createTestArticle(prisma, { category: 'Technology' });
      await createTestArticle(prisma, { category: 'Technology' });
      await createTestArticle(prisma, { category: 'Business' });

      const response = await request(app.getHttpServer())
        .get('/api/articles')
        .query({ category: 'Technology' })
        .expect(200);

      expect(response.body.items).toHaveLength(2);
      response.body.items.forEach((article: any) => {
        expect(article.category).toBe('Technology');
      });
    });

    it('should search articles by title', async () => {
      await createTestArticle(prisma, { title: 'Apple launches new iPhone' });
      await createTestArticle(prisma, { title: 'Google announces AI features' });
      await createTestArticle(prisma, { title: 'Microsoft Azure updates' });

      const response = await request(app.getHttpServer())
        .get('/api/articles')
        .query({ search: 'Apple' })
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].title).toContain('Apple');
    });

    it('should search articles by description', async () => {
      await createTestArticle(prisma, {
        title: 'Tech News',
        description: 'Revolutionary AI technology announced',
      });
      await createTestArticle(prisma, {
        title: 'Sports Update',
        description: 'Football match results',
      });

      const response = await request(app.getHttpServer())
        .get('/api/articles')
        .query({ search: 'AI technology' })
        .expect(200);

      expect(response.body.items).toHaveLength(1);
    });

    it('should sort articles by publishedAt descending by default', async () => {
      const article1 = await prisma.article.create({
        data: {
          title: 'Old Article',
          source: 'Test',
          category: 'Technology',
          url: `https://example.com/old-${Date.now()}`,
          publishedAt: new Date('2024-01-01'),
        },
      });

      const article2 = await prisma.article.create({
        data: {
          title: 'New Article',
          source: 'Test',
          category: 'Technology',
          url: `https://example.com/new-${Date.now()}`,
          publishedAt: new Date('2024-06-01'),
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/articles')
        .expect(200);

      expect(response.body.items[0].title).toBe('New Article');
    });
  });

  describe('GET /api/articles/:id', () => {
    it('should return a single article by ID', async () => {
      const article = await createTestArticle(prisma, {
        title: 'Specific Article',
      });

      const response = await request(app.getHttpServer())
        .get(`/api/articles/${article.id}`)
        .expect(200);

      expect(response.body.id).toBe(article.id);
      expect(response.body.title).toBe('Specific Article');
    });

    it('should return 404 for non-existent article', async () => {
      await request(app.getHttpServer())
        .get('/api/articles/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .get('/api/articles/invalid-id')
        .expect(400);
    });
  });

  describe('GET /api/articles/categories', () => {
    it('should return list of available categories', async () => {
      await createTestArticle(prisma, { category: 'Technology' });
      await createTestArticle(prisma, { category: 'Business' });
      await createTestArticle(prisma, { category: 'Sports' });

      const response = await request(app.getHttpServer())
        .get('/api/articles/categories')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toContain('Technology');
      expect(response.body).toContain('Business');
      expect(response.body).toContain('Sports');
    });
  });

  describe('POST /api/articles (Webhook)', () => {
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET || 'dailydigest-n8n-webhook-secret';

    it('should create article with valid webhook secret', async () => {
      const articleData = {
        title: 'New Article from Webhook',
        description: 'Article description',
        content: 'Full article content',
        source: 'AFR',
        category: 'Business',
        url: `https://example.com/webhook-article-${Date.now()}`,
      };

      const response = await request(app.getHttpServer())
        .post('/api/articles')
        .set('x-webhook-secret', webhookSecret)
        .send(articleData)
        .expect(201);

      expect(response.body.title).toBe(articleData.title);
      expect(response.body.source).toBe(articleData.source);
    });

    it('should reject article creation without webhook secret', async () => {
      const articleData = {
        title: 'Unauthorized Article',
        source: 'Test',
        category: 'Technology',
        url: `https://example.com/unauthorized-${Date.now()}`,
      };

      await request(app.getHttpServer())
        .post('/api/articles')
        .send(articleData)
        .expect(401);
    });

    it('should reject article creation with invalid webhook secret', async () => {
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('x-webhook-secret', 'wrong-secret')
        .send({
          title: 'Test',
          source: 'Test',
          category: 'Technology',
          url: `https://example.com/test-${Date.now()}`,
        })
        .expect(401);
    });

    it('should reject duplicate articles (same URL)', async () => {
      const url = `https://example.com/duplicate-${Date.now()}`;

      // First article
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('x-webhook-secret', webhookSecret)
        .send({
          title: 'First Article',
          source: 'Test',
          category: 'Technology',
          url,
        })
        .expect(201);

      // Duplicate article
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('x-webhook-secret', webhookSecret)
        .send({
          title: 'Duplicate Article',
          source: 'Test',
          category: 'Technology',
          url,
        })
        .expect(409);
    });

    it('should normalize category names', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/articles')
        .set('x-webhook-secret', webhookSecret)
        .send({
          title: 'Category Test',
          source: 'Test',
          category: 'technology', // lowercase
          url: `https://example.com/category-test-${Date.now()}`,
        })
        .expect(201);

      expect(response.body.category).toBe('Technology'); // Should be normalized
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/articles')
        .set('x-webhook-secret', webhookSecret)
        .send({
          // Missing required fields
          description: 'Only description',
        })
        .expect(400);
    });
  });
});
