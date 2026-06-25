// src/transacciones/transacciones.controller.ts
import { Controller, Post, Get, Body, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TransaccionesService } from './transacciones.service';
import { DepositosService } from './depositos.service';
import { RetirosService } from './retiros.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DepositoDto } from './dto/deposito.dto';
import { RetiroDto } from './dto/retiro.dto';

@Controller('transacciones')
export class TransaccionesController {
  constructor(
    private readonly transaccionesService: TransaccionesService,
    private readonly depositosService: DepositosService,
    private readonly retirosService: RetirosService,
  ) {}

  // ==================== CREAR DEPÓSITO ====================
  @Post('deposito')
  @UseGuards(AuthGuard('jwt'))
  async crearDeposito(@CurrentUser() user: any, @Body() dto: DepositoDto) {
    return this.depositosService.crearDeposito(user.userId, dto);
  }

  // ==================== CREAR RETIRO ====================
  @Post('retiro')
  @UseGuards(AuthGuard('jwt'))
  async crearRetiro(@CurrentUser() user: any, @Body() dto: RetiroDto) {
    return this.retirosService.crearRetiro(user.userId, dto);
  }

  // ==================== OBTENER HISTORIAL ====================
  @Get('historial')
  @UseGuards(AuthGuard('jwt'))
  async obtenerHistorial(
    @CurrentUser() user: any,
    @Query('tipo') tipo?: string,
    @Query('estado') estado?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    console.log('[TransaccionesController] obtenerHistorial - user:', user);
    return this.transaccionesService.obtenerHistorial(
      user.userId,
      tipo,
      estado,
      limit ? parseInt(limit) : 20,
      offset ? parseInt(offset) : 0,
    );
  }

  // ==================== OBTENER HISTORIAL ADMIN ====================
  @Get('admin/historial')
  @UseGuards(AuthGuard('jwt'))
  async obtenerHistorialAdmin(
    @Query('tipo') tipo?: string,
    @Query('estado') estado?: string,
    @Query('searchTerm') searchTerm?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    console.log('[TransaccionesController] obtenerHistorialAdmin - query:', { tipo, estado, searchTerm });
    return this.transaccionesService.obtenerHistorialAdmin(
      tipo,
      estado,
      searchTerm,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }

  // ==================== LISTAR MÉTODOS DE PAGO ====================
  @Get('metodos-pago')
  async obtenerMetodosPago() {
    return this.transaccionesService.obtenerMetodosPago();
  }

  // ==================== LISTAR ENTIDADES FINANCIERAS ====================
  @Get('entidades')
  async obtenerEntidadesFinancieras(@Query('pais') paisCodigo?: string) {
    return this.transaccionesService.obtenerEntidadesFinancieras(paisCodigo);
  }
}
