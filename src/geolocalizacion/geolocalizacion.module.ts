import { Module } from '@nestjs/common';
import { GeolocalizacionController } from './geolocalizacion.controller';
import { GeolocalizacionService } from './geolocalizacion.service';

@Module({
  controllers: [GeolocalizacionController],
  providers: [GeolocalizacionService],
  exports: [GeolocalizacionService], // Exportar por si otros módulos lo necesitan
})
export class GeolocalizacionModule {}
