import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  // Note: Using `origin: '*'` with `credentials: true` is invalid in browsers.
  // For local dev, we reflect the request origin (origin: true). If you want to lock
  // this down, set `CORS_ORIGIN` to a comma-separated allowlist.
  const corsOriginEnv = process.env.CORS_ORIGIN;
  const origin = corsOriginEnv
    ? corsOriginEnv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : true;

  app.enableCors({
    origin,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('DailyDigest API')
    .setDescription('Backend API for DailyDigest news aggregation app')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('articles', 'News articles management')
    .addTag('bookmarks', 'User bookmarks')
    .addTag('users', 'User management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
  🚀 DailyDigest Backend API is running!
  
  📍 API Server: http://localhost:${port}/api
  📚 API Docs: http://localhost:${port}/api/docs
  🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}
  
  Environment: ${process.env.NODE_ENV || 'development'}
  `);
}

bootstrap();

