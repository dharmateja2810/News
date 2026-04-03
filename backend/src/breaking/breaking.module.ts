import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { ExplainerModule } from '../explainer/explainer.module';
import { BreakingService } from './breaking.service';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, ExplainerModule],
  providers: [BreakingService],
  exports: [BreakingService],
})
export class BreakingModule {}
