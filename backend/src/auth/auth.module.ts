import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';

// Conditionally import OAuth strategies
const optionalProviders: any[] = [];

@Module({
  imports: [
    UsersModule,
    EmailModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    // Google Strategy - only register if configured
    {
      provide: 'GOOGLE_STRATEGY',
      useFactory: (configService: ConfigService) => {
        const clientId = configService.get<string>('GOOGLE_CLIENT_ID');
        if (!clientId) {
          console.log('[AuthModule] Google OAuth not configured - skipping GoogleStrategy');
          return null;
        }
        const { GoogleStrategy } = require('./strategies/google.strategy');
        return new GoogleStrategy(configService);
      },
      inject: [ConfigService],
    },
    // Apple Strategy - only register if configured
    {
      provide: 'APPLE_STRATEGY',
      useFactory: (configService: ConfigService) => {
        const clientId = configService.get<string>('APPLE_CLIENT_ID');
        if (!clientId) {
          console.log('[AuthModule] Apple OAuth not configured - skipping AppleStrategy');
          return null;
        }
        const { AppleStrategy } = require('./strategies/apple.strategy');
        return new AppleStrategy(configService);
      },
      inject: [ConfigService],
    },
  ],
  controllers: [AuthController],
})
export class AuthModule {}

