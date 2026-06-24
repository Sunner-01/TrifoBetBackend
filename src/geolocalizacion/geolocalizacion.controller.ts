import { Controller, Post, Body } from '@nestjs/common';
import { GeolocalizacionService } from './geolocalizacion.service';
import { VerificarUbicacionDto } from './dto/verificar-ubicacion.dto';

@Controller('geolocalizacion')
export class GeolocalizacionController {
  constructor(
    private readonly geolocalizacionService: GeolocalizacionService,
  ) {}

  /**
   * Endpoint para verificar si coordenadas están dentro de Bolivia
   * POST /geolocalizacion/verificar
   * Body: { lat: number, lng: number }
   * Response: { dentroDeBolivia: boolean }
   */
  @Post('verificar')
  async verificarUbicacion(@Body() dto: VerificarUbicacionDto) {
    const dentroDeBolivia =
      await this.geolocalizacionService.verificarDentroDeBolivia(
        dto.lat,
        dto.lng,
      );

    return {
      dentroDeBolivia,
    };
  }
}
