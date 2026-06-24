// src/verificacion/verificacion.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VerificacionController } from './verificacion.controller';
import { VerificacionService } from './verificacion.service';
import { ImageUploadService } from '../common/providers/image-upload.service';

@Module({
  imports: [ConfigModule],
  controllers: [VerificacionController],
  providers: [VerificacionService, ImageUploadService],
  exports: [VerificacionService],
})
export class VerificacionModule {}
