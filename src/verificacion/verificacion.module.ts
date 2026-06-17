import { Module } from '@nestjs/common';
import { VerificacionController } from './verificacion.controller';
import { VerificacionService } from './verificacion.service';

@Module({
  controllers: [VerificacionController],
  providers: [VerificacionService],
  exports: [VerificacionService],
})
export class VerificacionModule {}
