import { Controller, Get, Param, Post, HttpCode } from '@nestjs/common';
import { ExplainerService } from './explainer.service';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('explainer')
@Controller('explainer')
export class ExplainerController {
  constructor(private readonly explainerService: ExplainerService) {}

  @Get('article/:articleId')
  @ApiOperation({ summary: 'Get the Double Click explainer for an article' })
  @ApiParam({ name: 'articleId' })
  async getExplainer(@Param('articleId') articleId: string) {
    // Ideally this just fetches it. For demo, we are optionally generating it if not exists.
    try {
      const explainer = await this.explainerService.generateExplainer(articleId);
      return { success: true, explainer };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Post('article/:articleId/generate')
  @ApiOperation({ summary: 'Force trigger explainer generation for an article' })
  @ApiParam({ name: 'articleId' })
  @HttpCode(200)
  async triggerGeneration(@Param('articleId') articleId: string) {
    try {
      // In a real app we'd trigger a background worker. Here we await it.
      const explainer = await this.explainerService.generateExplainer(articleId);
      return { success: true, explainer };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Post('cluster/:clusterId/generate')
  @ApiOperation({ summary: 'Generate full Double Click package for a story cluster' })
  @ApiParam({ name: 'clusterId' })
  @HttpCode(200)
  async generateForCluster(@Param('clusterId') clusterId: string) {
    try {
      const result = await this.explainerService.generateForCluster(clusterId);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}
