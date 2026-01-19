import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ArticlesModule } from './articles/articles.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // NOTE: .env files are blocked in this environment, so we use config.env instead.
      envFilePath: ['config.env'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ArticlesModule,
    BookmarksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

