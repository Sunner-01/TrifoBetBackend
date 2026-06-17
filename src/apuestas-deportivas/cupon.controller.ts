import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    HttpCode,
    BadRequestException,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ApuestasDeportivasService } from './apuestas-deportivas.service';

@Controller('cupon')
export class CuponController {
    constructor(private readonly apuestasDeportivasService: ApuestasDeportivasService) { }

    /**
     * Generar un código para compartir el cupón actual
     * POST /cupon/compartir
     * Límite: 5 generaciones por minuto por IP (endpoint público, protegido contra abuso)
     */
    @Post('compartir')
    @HttpCode(201)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async compartirCupon(@Body() body: { selecciones: any[] }) {
        // Validación de payload: máximo 20 selecciones, no acepta vacíos
        if (!body?.selecciones || !Array.isArray(body.selecciones)) {
            throw new BadRequestException('El campo selecciones es obligatorio y debe ser un arreglo');
        }
        if (body.selecciones.length === 0) {
            throw new BadRequestException('El cupón debe tener al menos una selección');
        }
        if (body.selecciones.length > 20) {
            throw new BadRequestException('El cupón no puede tener más de 20 selecciones');
        }
        return this.apuestasDeportivasService.compartirCupon(body.selecciones);
    }

    /**
     * Obtener selecciones de un cupón mediante su código
     * GET /cupon/:codigo
     * Límite: 20 cargas por minuto por IP
     */
    @Get(':codigo')
    @HttpCode(200)
    @Throttle({ default: { limit: 20, ttl: 60000 } })
    async obtenerCupon(@Param('codigo') codigo: string) {
        // Sanitizar el código: solo alfanumérico, máximo 10 chars
        if (!codigo || !/^[A-Z0-9]{1,10}$/i.test(codigo)) {
            throw new BadRequestException('Código de cupón inválido');
        }
        return this.apuestasDeportivasService.obtenerCupon(codigo);
    }
}
