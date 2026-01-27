import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, IsOptional, IsDateString } from 'class-validator';

export class CreateArticleDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty()
  @IsString()
  source: string;

  @ApiProperty()
  @IsString()
  category: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiProperty()
  @IsUrl()
  url: string;
}

