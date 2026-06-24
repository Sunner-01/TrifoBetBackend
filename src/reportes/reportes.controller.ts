import {
  Controller,
  Get,
  UseGuards,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportesService } from './reportes.service';

@UseGuards(AuthGuard('jwt'))
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  // Financieros
  @Get('financieros/cashflow')
  getCashflow(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportesService.getCashflow(startDate, endDate);
  }

  @Get('financieros/ggr')
  getGGR(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportesService.getGGR(startDate, endDate);
  }

  @Get('financieros/depositos-metodo')
  getDepositosPorMetodo(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportesService.getDepositosPorMetodo(startDate, endDate);
  }

  @Get('financieros/retiros')
  getRetiros(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportesService.getRetiros(startDate, endDate);
  }

  // Jugadores
  @Get('jugadores/kardex/:id')
  getKardexJugador(@Param('id', ParseIntPipe) id: number) {
    return this.reportesService.getKardexJugador(id);
  }

  @Get('jugadores/top')
  getTopJugadores(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportesService.getTopJugadores(startDate, endDate);
  }

  @Get('jugadores/registros')
  getNuevosRegistros(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportesService.getNuevosRegistros(startDate, endDate);
  }

  // Deportes
  @Get('deportes/historial')
  getApuestasDeportivas(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportesService.getApuestasDeportivas(startDate, endDate);
  }

  // Casino
  @Get('casino/rentabilidad')
  getRentabilidadCasino(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportesService.getRentabilidadCasino(startDate, endDate);
  }

  // Soporte
  @Get('soporte/eficiencia')
  getEficienciaSoporte(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportesService.getEficienciaSoporte(startDate, endDate);
  }
}
