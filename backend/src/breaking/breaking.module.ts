import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { BreakingService } from './breaking.service';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [BreakingService],
  exports: [BreakingService],
})
export class BreakingModule {}
