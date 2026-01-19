import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateThemeDto } from './dto/update-theme.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  async getProfile(@Request() req) {
    return req.user;
  }

  @Patch('theme')
  @ApiOperation({ summary: 'Update user theme preference' })
  @ApiResponse({ status: 200, description: 'Theme updated successfully' })
  async updateTheme(@Request() req, @Body() updateThemeDto: UpdateThemeDto) {
    return this.usersService.updateTheme(req.user.id, updateThemeDto.theme);
  }
}

