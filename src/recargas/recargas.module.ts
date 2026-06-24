// src/recargas/recargas.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RecargasController } from './recargas.controller';
import { RecargasService } from './recargas.service';
import { YapeParserService } from './yape-parser.service';
import { ImageUploadService } from '../common/providers/image-upload.service';

@Module({
  imports: [ConfigModule],
  controllers: [RecargasController],
  // DIP: RecargasService depende de YapeParserService e ImageUploadService a través del contenedor de DI
  providers: [RecargasService, YapeParserService, ImageUploadService],
  exports: [RecargasService],
})
export class RecargasModule {}
