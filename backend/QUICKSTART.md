# ⚡ Quick Start Guide

Get the DailyDigest backend running in 5 minutes!

## 🚀 Fast Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Setup Environment
```bash
# Copy environment file
cp .env.example .env

# The default .env works out of the box!
```

### 3. Start Database
```bash
# Start PostgreSQL with Docker
docker-compose up -d postgres

# Wait a few seconds for database to be ready
```

### 4. Setup Database
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed with test data
npm run prisma:seed
```

### 5. Start Server
```bash
npm run start:dev
```

## ✅ You're Ready!

🎉 **API is running!**
- API: http://localhost:3000/api
- Docs: http://localhost:3000/api/docs

## 🧪 Test It Out

### 1. Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123",
    "name": "New User"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@dailydigest.com",
    "password": "password123"
  }'
```

Copy the `token` from the response!

### 3. Get Articles
```bash
curl http://localhost:3000/api/articles \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🎯 Next Steps

1. **Test all endpoints** → Open http://localhost:3000/api/docs
2. **View database** → Run `npm run prisma:studio`
3. **Setup n8n** → See n8n integration guide
4. **Connect mobile app** → Update API URL in React Native app

## 🐛 Troubleshooting

**Database connection failed?**
```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart if needed
docker-compose restart postgres
```

**Port 3000 already in use?**
```bash
# Change PORT in .env file
PORT=3000
```

**Prisma errors?**
```bash
# Reset everything and start fresh
npx prisma migrate reset
npm run prisma:seed
```

## 📚 Test Credentials

- Email: `test@dailydigest.com`
- Password: `password123`

Happy coding! 🚀

