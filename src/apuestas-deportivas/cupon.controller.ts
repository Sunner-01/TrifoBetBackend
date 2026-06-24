import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApuestasCuponesService } from './services/apuestas-cupones.service';

@Controller('cupon')
export class CuponController {
  constructor(private readonly cuponesService: ApuestasCuponesService) {}

  @Post('compartir')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async compartirCupon(@Body() body: { selecciones: any[] }) {
    if (!body?.selecciones || !Array.isArray(body.selecciones)) {
      throw new BadRequestException('El campo selecciones es obligatorio y debe ser un arreglo');
    }
    if (body.selecciones.length === 0) {
      throw new BadRequestException('El cupón debe tener al menos una selección');
    }
    if (body.selecciones.length > 20) {
      throw new BadRequestException('El cupón no puede tener más de 20 selecciones');
    }
    return this.cuponesService.compartirCupon(body.selecciones);
  }

  @Get(':codigo')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async obtenerCupon(@Param('codigo') codigo: string) {
    if (!codigo || !/^[A-Z0-9]{1,10}$/i.test(codigo)) {
      throw new BadRequestException('Código de cupón inválido');
    }
    return this.cuponesService.obtenerCupon(codigo);
  }
}
