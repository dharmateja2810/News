import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class UpdateThemeDto {
  @ApiProperty({ example: 'dark', enum: ['light', 'dark'] })
  @IsString()
  @IsIn(['light', 'dark'])
  theme: string;
}

