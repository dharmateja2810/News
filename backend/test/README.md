# Backend Test Suite

Comprehensive end-to-end (E2E) tests for the DailyDigest Backend API.

## Test Files

| File | Description |
|------|-------------|
| `auth.e2e-spec.ts` | Authentication tests: registration, login, JWT validation, email verification |
| `articles.e2e-spec.ts` | Articles tests: CRUD, pagination, filtering, search, webhook |
| `bookmarks.e2e-spec.ts` | Bookmarks tests: save/unsave, like/unlike, listing |
| `users.e2e-spec.ts` | Users tests: profile retrieval, theme preferences |
| `health.e2e-spec.ts` | Health check tests: API status, database connectivity |
| `rate-limiting.e2e-spec.ts` | Rate limiting tests: request throttling, per-user limits |
| `security.e2e-spec.ts` | Security tests: input validation, SQL injection, XSS, authorization |
| `test-utils.ts` | Shared utilities: test app creation, fixtures, cleanup |
| `setup.ts` | Jest global setup configuration |
| `jest-e2e.json` | Jest configuration for E2E tests |

## Running Tests

### Prerequisites

1. **Database must be running:**
   ```bash
   cd backend
   docker compose up -d
   ```

2. **Environment variables:**
   The tests use the same `config.env` as the main application.

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Specific Test File
```bash
npm run test:e2e -- --testPathPattern=auth
npm run test:e2e -- --testPathPattern=articles
npm run test:e2e -- --testPathPattern=security
```

### Run Tests in Watch Mode
```bash
npm run test:e2e -- --watch
```

### Run with Coverage
```bash
npm run test:e2e -- --coverage
```

## Test Categories

### 1. Authentication Tests (`auth.e2e-spec.ts`)
- ✅ User registration with valid data
- ✅ Duplicate email rejection
- ✅ Invalid email format validation
- ✅ Password requirements validation
- ✅ Login with valid credentials
- ✅ Login rejection with wrong password
- ✅ JWT token validation
- ✅ Protected route access
- ✅ Invalid/expired token handling
- ✅ Email verification flow

### 2. Articles Tests (`articles.e2e-spec.ts`)
- ✅ List articles with pagination
- ✅ Filter articles by category
- ✅ Search articles by title/description
- ✅ Sort articles by date
- ✅ Get single article by ID
- ✅ 404 for non-existent articles
- ✅ List available categories
- ✅ Webhook article creation
- ✅ Webhook authentication
- ✅ Duplicate URL rejection
- ✅ Category normalization

### 3. Bookmarks Tests (`bookmarks.e2e-spec.ts`)
- ✅ Bookmark an article
- ✅ Toggle bookmark off
- ✅ Like an article
- ✅ Toggle like off
- ✅ List user bookmarks
- ✅ User data isolation
- ✅ Authentication requirements

### 4. Users Tests (`users.e2e-spec.ts`)
- ✅ Get user profile
- ✅ Update theme preference
- ✅ Theme validation
- ✅ Profile data exclusions (no password)

### 5. Health Tests (`health.e2e-spec.ts`)
- ✅ API status endpoint
- ✅ Health check with database status

### 6. Rate Limiting Tests (`rate-limiting.e2e-spec.ts`)
- ✅ Requests under limit allowed
- 📝 429 response when limit exceeded (spec)
- 📝 Rate limit headers (spec)
- 📝 Per-user rate tracking (spec)
- 📝 Brute force protection (spec)

### 7. Security Tests (`security.e2e-spec.ts`)
- ✅ SQL injection prevention
- ✅ XSS payload handling
- ✅ Long input handling
- ✅ Null byte handling
- ✅ Password hash exclusion
- ✅ User data isolation
- ✅ Webhook secret validation
- ✅ Large payload handling

## Test Utilities

### `createTestApp()`
Creates a configured NestJS test application instance.

### `cleanupDatabase(prisma)`
Clears all test data from the database.

### `createTestUser(prisma, options)`
Creates a test user with hashed password.

### `createTestArticle(prisma, options)`
Creates a test article with default values.

### `generateTestCredentials()`
Generates unique test credentials.

## Writing New Tests

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, cleanupDatabase, createTestUser } from './test-utils';

describe('MyFeature (e2e)', () => {
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

  it('should do something', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/endpoint')
      .expect(200);
    
    expect(response.body).toHaveProperty('expected');
  });
});
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
test:
  script:
    - docker compose up -d
    - npm install
    - npm run test:e2e
    - docker compose down
```

## Notes

- Tests use a real database connection (not mocked)
- Each test file cleans up its data before/after tests
- Some rate limiting tests are commented out as specs until middleware is added
- Tests timeout after 30 seconds by default
