import { Controller, Get, UseGuards, Param, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportesService } from './reportes.service';

@UseGuards(AuthGuard('jwt'))
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  // Financieros
  @Get('financieros/cashflow')
  getCashflow() {
    return this.reportesService.getCashflow();
  }

  @Get('financieros/ggr')
  getGGR() {
    return this.reportesService.getGGR();
  }

  @Get('financieros/depositos-metodo')
  getDepositosPorMetodo() {
    return this.reportesService.getDepositosPorMetodo();
  }

  @Get('financieros/retiros')
  getRetiros() {
    return this.reportesService.getRetiros();
  }

  // Jugadores
  @Get('jugadores/kardex/:id')
  getKardexJugador(@Param('id', ParseIntPipe) id: number) {
    return this.reportesService.getKardexJugador(id);
  }

  @Get('jugadores/top')
  getTopJugadores() {
    return this.reportesService.getTopJugadores();
  }

  @Get('jugadores/registros')
  getNuevosRegistros() {
    return this.reportesService.getNuevosRegistros();
  }

  // Deportes
  @Get('deportes/historial')
  getApuestasDeportivas() {
    return this.reportesService.getApuestasDeportivas();
  }

  // Casino
  @Get('casino/rentabilidad')
  getRentabilidadCasino() {
    return this.reportesService.getRentabilidadCasino();
  }

  // Soporte
  @Get('soporte/eficiencia')
  getEficienciaSoporte() {
    return this.reportesService.getEficienciaSoporte();
  }
}
