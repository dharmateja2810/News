# 🚀 DailyDigest Backend API

Backend API for DailyDigest news aggregation mobile application.

## 🛠️ Tech Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT + Passport
- **Documentation**: Swagger/OpenAPI

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL (or use Docker)
- npm or yarn

### Steps

1. **Install dependencies**
```bash
npm install
```

2. **Setup environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start PostgreSQL (using Docker)**
```bash
docker-compose up -d postgres
```

4. **Run database migrations**
```bash
npx prisma migrate dev
```

5. **Seed the database**
```bash
npm run prisma:seed
```

6. **Start the development server**
```bash
npm run start:dev
```

The API will be available at:
- **API**: http://localhost:3000/api
- **Swagger Docs**: http://localhost:3000/api/docs

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Users
- `GET /api/users/me` - Get current user profile
- `PATCH /api/users/theme` - Update theme preference

### Articles
- `GET /api/articles` - List all articles (with pagination)
- `GET /api/articles/:id` - Get single article
- `GET /api/articles/categories` - Get all categories
- `POST /api/articles` - Create article (n8n webhook)

### Bookmarks
- `GET /api/bookmarks` - Get user bookmarks
- `POST /api/bookmarks/:articleId` - Toggle bookmark
- `POST /api/bookmarks/like/:articleId` - Toggle like

## 🗄️ Database

### View Database (Prisma Studio)
```bash
npm run prisma:studio
```

### Create Migration
```bash
npx prisma migrate dev --name migration_name
```

### Reset Database
```bash
npx prisma migrate reset
```

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Access pgAdmin (database management)
# http://localhost:5050
# Email: admin@dailydigest.com
# Password: admin123
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📝 Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/dailydigest"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=3000
CORS_ORIGIN="http://localhost:8081"
N8N_WEBHOOK_SECRET="webhook-secret"
```

## 🚀 Production Deployment

### Build
```bash
npm run build
```

### Run
```bash
npm run start:prod
```

## 📖 Test Credentials

After seeding, use these credentials:
- **Email**: test@dailydigest.com
- **Password**: password123

## 🔗 Integration with n8n

When creating articles from n8n, include the webhook secret in headers:

```http
POST /api/articles
Headers:
  x-webhook-secret: your-webhook-secret
  Content-Type: application/json
```

## 📄 License

MIT

