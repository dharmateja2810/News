import { Module } from '@nestjs/common';
import { NormaliserService } from './normaliser.service';

@Module({
  providers: [NormaliserService],
  exports: [NormaliserService],
})
export class NormaliserModule {}
