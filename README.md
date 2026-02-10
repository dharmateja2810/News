# DailyDigest - Cross-Platform News Application

A comprehensive news aggregation system with mobile applications for iOS/Android/Web, a NestJS backend API, and automated news scraping with AI summarization.

## 🏗 Project Structure

```
News/
├── backend/               # NestJS API (Node.js/TypeScript)
├── news-app/              # Mobile & Web app (Expo/React Native)
├── automation/            # News scrapers & n8n workflows
│   ├── scraper/           # Python web scraper with Ollama AI
│   └── n8n/               # n8n automation workflows
├── README.md              # This file
├── plan.md                # Development plan & architecture
├── QUICKSTART.md          # Quick start guide
└── PUBLISH_GUIDE.md       # App store publishing guide
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL (via Docker or local)
- Ollama (for AI summarization, optional)

### 1. Start the Database
```bash
cd backend
docker compose up -d
```

### 2. Start the Backend
```bash
cd backend
npm install
npx prisma migrate dev
npm run start:dev
```

### 3. Start the Mobile/Web App
```bash
cd news-app
npm install
npm run web    # For web browser
npm start      # For mobile (Expo Go)
```

---

## 📁 Complete File Reference

### Root Directory

| File | Description |
|------|-------------|
| `README.md` | Main project documentation (this file) |
| `plan.md` | Architecture plan with system diagrams and technology stack |
| `QUICKSTART.md` | Quick start guide for running the frontend app |
| `PUBLISH_GUIDE.md` | Guide for publishing to Expo, Play Store, and App Store |

---

### Backend (`/backend`)

#### Configuration Files

| File | Description |
|------|-------------|
| `package.json` | Node.js dependencies: NestJS, Prisma, JWT, bcrypt, AWS SES |
| `tsconfig.json` | TypeScript config with ES2021 target and strict mode |
| `nest-cli.json` | NestJS CLI configuration for source root and compiler |
| `config.env` | Environment variables: database, JWT, OAuth, AWS SES settings |
| `docker-compose.yml` | Docker setup for PostgreSQL database and pgAdmin UI |
| `README.md` | Backend API documentation with endpoints and setup |
| `ARCHITECTURE.md` | System architecture diagrams and data flow |
| `QUICKSTART.md` | Quick setup guide for backend development |
| `SETUP_INSTRUCTIONS.md` | Detailed step-by-step setup instructions |

#### Prisma (`/backend/prisma`)

| File | Description |
|------|-------------|
| `schema.prisma` | Database schema: User, Article, Bookmark, Like models with OAuth fields |
| `seed.ts` | Seeder that creates categories, test user, and sample articles |
| `migrations/` | SQL migrations for database schema changes |

#### Source (`/backend/src`)

| File | Description |
|------|-------------|
| `main.ts` | App entry point: CORS, validation pipes, Swagger docs setup |
| `app.module.ts` | Root module importing Auth, Users, Articles, Bookmarks, Prisma modules |

#### Auth Module (`/backend/src/auth`)

| File | Description |
|------|-------------|
| `auth.controller.ts` | Endpoints: register, login, verify-email, Google/Apple OAuth |
| `auth.service.ts` | Auth logic: password hashing, JWT tokens, OAuth handling |
| `auth.module.ts` | Auth module with JWT and Passport integration |
| `jwt.strategy.ts` | Passport strategy for validating Bearer tokens |
| `jwt-auth.guard.ts` | Guard for protecting routes with JWT authentication |
| `dto/register.dto.ts` | DTO for registration: email, password, name validation |
| `dto/login.dto.ts` | DTO for login: email and password validation |
| `strategies/google.strategy.ts` | Passport Google OAuth strategy (optional) |
| `strategies/apple.strategy.ts` | Passport Apple OAuth strategy (optional) |

#### Articles Module (`/backend/src/articles`)

| File | Description |
|------|-------------|
| `articles.controller.ts` | REST endpoints: CRUD, pagination, search, webhook for scrapers |
| `articles.service.ts` | Business logic: category normalization, duplicate detection |
| `articles.module.ts` | NestJS module for articles feature |
| `dto/create-article.dto.ts` | DTO for article creation with validation decorators |

#### Bookmarks Module (`/backend/src/bookmarks`)

| File | Description |
|------|-------------|
| `bookmarks.controller.ts` | Endpoints for bookmark/like toggle operations (JWT protected) |
| `bookmarks.service.ts` | Logic for toggling saves/likes, fetching user's saved articles |
| `bookmarks.module.ts` | NestJS module for bookmarks feature |

#### Users Module (`/backend/src/users`)

| File | Description |
|------|-------------|
| `users.controller.ts` | Endpoints for profile retrieval and theme preference updates |
| `users.service.ts` | User CRUD operations and OAuth account linking |
| `users.module.ts` | NestJS module for users feature |

#### Email Module (`/backend/src/email`)

| File | Description |
|------|-------------|
| `email.service.ts` | AWS SES integration for verification/welcome emails with HTML templates |
| `email.module.ts` | NestJS module for email service |

#### Prisma Module (`/backend/src/prisma`)

| File | Description |
|------|-------------|
| `prisma.service.ts` | Prisma client wrapper with connection lifecycle management |
| `prisma.module.ts` | Global module exporting Prisma service to all modules |

#### Health Module (`/backend/src/health`)

| File | Description |
|------|-------------|
| `health.controller.ts` | Health check endpoints for `/api` root and `/api/health` |

#### Test Suite (`/backend/test`)

| File | Description |
|------|-------------|
| `README.md` | Test suite documentation with running instructions |
| `jest-e2e.json` | Jest configuration for end-to-end tests |
| `setup.ts` | Global test setup and configuration |
| `test-utils.ts` | Shared utilities: test app creation, fixtures, database cleanup |
| `auth.e2e-spec.ts` | Authentication tests: registration, login, JWT, email verification |
| `articles.e2e-spec.ts` | Articles tests: CRUD, pagination, filtering, search, webhook |
| `bookmarks.e2e-spec.ts` | Bookmarks tests: save/unsave, like/unlike, listing |
| `users.e2e-spec.ts` | Users tests: profile retrieval, theme preferences |
| `health.e2e-spec.ts` | Health check tests: API status, database connectivity |
| `rate-limiting.e2e-spec.ts` | Rate limiting tests: request throttling, brute force protection |
| `security.e2e-spec.ts` | Security tests: SQL injection, XSS, input validation, authorization |

---

### Mobile App (`/news-app`)

#### Configuration Files

| File | Description |
|------|-------------|
| `package.json` | Dependencies: Expo 54, React Navigation, Zustand, OAuth packages |
| `App.tsx` | Root component wrapping app with providers and navigation |
| `index.ts` | Expo app registration entry point |
| `app.json` | Expo config: app name, icons, splash screen, EAS build settings |
| `tsconfig.json` | TypeScript config extending Expo's base with strict mode |
| `babel.config.js` | Babel configuration using babel-preset-expo |
| `metro.config.js` | Metro bundler configuration |
| `eas.json` | EAS Build config for development, preview, and production |
| `README.md` | Mobile app documentation with features and setup |
| `BUILD_APK.txt` | Instructions for building Android APK using EAS |
| `PUBLISH_NOW.md` | Quick guide for publishing the app |

#### Components (`/news-app/src/components`)

| File | Description |
|------|-------------|
| `index.ts` | Barrel export for all reusable UI components |
| `NewsCard.tsx` | Article card with default/featured/compact variants; bookmark toggle |
| `CategoryChip.tsx` | Tappable category filter chip with selected/unselected states |
| `LoadingSpinner.tsx` | Activity indicator with optional message and fullscreen mode |
| `EmptyState.tsx` | Empty state placeholder with icon, title, and message |
| `TabBar.tsx` | Custom bottom tab bar with Home, Search, Saved, Profile tabs |

#### Screens (`/news-app/src/screens`)

| File | Description |
|------|-------------|
| `index.ts` | Barrel export for all screen components |
| `HomeScreen.tsx` | Main news feed with category filters, pull-to-refresh, infinite scroll |
| `LoginScreen.tsx` | Login form with email/password and Google/Apple OAuth buttons |
| `SignupScreen.tsx` | Registration form with OAuth options and password confirmation |

#### Navigation (`/news-app/src/navigation`)

| File | Description |
|------|-------------|
| `AppNavigator.tsx` | Root navigation: auth flow (Login/Signup) vs authenticated (Home) |
| `types.ts` | TypeScript definitions for navigation stacks and screen props |

#### Services (`/news-app/src/services`)

| File | Description |
|------|-------------|
| `api.ts` | Axios client with JWT injection, 401 handling, platform-aware base URL |
| `newsService.ts` | News fetching with pagination, category filtering, backend mapping |
| `articlesApi.ts` | Articles API functions with TypeScript interfaces |
| `authApi.ts` | Auth API: login, register, Google/Apple OAuth token exchange |
| `bookmarksApi.ts` | Bookmarks API: toggle saves/likes, list saved articles |
| `usersApi.ts` | Users API: fetch profile, update theme preference |

#### State Management (`/news-app/src/store`)

| File | Description |
|------|-------------|
| `index.ts` | Zustand stores for auth, news, bookmarks, and theme state |

#### Contexts (`/news-app/src/contexts`)

| File | Description |
|------|-------------|
| `AuthContext.tsx` | Auth context: JWT storage, Google/Apple OAuth, session management |
| `ThemeContext.tsx` | Theme context: light/dark mode toggle with persistent storage |
| `SavedArticlesContext.tsx` | Bookmarks context with optimistic updates and backend sync |

#### Types (`/news-app/src/types`)

| File | Description |
|------|-------------|
| `index.ts` | TypeScript interfaces: NewsArticle, User, AuthState, NewsState, API responses |

#### Constants (`/news-app/src/constants`)

| File | Description |
|------|-------------|
| `appConfig.ts` | App config: API URLs (platform-aware), rate limits, pagination, OAuth |

#### Theme (`/news-app/src/theme`)

| File | Description |
|------|-------------|
| `index.ts` | Theme entry point combining colors, typography, spacing into themes |
| `colors.ts` | Color palettes for light/dark modes with semantic and category colors |
| `typography.ts` | Typography system: font sizes, weights, line heights, text presets |
| `spacing.ts` | Spacing system: consistent margins, paddings, border radii, shadows |

#### Utilities (`/news-app/src/utils`)

| File | Description |
|------|-------------|
| `dateUtils.ts` | Date formatting: relative time ("2 hours ago"), truncation |
| `hooks.ts` | Custom hooks: `useTheme`, `useDebounce` for search |
| `storage.ts` | AsyncStorage wrapper for persisting tokens, user, bookmarks, theme |

---

### Automation (`/automation`)

#### Python Scraper (`/automation/scraper`)

| File | Description |
|------|-------------|
| `scrape_afr.py` | Web scraper for AFR news with Ollama LLM summarization |
| `requirements.txt` | Python dependencies: requests, beautifulsoup4, python-dotenv |

#### n8n Workflows (`/automation/n8n`)

| File | Description |
|------|-------------|
| `README.md` | n8n automation setup guide and workflow import instructions |
| `docker-compose.yml` | Docker Compose config for running n8n with backend webhook |
| `start.ps1` | PowerShell script to run n8n locally via npx |
| `workflows/afr-homepage-to-backend.json` | n8n workflow: scrape AFR, summarize with Gemini, post to backend |

---

## 🎯 Key Features

### Backend API
- ✅ JWT authentication with email/password
- ✅ Google & Apple OAuth (configurable)
- ✅ Email verification via AWS SES
- ✅ Articles CRUD with pagination and search
- ✅ Bookmarks and likes system
- ✅ PostgreSQL database with Prisma ORM

### Mobile/Web App
- ✅ Cross-platform (iOS, Android, Web)
- ✅ 8 news categories with filtering
- ✅ Pull-to-refresh and infinite scroll
- ✅ Light/dark mode theming
- ✅ Offline-capable with local storage

### News Automation
- ✅ Python scraper for AFR (Australian Financial Review)
- ✅ AI-powered article summarization via Ollama
- ✅ Webhook integration with backend
- ✅ n8n workflow support

---

## 📊 Summary Statistics

| Component | Files |
|-----------|-------|
| Backend | ~26 files |
| Mobile App | ~29 files |
| Automation | ~5 files |
| Documentation | ~4 files |
| **Total** | **~64 files** |

---

## 🔧 Environment Variables

### Backend (`backend/config.env`)
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/dailydigest"
JWT_SECRET="your-jwt-secret"
GOOGLE_CLIENT_ID=""          # Optional: Google OAuth
APPLE_CLIENT_ID=""           # Optional: Apple OAuth
AWS_ACCESS_KEY_ID=""         # Optional: AWS SES for emails
```

### Mobile App
```env
EXPO_PUBLIC_API_URL="http://localhost:3000/api"
```

---

## 📄 License

MIT License - Free to use for personal and commercial projects

---

**Built with ❤️ using NestJS, React Native, Expo, and Prisma**

