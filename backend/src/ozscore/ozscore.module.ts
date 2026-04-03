import { Module } from '@nestjs/common';
import { OzscoreService } from './ozscore.service';

@Module({
  providers: [OzscoreService],
  exports: [OzscoreService],
})
export class OzscoreModule {}
