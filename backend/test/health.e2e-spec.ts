/**
 * Health Check E2E Tests
 * Tests for API health and status endpoints
 */

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from './test-utils';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api', () => {
    it('should return API status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('name', 'DailyDigest API');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should include database status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('database');
    });
  });
});
