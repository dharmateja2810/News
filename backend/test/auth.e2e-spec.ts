/**
 * Authentication E2E Tests
 * Tests for registration, login, JWT authentication, and email verification
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  cleanupDatabase,
  createTestUser,
  generateTestCredentials,
  invalidTestData,
} from './test-utils';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
    await app.close();
  });

  beforeEach(async () => {
    // Clean up users before each test
    await prisma.bookmark.deleteMany();
    await prisma.like.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const credentials = generateTestCredentials();

      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(credentials)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(credentials.email);
      expect(response.body.user.name).toBe(credentials.name);
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject registration with existing email', async () => {
      const credentials = generateTestCredentials();

      // First registration
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(credentials)
        .expect(201);

      // Duplicate registration
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(credentials)
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });

    it('should reject registration with invalid email format', async () => {
      for (const invalidEmail of invalidTestData.emails) {
        const response = await request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            email: invalidEmail,
            password: 'ValidPassword123!',
            name: 'Test User',
          })
          .expect(400);

        expect(response.body.message).toBeDefined();
      }
    });

    it('should reject registration with short password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '123',
          name: 'Test User',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should allow registration without name', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `noname${Date.now()}@example.com`,
          password: 'ValidPassword123!',
        })
        .expect(201);

      expect(response.body.user.name).toBeNull();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const testUser = await createTestUser(prisma, {
        email: 'login@example.com',
        password: 'TestPassword123!',
      });

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should reject login with wrong password', async () => {
      const testUser = await createTestUser(prisma);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should reject login with non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        })
        .expect(401);
    });

    it('should reject login with invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'notanemail',
          password: 'Password123!',
        })
        .expect(400);
    });
  });

  describe('JWT Token Validation', () => {
    it('should access protected route with valid token', async () => {
      const testUser = await createTestUser(prisma);

      // Login to get token
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(201);

      const token = loginResponse.body.token;

      // Access protected route
      const response = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.email).toBe(testUser.email);
    });

    it('should reject request without token', async () => {
      await request(app.getHttpServer())
        .get('/api/users/me')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject request with malformed Authorization header', async () => {
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', 'NotBearer token')
        .expect(401);
    });

    it('should reject expired token', async () => {
      // This test requires a token with very short expiration
      // In practice, you'd mock the JWT service or use a pre-generated expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjN9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('should accept request for existing user', async () => {
      const testUser = await createTestUser(prisma, { emailVerified: false });

      const response = await request(app.getHttpServer())
        .post('/api/auth/resend-verification')
        .send({ email: testUser.email })
        .expect(201);

      expect(response.body).toHaveProperty('message');
    });

    it('should not reveal if email exists (security)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' })
        .expect(201);

      // Should return same message regardless of whether email exists
      expect(response.body).toHaveProperty('message');
    });
  });
});
