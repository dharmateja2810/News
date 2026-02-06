/**
 * Users E2E Tests
 * Tests for user profile and preferences
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  cleanupDatabase,
  createTestUser,
} from './test-utils';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testUserEmail: string;

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
    const testUser = await createTestUser(prisma, {
      name: 'Profile Test User',
    });
    testUserEmail = testUser.email;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });
    authToken = loginResponse.body.token;
  });

  describe('GET /api/users/me', () => {
    it('should return current user profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.email).toBe(testUserEmail);
      expect(response.body.name).toBe('Profile Test User');
      expect(response.body).toHaveProperty('theme');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/users/me')
        .expect(401);
    });

    it('should include emailVerified status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('emailVerified');
    });
  });

  describe('PATCH /api/users/theme', () => {
    it('should update theme to dark', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/users/theme')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ theme: 'dark' })
        .expect(200);

      expect(response.body.theme).toBe('dark');
    });

    it('should update theme to light', async () => {
      // First set to dark
      await request(app.getHttpServer())
        .patch('/api/users/theme')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ theme: 'dark' });

      // Then set back to light
      const response = await request(app.getHttpServer())
        .patch('/api/users/theme')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ theme: 'light' })
        .expect(200);

      expect(response.body.theme).toBe('light');
    });

    it('should reject invalid theme values', async () => {
      await request(app.getHttpServer())
        .patch('/api/users/theme')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ theme: 'invalid' })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .patch('/api/users/theme')
        .send({ theme: 'dark' })
        .expect(401);
    });

    it('should persist theme preference', async () => {
      // Update theme
      await request(app.getHttpServer())
        .patch('/api/users/theme')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ theme: 'dark' })
        .expect(200);

      // Verify persistence
      const response = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.theme).toBe('dark');
    });
  });
});
