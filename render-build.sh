#!/bin/bash
echo "==> Starting build process..."
cd backend
echo "==> Current directory: $(pwd)"
echo "==> Installing dependencies..."
npm install
echo "==> Generating Prisma client..."
npx prisma generate
echo "==> Building NestJS app..."
npm run build
echo "==> Verifying build output..."
ls -la dist/
echo "==> Build complete!"
