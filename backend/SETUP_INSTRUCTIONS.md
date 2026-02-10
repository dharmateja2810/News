# 🎯 **Complete Backend Setup Instructions**

Follow these steps to get your DailyDigest backend API running!

---

## 📋 **Prerequisites**

Make sure you have these installed:
- ✅ **Node.js** v18 or higher ([Download](https://nodejs.org/))
- ✅ **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- ✅ **Git** (for version control)

---

## 🚀 **Step-by-Step Setup**

### **Step 1: Navigate to Backend Directory**

```bash
cd backend
```

### **Step 2: Install Dependencies**

```bash
npm install
```

This will install all required packages including NestJS, Prisma, and authentication libraries.

### **Step 3: Start PostgreSQL Database**

```bash
# Start database with Docker
docker-compose up -d postgres

# Verify it's running
docker-compose ps
```

You should see `dailydigest-postgres` running on port 5432.

### **Step 4: Generate Prisma Client**

```bash
npx prisma generate
```

This creates the TypeScript types for your database models.

### **Step 5: Run Database Migrations**

```bash
npx prisma migrate dev
```

When prompted for a migration name, type: `init`

This creates all the tables (users, articles, bookmarks, likes, categories).

### **Step 6: Seed the Database**

```bash
npm run prisma:seed
```

This adds:
- ✅ 8 default categories
- ✅ Test user (test@dailydigest.com / password123)
- ✅ 3 sample articles

### **Step 7: Start the Development Server**

```bash
npm run start:dev
```

You should see:
```
🚀 DailyDigest Backend API is running!

📍 API Server: http://localhost:3000/api
📚 API Docs: http://localhost:3000/api/docs
🗄️  Database: Connected

Environment: development
```

---

## ✅ **Verify Everything Works**

### **1. Open Swagger Documentation**

Go to: http://localhost:3000/api/docs

You'll see an interactive API documentation with all endpoints.

### **2. Test the Login Endpoint**

Click on `POST /api/auth/login` → "Try it out"

Enter:
```json
{
  "email": "test@dailydigest.com",
  "password": "password123"
}
```

Click "Execute" - You should get a token back!

### **3. Open Prisma Studio (Database GUI)**

In a new terminal:
```bash
npm run prisma:studio
```

Opens at: http://localhost:5555

You can view and edit your database records here.

---

## 🔧 **Useful Commands**

```bash
# Development
npm run start:dev          # Start dev server with hot reload
npm run build              # Build for production
npm run start:prod         # Run production build

# Database
npx prisma studio          # Open database GUI
npx prisma migrate dev     # Create new migration
npx prisma migrate reset   # Reset database (deletes all data!)
npm run prisma:seed        # Re-seed database

# Docker
docker-compose up -d       # Start all services
docker-compose down        # Stop all services
docker-compose logs -f     # View logs
docker-compose restart     # Restart services
```

---

## 📊 **Optional: Install pgAdmin**

If you want a full database management UI:

```bash
docker-compose up -d pgadmin
```

Access at: http://localhost:5050
- Email: `admin@dailydigest.com`
- Password: `admin123`

To connect to database:
- Host: `postgres` (in Docker) or `localhost` (from host)
- Port: `5432`
- Database: `dailydigest`
- Username: `dailydigest`
- Password: `dailydigest123`

---

## 🧪 **Test the API**

### **Using cURL**

```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "yourname@example.com",
    "password": "YourPassword123",
    "name": "Your Name"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@dailydigest.com",
    "password": "password123"
  }'

# Get articles (replace YOUR_TOKEN)
curl http://localhost:3000/api/articles \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Using Postman/Insomnia**

1. Import the Swagger JSON from http://localhost:3000/api/docs-json
2. Test all endpoints interactively

---

## 🐛 **Troubleshooting**

### **Database Connection Error**

```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart it
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

### **Port 3000 Already in Use**

Edit `.env` file:
```env
PORT=3000
```

Then restart the server.

### **Prisma Client Not Generated**

```bash
npx prisma generate
```

### **Migration Errors**

```bash
# Reset everything (WARNING: Deletes all data!)
npx prisma migrate reset

# Then seed again
npm run prisma:seed
```

### **Module Not Found Errors**

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

---

## 📁 **Project Structure**

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts           # Seed data
├── src/
│   ├── auth/             # Authentication (JWT, login, register)
│   ├── users/            # User management
│   ├── articles/         # News articles CRUD
│   ├── bookmarks/        # Bookmarks & likes
│   ├── prisma/           # Prisma service
│   ├── app.module.ts     # Main app module
│   └── main.ts           # Entry point
├── docker-compose.yml    # Database containers
├── .env                  # Environment variables
└── package.json          # Dependencies
```

---

## 🎯 **Next Steps**

1. ✅ **Test all endpoints** in Swagger docs
2. ✅ **View data** in Prisma Studio
3. ✅ **Setup n8n** for news scraping (see n8n guide)
4. ✅ **Connect mobile app** to this backend
5. ✅ **Deploy to production** (Railway, Render, or AWS)

---

## 📝 **Default Test Credentials**

- **Email**: `test@dailydigest.com`
- **Password**: `password123`

---

## 🆘 **Need Help?**

- Check the logs: `docker-compose logs -f`
- View Swagger docs: http://localhost:3000/api/docs
- Open Prisma Studio: `npm run prisma:studio`

---

**Backend is ready! Now let's set up n8n for news scraping! 🚀**

