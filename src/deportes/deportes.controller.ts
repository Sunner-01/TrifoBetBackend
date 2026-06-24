import { Controller, Get, Query } from '@nestjs/common';
import { DeportesService } from './deportes.service';

@Controller('deportes')
export class DeportesController {
  constructor(private readonly deportesService: DeportesService) {}

  @Get('futbol/partidos')
  async obtenerPartidos(@Query('fecha') fecha?: string) {
    return this.deportesService.obtenerPartidosFutbol(fecha);
  }
}
