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
import { ApuestasDeportivasService } from './apuestas-deportivas.service';
import { CrearApuestaDto } from './dto/crear-apuesta.dto';

@Controller('apuestas-deportivas')
@UseGuards(AuthGuard('jwt'))
export class ApuestasDeportivasController {
    constructor(private readonly apuestasDeportivasService: ApuestasDeportivasService) { }

    /**
     * Crear una nueva apuesta deportiva
     * POST /apuestas-deportivas/crear
     */
    @Post('crear')
    @HttpCode(201)
    async crearApuesta(@Request() req, @Body() crearApuestaDto: CrearApuestaDto) {
        const usuarioId = req.user.userId;
        return this.apuestasDeportivasService.crearApuesta(usuarioId, crearApuestaDto);
    }

    /**
     * Obtener historial de apuestas del usuario
     * GET /apuestas-deportivas/historial?estado=pendiente&limit=20&offset=0
     */
    @Get('historial')
    @HttpCode(200)
    async obtenerHistorial(
        @Request() req,
        @Query('estado') estado?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        const usuarioId = req.user.userId;
        const limitNum = limit ? parseInt(limit, 10) : 20;
        const offsetNum = offset ? parseInt(offset, 10) : 0;

        return this.apuestasDeportivasService.obtenerHistorial(usuarioId, estado, limitNum, offsetNum);
    }

    /**
     * Cerrar una apuesta anticipadamente (Cashout)
     * POST /apuestas-deportivas/:id/cashout
     */
    @Post(':id/cashout')
    @HttpCode(200)
    async cerrarApuesta(@Request() req, @Param('id', ParseIntPipe) id: number) {
        const usuarioId = req.user.userId;
        return this.apuestasDeportivasService.cerrarApuesta(id, usuarioId);
    }

    /**
     * Obtener detalle de una apuesta específica
     * GET /apuestas-deportivas/:id
     */
    @Get(':id')
    @HttpCode(200)
    async obtenerApuesta(@Request() req, @Param('id', ParseIntPipe) id: number) {
        const usuarioId = req.user.userId;
        return this.apuestasDeportivasService.obtenerApuestaPorId(id, usuarioId);
    }

    /**
     * Obtener estadísticas de apuestas del usuario
     * GET /apuestas-deportivas/estadisticas
     */
    @Get('estadisticas/resumen')
    @HttpCode(200)
    async obtenerEstadisticas(@Request() req) {
        const usuarioId = req.user.userId;
        return this.apuestasDeportivasService.obtenerEstadisticas(usuarioId);
    }
}
