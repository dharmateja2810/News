import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: { 
    email: string; 
    passwordHash: string; 
    name?: string;
    verifyToken?: string;
    verifyTokenExp?: Date;
  }) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    try {
      return await this.prisma.user.create({
        data,
        select: {
          id: true,
          email: true,
          name: true,
          theme: true,
          emailVerified: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('User with this email already exists');
      }
      throw error;
    }
  }

  async createOAuthUser(data: {
    email: string;
    name?: string;
    googleId?: string;
    appleId?: string;
    avatarUrl?: string;
    emailVerified: boolean;
  }) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

    return this.prisma.user.create({
      data: {
        ...data,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        theme: true,
        emailVerified: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        theme: true,
        emailVerified: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({
      where: { googleId },
    });
  }

  async findByAppleId(appleId: string) {
    return this.prisma.user.findUnique({
      where: { appleId },
    });
  }

  async findByVerifyToken(verifyToken: string) {
    return this.prisma.user.findFirst({
      where: { verifyToken },
    });
  }

  async verifyEmail(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        verifyToken: null,
        verifyTokenExp: null,
      },
    });
  }

  async updateVerifyToken(userId: string, verifyToken: string, verifyTokenExp: Date) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { verifyToken, verifyTokenExp },
    });
  }

  async linkGoogleAccount(userId: string, googleId: string, avatarUrl?: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { 
        googleId, 
        avatarUrl: avatarUrl || undefined,
        emailVerified: true,
      },
    });
  }

  async linkAppleAccount(userId: string, appleId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { 
        appleId,
        emailVerified: true,
      },
    });
  }

  async updateTheme(userId: string, theme: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { theme },
      select: {
        id: true,
        email: true,
        name: true,
        theme: true,
        emailVerified: true,
        avatarUrl: true,
      },
    });
  }
}

