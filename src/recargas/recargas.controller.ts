// src/recargas/recargas.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Headers,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { RecargasService } from './recargas.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CrearSolicitudDto } from './dto/crear-solicitud.dto';
import { YapeNotificacionDto } from './dto/yape-notificacion.dto';

@Controller('recargas')
export class RecargasController {
  constructor(private readonly recargasService: RecargasService) {}

  // ─── ENDPOINTS DE USUARIO ────────────────────────────────────────────────────

  /** POST /recargas/solicitud — Crear solicitud de recarga */
  @Post('solicitud')
  @UseGuards(AuthGuard('jwt'))
  async crearSolicitud(@CurrentUser() user: any, @Body() dto: CrearSolicitudDto) {
    return this.recargasService.crearSolicitud(user.userId, dto);
  }

  /** POST /recargas/comprobante/:id — Subir comprobante de pago */
  @Post('comprobante/:id')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('comprobante'))
  async subirComprobante(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Debes adjuntar una imagen del comprobante.');
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.mimetype))
      throw new BadRequestException('Solo se permiten imágenes (JPEG, PNG, WEBP).');
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('El comprobante no debe superar los 5MB.');

    return this.recargasService.subirComprobante(user.userId, id, file);
  }

  /** GET /recargas/mis-solicitudes — Historial del usuario */
  @Get('mis-solicitudes')
  @UseGuards(AuthGuard('jwt'))
  async misSolicitudes(@CurrentUser() user: any) {
    return this.recargasService.misSolicitudes(user.userId);
  }

  // ─── ENDPOINT PARA APP FLUTTER (sin JWT, usa API key) ───────────────────────

  /** POST /recargas/yape-notificacion — Recibir notificación de Yape desde la app Flutter */
  @Post('yape-notificacion')
  async recibirNotificacionYape(
    @Body() dto: YapeNotificacionDto,
    @Headers('x-api-key') apiKey: string,
  ) {
    return this.recargasService.recibirNotificacionYape(dto, apiKey);
  }

  // ─── ENDPOINTS ADMIN ─────────────────────────────────────────────────────────

  /** GET /recargas/admin — Listar todas las solicitudes */
  @Get('admin')
  @UseGuards(AuthGuard('jwt'))
  async listarSolicitudes(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('estado') estado?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    return this.recargasService.listarSolicitudes({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      estado,
      busqueda,
    });
  }

  /** GET /recargas/admin/estadisticas — Dashboard de métricas */
  @Get('admin/estadisticas')
  @UseGuards(AuthGuard('jwt'))
  async estadisticasAdmin() {
    return this.recargasService.estadisticasAdmin();
  }

  /** GET /recargas/admin/notificaciones — Últimas notificaciones de Yape */
  @Get('admin/notificaciones')
  @UseGuards(AuthGuard('jwt'))
  async ultimasNotificaciones(@Query('limit') limit?: string) {
    return this.recargasService.obtenerUltimasNotificaciones(limit ? parseInt(limit) : 10);
  }

  /** POST /recargas/admin/:id/aprobar — Aprobar manualmente */
  @Post('admin/:id/aprobar')
  @UseGuards(AuthGuard('jwt'))
  async aprobarManual(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body('notas') notas?: string,
  ) {
    return this.recargasService.aprobarManual(id, user.userId, notas);
  }

  /** POST /recargas/admin/:id/rechazar — Rechazar manualmente */
  @Post('admin/:id/rechazar')
  @UseGuards(AuthGuard('jwt'))
  async rechazarManual(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body('notas') notas: string,
  ) {
    if (!notas?.trim()) throw new BadRequestException('Debes indicar el motivo del rechazo.');
    return this.recargasService.rechazarManual(id, user.userId, notas);
  }
}
