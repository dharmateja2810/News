import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'API root (health summary)' })
  root() {
    return {
      status: 'ok',
      name: 'DailyDigest API',
      version: '1.0',
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  async health() {
    let database = 'unknown';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'connected';
    } catch {
      database = 'disconnected';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database,
    };
  }
}


