// src/admin/admin.controller.ts
import {
  Controller, Get, Patch, Param, Body, Query,
  UseGuards, ParseIntPipe, Request
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import { VerificacionService } from '../verificacion/verificacion.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly verificacionService: VerificacionService
  ) {}

  /**
   * GET /admin/stats
   * Estadísticas generales del sistema
   */
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  /**
   * GET /admin/dashboard-stats
   * Estadísticas avanzadas y de gráficas para el dashboard principal
   * Query params: range (7d, 30d, mes, all)
   */
  @Get('dashboard-stats')
  getDashboardStats(@Query('range') range?: string) {
    return this.adminService.getDashboardStats(range || '7d');
  }

  /**
   * GET /admin/usuarios
   * Listar usuarios con paginación y búsqueda
   * Query params: page, limit, search, habilitado, rol_id
   */
  @Get('usuarios')
  getUsuarios(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('habilitado') habilitado?: string,
    @Query('rol_id') rol_id?: string,
  ) {
    return this.adminService.getUsuarios({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
      habilitado,
      rol_id,
    });
  }

  /**
   * GET /admin/usuarios/:id
   * Ver detalle completo de un usuario
   */
  @Get('usuarios/:id')
  getUsuario(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUsuario(id);
  }

  /**
   * PATCH /admin/usuarios/:id/habilitar
   * Suspender o reactivar un usuario (toggle)
   */
  @Patch('usuarios/:id/habilitar')
  toggleHabilitado(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.toggleHabilitado(id);
  }

  /**
   * PATCH /admin/usuarios/:id
   * Editar datos de un usuario
   */
  @Patch('usuarios/:id')
  updateUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.adminService.updateUsuario(id, body);
  }

  // ────────────────────────────────────────────────────────
  // KYC / VERIFICACIÓN DE IDENTIDAD
  // ────────────────────────────────────────────────────────

  @Get('verificaciones')
  getVerificaciones(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('estado') estado?: string,
  ) {
    return this.verificacionService.getVerificaciones({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      estado,
    });
  }

  @Patch('verificaciones/:id')
  procesarVerificacion(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() body: { accion: 'aprobar' | 'rechazar'; motivo?: string }
  ) {
    const adminId = req.user.sub || req.user.id;
    return this.verificacionService.procesarVerificacion(id, adminId, body);
  }

  // ────────────────────────────────────────────────────────
  // APUESTAS DEPORTIVAS
  // ────────────────────────────────────────────────────────

  @Get('apuestas')
  getTodasApuestas(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
  ) {
    return this.adminService.getTodasApuestas({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
      estado,
    });
  }

  @Get('apuestas/stats')
  getEstadisticasApuestas() {
    return this.adminService.getEstadisticasApuestas();
  }
}
