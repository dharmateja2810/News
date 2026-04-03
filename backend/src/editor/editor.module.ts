import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExplainerModule } from '../explainer/explainer.module';
import { EditorService } from './editor.service';
import { EditorController } from './editor.controller';

@Module({
  imports: [PrismaModule, ExplainerModule],
  providers: [EditorService],
  controllers: [EditorController],
  exports: [EditorService],
})
export class EditorModule {}
