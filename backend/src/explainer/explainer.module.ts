import { Module } from '@nestjs/common';
import { ExplainerService } from './explainer.service';
import { ExplainerController } from './explainer.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExplainerController],
  providers: [ExplainerService],
  exports: [ExplainerService],
})
export class ExplainerModule {}
