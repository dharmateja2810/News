/**
 * Bookmarks E2E Tests
 * Tests for bookmarking and liking articles
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

describe('BookmarksController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;

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
    userId = testUser.id;
    
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });
    authToken = loginResponse.body.token;
  });

  describe('POST /api/bookmarks/:articleId', () => {
    it('should bookmark an article', async () => {
      const article = await createTestArticle(prisma);

      const response = await request(app.getHttpServer())
        .post(`/api/bookmarks/${article.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('bookmarked', true);
    });

    it('should toggle bookmark off when bookmarking again', async () => {
      const article = await createTestArticle(prisma);

      // First bookmark
      await request(app.getHttpServer())
        .post(`/api/bookmarks/${article.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Toggle off
      const response = await request(app.getHttpServer())
        .post(`/api/bookmarks/${article.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('bookmarked', false);
    });

    it('should require authentication', async () => {
      const article = await createTestArticle(prisma);

      await request(app.getHttpServer())
        .post(`/api/bookmarks/${article.id}`)
        .expect(401);
    });

    it('should return 404 for non-existent article', async () => {
      await request(app.getHttpServer())
        .post('/api/bookmarks/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /api/bookmarks/like/:articleId', () => {
    it('should like an article', async () => {
      const article = await createTestArticle(prisma);

      const response = await request(app.getHttpServer())
        .post(`/api/bookmarks/like/${article.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('liked', true);
    });

    it('should toggle like off when liking again', async () => {
      const article = await createTestArticle(prisma);

      // First like
      await request(app.getHttpServer())
        .post(`/api/bookmarks/like/${article.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Toggle off
      const response = await request(app.getHttpServer())
        .post(`/api/bookmarks/like/${article.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('liked', false);
    });

    it('should require authentication', async () => {
      const article = await createTestArticle(prisma);

      await request(app.getHttpServer())
        .post(`/api/bookmarks/like/${article.id}`)
        .expect(401);
    });
  });

  describe('GET /api/bookmarks', () => {
    it('should return user bookmarks', async () => {
      const article1 = await createTestArticle(prisma, { title: 'Article 1' });
      const article2 = await createTestArticle(prisma, { title: 'Article 2' });

      // Bookmark both articles
      await request(app.getHttpServer())
        .post(`/api/bookmarks/${article1.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      await request(app.getHttpServer())
        .post(`/api/bookmarks/${article2.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app.getHttpServer())
        .get('/api/bookmarks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should return empty array when no bookmarks', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/bookmarks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/bookmarks')
        .expect(401);
    });

    it('should not return other users bookmarks', async () => {
      const article = await createTestArticle(prisma);

      // First user bookmarks
      await request(app.getHttpServer())
        .post(`/api/bookmarks/${article.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Create second user
      const secondUser = await createTestUser(prisma, {
        email: 'seconduser@example.com',
      });
      const secondLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: secondUser.email,
          password: secondUser.password,
        });

      // Second user should have no bookmarks
      const response = await request(app.getHttpServer())
        .get('/api/bookmarks')
        .set('Authorization', `Bearer ${secondLogin.body.token}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('Bookmark and Like Independence', () => {
    it('should allow independent bookmarking and liking', async () => {
      const article = await createTestArticle(prisma);

      // Bookmark
      await request(app.getHttpServer())
        .post(`/api/bookmarks/${article.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Like
      await request(app.getHttpServer())
        .post(`/api/bookmarks/like/${article.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Verify bookmark still exists
      const bookmarks = await request(app.getHttpServer())
        .get('/api/bookmarks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(bookmarks.body).toHaveLength(1);
    });
  });
});
