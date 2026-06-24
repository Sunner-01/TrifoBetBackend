// src/admin/admin.controller.ts
import {
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { AdminGuard } from './guards/admin.guard';

// Importación de los nuevos servicios especializados (SRP)
import { AdminUsersService } from './admin-users.service';
import { AdminApuestasService } from './admin-apuestas.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminVerificacionService } from './admin-verificacion.service';
import { AdminJuegosCasinoService } from './admin-juegos-casino.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly adminApuestasService: AdminApuestasService,
    private readonly adminDashboardService: AdminDashboardService,
    private readonly adminVerificacionService: AdminVerificacionService,
    private readonly adminJuegosCasinoService: AdminJuegosCasinoService,
  ) {}

  @Get('stats')
  getStats() {
    return this.adminUsersService.getStats();
  }

  @Get('dashboard-stats')
  getDashboardStats(@Query('range') range?: string) {
    return this.adminDashboardService.getDashboardStats(range || '7d');
  }

  @Get('usuarios')
  getUsuarios(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('habilitado') habilitado?: string,
    @Query('rol_id') rol_id?: string,
  ) {
    return this.adminUsersService.getUsuarios({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
      habilitado,
      rol_id,
    });
  }

  @Get('usuarios/:id')
  getUsuario(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsersService.getUsuario(id);
  }

  @Patch('usuarios/:id/habilitar')
  toggleHabilitado(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsersService.toggleHabilitado(id);
  }

  @Patch('usuarios/:id')
  updateUsuario(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adminUsersService.updateUsuario(id, body);
  }

  // KYC / VERIFICACIÓN DE IDENTIDAD

  @Get('verificaciones')
  getVerificaciones(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('estado') estado?: string,
  ) {
    return this.adminVerificacionService.getVerificaciones({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      estado,
    });
  }

  @Patch('verificaciones/:id')
  procesarVerificacion(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() body: { accion: 'aprobar' | 'rechazar'; motivo?: string },
  ) {
    const adminId = req.user.sub || req.user.id;
    return this.adminVerificacionService.procesarVerificacion(id, adminId, body);
  }

  // APUESTAS DEPORTIVAS

  @Get('apuestas')
  getTodasApuestas(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
  ) {
    return this.adminApuestasService.getTodasApuestas({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
      estado,
    });
  }

  @Get('apuestas/stats')
  getEstadisticasApuestas() {
    return this.adminApuestasService.getEstadisticasApuestas();
  }

  // JUEGOS CASINO

  @Get('juegos-casino')
  getAllGamesAdmin() {
    return this.adminJuegosCasinoService.getAllGamesAdmin();
  }

  @Get('juegos-casino/stats')
  getAllGamesAdminStats() {
    return this.adminJuegosCasinoService.getAllGamesAdminStats();
  }

  @Post('juegos-casino')
  createGame(@Body() createDto: any) {
    return this.adminJuegosCasinoService.createGame(createDto);
  }

  @Put('juegos-casino/:id')
  updateGame(@Param('id', ParseIntPipe) id: number, @Body() updateDto: any) {
    return this.adminJuegosCasinoService.updateGame(id, updateDto);
  }

  @Delete('juegos-casino/:id')
  deleteGame(@Param('id', ParseIntPipe) id: number) {
    return this.adminJuegosCasinoService.deleteGame(id);
  }
}
