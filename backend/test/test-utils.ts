/**
 * Test Utilities
 * Helper functions for creating test fixtures and mocks
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * Create and configure a test application instance
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  
  // Increase request size limits for tests
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  
  // Enable CORS for preflight tests
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  // Apply same configuration as main.ts
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  
  await app.init();
  return app;
}

/**
 * Clean up test database
 */
export async function cleanupDatabase(prisma: PrismaService): Promise<void> {
  // Delete in order to respect foreign key constraints
  await prisma.bookmark.deleteMany();
  await prisma.like.deleteMany();
  await prisma.article.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Create a test user with hashed password
 */
export async function createTestUser(
  prisma: PrismaService,
  data: {
    email?: string;
    password?: string;
    name?: string;
    emailVerified?: boolean;
  } = {},
): Promise<{ id: string; email: string; password: string }> {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const email = data.email || `test-${uniqueSuffix}@example.com`;
  const password = data.password || 'TestPassword123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: data.name || 'Test User',
      emailVerified: data.emailVerified ?? true,
    },
  });

  return { id: user.id, email, password };
}

/**
 * Create a test article
 */
export async function createTestArticle(
  prisma: PrismaService,
  data: Partial<{
    title: string;
    description: string;
    content: string;
    source: string;
    category: string;
    url: string;
  }> = {},
): Promise<{ id: string; title: string; url: string }> {
  const article = await prisma.article.create({
    data: {
      title: data.title || `Test Article ${Date.now()}`,
      description: data.description || 'Test article description',
      content: data.content || 'Test article content',
      source: data.source || 'Test Source',
      category: data.category || 'Technology',
      url: data.url || `https://example.com/article-${Date.now()}`,
    },
  });

  return { id: article.id, title: article.title, url: article.url };
}

/**
 * Generate valid test credentials
 */
export function generateTestCredentials(): { email: string; password: string; name: string } {
  const timestamp = Date.now();
  return {
    email: `testuser${timestamp}@example.com`,
    password: 'SecurePassword123!',
    name: `Test User ${timestamp}`,
  };
}

/**
 * Generate invalid test data for validation testing
 */
export const invalidTestData = {
  emails: [
    '',
    'notanemail',
    'missing@domain',
    '@nodomain.com',
    'spaces in@email.com',
  ],
  passwords: [
    '',
    '123', // too short
    'short',
  ],
};
