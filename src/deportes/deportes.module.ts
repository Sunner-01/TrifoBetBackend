import { Module } from '@nestjs/common';
import { DeportesService } from './deportes.service';
import { DeportesController } from './deportes.controller';
import { FootballApiService } from './football-api.service';
import { CuotasGeneratorService } from './cuotas-generator.service';

@Module({
  providers: [DeportesService, FootballApiService, CuotasGeneratorService],
  controllers: [DeportesController],
})
export class DeportesModule {}
