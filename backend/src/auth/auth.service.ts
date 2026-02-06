import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name } = registerDto;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate verification token
    const verifyToken = randomBytes(32).toString('hex');
    const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await this.usersService.create({
      email,
      passwordHash,
      name,
      verifyToken,
      verifyTokenExp,
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(email, verifyToken, name);

    // Generate token
    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        theme: user.theme,
        emailVerified: user.emailVerified,
      },
      token,
      message: 'Please check your email to verify your account',
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has a password (not OAuth-only user)
    if (!user.passwordHash) {
      throw new UnauthorizedException('Please sign in with Google or Apple');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate token
    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        theme: user.theme,
        emailVerified: user.emailVerified,
        avatarUrl: user.avatarUrl,
      },
      token,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.usersService.findByVerifyToken(token);
    
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.verifyTokenExp && user.verifyTokenExp < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    // Mark email as verified
    await this.usersService.verifyEmail(user.id);

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email, user.name || undefined);

    return { message: 'Email verified successfully' };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      // Don't reveal if user exists
      return { message: 'If this email is registered, a verification link will be sent' };
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token
    const verifyToken = randomBytes(32).toString('hex');
    const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.usersService.updateVerifyToken(user.id, verifyToken, verifyTokenExp);
    await this.emailService.sendVerificationEmail(email, verifyToken, user.name || undefined);

    return { message: 'If this email is registered, a verification link will be sent' };
  }

  async handleGoogleAuth(googleUser: { googleId: string; email: string; name?: string; avatarUrl?: string }) {
    // Check if user exists by Google ID
    let user: any = await this.usersService.findByGoogleId(googleUser.googleId);
    
    if (!user) {
      // Check if user exists by email
      user = await this.usersService.findByEmail(googleUser.email);
      
      if (user) {
        // Link Google account to existing user
        user = await this.usersService.linkGoogleAccount(user.id, googleUser.googleId, googleUser.avatarUrl);
      } else {
        // Create new user
        user = await this.usersService.createOAuthUser({
          email: googleUser.email,
          name: googleUser.name,
          googleId: googleUser.googleId,
          avatarUrl: googleUser.avatarUrl,
          emailVerified: true, // Google verifies email
        });
      }
    }

    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        theme: user.theme,
        emailVerified: user.emailVerified,
        avatarUrl: user.avatarUrl,
      },
      token,
    };
  }

  async handleAppleAuth(appleUser: { appleId: string; email: string; name?: string }) {
    // Check if user exists by Apple ID
    let user: any = await this.usersService.findByAppleId(appleUser.appleId);
    
    if (!user) {
      // Check if user exists by email (Apple may not always provide email)
      if (appleUser.email) {
        user = await this.usersService.findByEmail(appleUser.email);
        
        if (user) {
          // Link Apple account to existing user
          user = await this.usersService.linkAppleAccount(user.id, appleUser.appleId);
        }
      }
      
      if (!user) {
        // Create new user
        user = await this.usersService.createOAuthUser({
          email: appleUser.email || `${appleUser.appleId}@privaterelay.appleid.com`,
          name: appleUser.name,
          appleId: appleUser.appleId,
          emailVerified: true, // Apple verifies email
        });
      }
    }

    const token = this.generateToken(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        theme: user.theme,
        emailVerified: user.emailVerified,
        avatarUrl: user.avatarUrl,
      },
      token,
    };
  }

  async validateUser(userId: string) {
    return this.usersService.findById(userId);
  }

  private generateToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }
}

