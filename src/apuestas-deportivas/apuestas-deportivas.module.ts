import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApuestasDeportivasController } from './apuestas-deportivas.controller';
import { CuponController } from './cupon.controller';
import { ApuestasCoreService } from './services/apuestas-core.service';
import { ApuestasSimuladorService } from './services/apuestas-simulador.service';
import { ApuestasQueryService } from './services/apuestas-query.service';
import { ApuestasCuponesService } from './services/apuestas-cupones.service';

@Module({
  imports: [ConfigModule],
  controllers: [ApuestasDeportivasController, CuponController],
  providers: [
    ApuestasCoreService,
    ApuestasSimuladorService,
    ApuestasQueryService,
    ApuestasCuponesService
  ],
  exports: [
    ApuestasCoreService,
    ApuestasSimuladorService,
    ApuestasQueryService,
    ApuestasCuponesService
  ],
})
export class ApuestasDeportivasModule {}
