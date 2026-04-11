import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EditorService } from './editor.service';
import { EditorController } from './editor.controller';

@Module({
  imports: [PrismaModule],
  providers: [EditorService],
  controllers: [EditorController],
  exports: [EditorService],
})
export class EditorModule {}
