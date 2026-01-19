# News App Architecture & Development Plan

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         DEVELOPMENT SETUP                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │   n8n Local  │────────→│  PostgreSQL  │                      │
│  │  (Docker)    │         │  (Docker)    │                      │
│  └──────────────┘         └──────────────┘                      │
│                                 ↑                                │
│  ┌──────────────┐         ┌─────┴──────────┐                    │
│  │ Expo App     │────────→│  API Layer     │                    │
│  │  (Local)     │         │  (Node.js)     │                    │
│  └──────────────┘         └─────┬──────────┘                    │
│                                 │                                │
│                           ┌─────┴──────────┐                    │
│                           │  Redis Cache   │                    │
│                           │  (Docker)      │                    │
│                           └────────────────┘                    │
│                                                                   │
│  ┌──────────────────────────────────────────────────┐            │
│  │  Supabase Auth (Local Emulator)                  │            │
│  │  - Handles user signup/login                     │            │
│  │  - JWT token generation                          │            │
│  │  - OAuth integration (Google, GitHub)            │            │
│  └──────────────────────────────────────────────────┘            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack & Versions

### Frontend (Mobile)
- **Expo CLI**: v51.0.0+
- **React Native**: v0.74.0+ (included with Expo)
- **React**: v18.2.0+
- **TypeScript**: v5.3.0+
- **Axios** or **Fetch API**: for HTTP requests
- **AsyncStorage**: v1.21.0+ (secure token storage)
- **React Query**: v5.0.0+ (optional, for data fetching & caching)

### Backend (API)
- **Node.js**: v20.10.0 LTS
- **Express.js**: v4.18.0+
- **TypeScript**: v5.3.0+
- **express-rate-limit**: v7.1.0+
- **jsonwebtoken**: v9.1.0+ (JWT validation)
- **dotenv**: v16.3.0+ (environment variables)
- **cors**: v2.8.5+

### Data Pipeline
- **n8n**: v1.36.0+ (latest stable)
- **Node.js**: v20.10.0 LTS (required by n8n)

### Databases & Cache
- **PostgreSQL**: v15.5+ (Supabase uses this)
- **Redis**: v7.2+ (caching layer)
- **Supabase Auth**: Emulator (local development)

### DevOps & Tools
- **Docker**: v24.0.0+
- **Docker Compose**: v2.20.0+
- **Git**: v2.42.0+
- **npm**: v10.0.0+
- **Postman** or **Insomnia**: v10.0.0+ (API testing)

---

## Local Development Setup Plan

### Phase 1: Infrastructure Setup (Week 1)

#### Step 1.1: Install Prerequisites
```bash
# Install Docker & Docker Compose
# Download from https://www.docker.com/products/docker-desktop

# Install Node.js v20 LTS
# Download from https://nodejs.org/

# Install Expo CLI
npm install -g expo-cli@latest

# Verify installations
node --version      # v20.10.0+
docker --version    # v24.0.0+
expo --version      # latest
```

#### Step 1.2: Create Docker Compose Setup
Create `docker-compose.yml` at project root:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15.5-alpine
    environment:
      POSTGRES_USER: dev_user
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: news_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - news-network

  redis:
    image: redis:7.2-alpine
    ports:
      - "6379:6379"
    networks:
      - news-network
    volumes:
      - redis_data:/data

  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=false
      - N8N_HOST=localhost
      - N8N_PORT=5678
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n_db
      - DB_POSTGRESDB_USER=dev_user
      - DB_POSTGRESDB_PASSWORD=dev_password
    depends_on:
      - postgres
    networks:
      - news-network
    volumes:
      - n8n_data:/home/node/.n8n

  supabase-auth-emulator:
    image: supabase/gotrue:latest
    ports:
      - "9999:9999"
    environment:
      GOTRUE_JWT_SECRET: your-super-secret-jwt-key-min-32-chars
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      API_EXTERNAL_URL: "http://localhost:9999"
    networks:
      - news-network

volumes:
  postgres_data:
  redis_data:
  n8n_data:

networks:
  news-network:
    driver: bridge
```

#### Step 1.3: Start Docker Services
```bash
docker-compose up -d

# Verify all services are running
docker-compose ps

# Access services:
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - n8n UI: http://localhost:5678
# - Auth Emulator: http://localhost:9999
```

---
