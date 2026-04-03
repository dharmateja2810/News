import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublisherService } from './publisher.service';
import { PublisherController } from './publisher.controller';

@Module({
  imports: [PrismaModule],
  providers: [PublisherService],
  controllers: [PublisherController],
  exports: [PublisherService],
})
export class PublisherModule {}
