import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'API root (health summary)' })
  root() {
    return {
      ok: true,
      service: 'dailydigest-backend',
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  health() {
    return {
      ok: true,
      status: 'healthy',
    };
  }
}


