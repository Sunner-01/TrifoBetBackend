import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CrearApuestaDto } from './dto/crear-apuesta.dto';

import { ApuestasCoreService } from './services/apuestas-core.service';
import { ApuestasQueryService } from './services/apuestas-query.service';

@Controller('apuestas-deportivas')
@UseGuards(AuthGuard('jwt'))
export class ApuestasDeportivasController {
  constructor(
    private readonly coreService: ApuestasCoreService,
    private readonly queryService: ApuestasQueryService
  ) {}

  @Post('crear')
  @HttpCode(201)
  async crearApuesta(@Request() req, @Body() crearApuestaDto: CrearApuestaDto) {
    const usuarioId = req.user?.userId || req.user?.sub || req.user?.id;
    return this.coreService.crearApuesta(usuarioId, crearApuestaDto);
  }

  @Get('historial')
  @HttpCode(200)
  async obtenerHistorial(
    @Request() req,
    @Query('estado') estado?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const usuarioId = req.user?.userId || req.user?.sub || req.user?.id;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    return this.queryService.obtenerHistorial(usuarioId, estado, limitNum, offsetNum);
  }

  @Post(':id/cashout')
  @HttpCode(200)
  async cerrarApuesta(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const usuarioId = req.user?.userId || req.user?.sub || req.user?.id;
    return this.coreService.cerrarApuesta(id, usuarioId);
  }

  @Get(':id')
  @HttpCode(200)
  async obtenerApuesta(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const usuarioId = req.user?.userId || req.user?.sub || req.user?.id;
    return this.queryService.obtenerApuestaPorId(id, usuarioId);
  }

  @Get('estadisticas/resumen')
  @HttpCode(200)
  async obtenerEstadisticas(@Request() req) {
    const usuarioId = req.user?.userId || req.user?.sub || req.user?.id;
    return this.queryService.obtenerEstadisticas(usuarioId);
  }
}
