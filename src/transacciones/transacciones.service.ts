// src/transacciones/transacciones.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class TransaccionesService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(TransaccionesService.name);

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  //  OBTENER HISTORIAL 
  async obtenerHistorial(userId: number, tipo?: string, estado?: string, limit = 20, offset = 0) {
    this.logger.log(`[TransaccionesService] obtenerHistorial userId=${userId}, tipo=${tipo}, estado=${estado}`);
    let query = this.supabase
      .from('transaccion')
      .select(`*, entidad_financiera:entidad_financiera_id(nombre, tipo, codigo), metodo_pago:metodo_pago_id(nombre, tipo)`)
      .eq('usuario_id', userId)
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (tipo) {
      if (tipo.includes(',')) {
        query = query.in('tipo', tipo.split(','));
      } else {
        query = query.eq('tipo', tipo);
      }
    }
    if (estado) query = query.eq('estado', estado);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`Error al obtener historial: ${error.message}`);
      throw new BadRequestException('Error al obtener historial');
    }

    return {
      transacciones: data?.map((t) => this.formatearTransaccion(t)) || [],
      total: count || data?.length || 0,
      pagina: Math.floor(offset / limit) + 1,
      porPagina: limit,
    };
  }

  //  OBTENER MÉTODOS DE PAGO 
  async obtenerMetodosPago() {
    const { data, error } = await this.supabase
      .from('metodo_pago')
      .select(`*, entidad_financiera:entidad_financiera_id!inner(*)`)
      .eq('habilitado', true)
      .eq('entidad_financiera.habilitado', true);

    if (error) {
      this.logger.error(`Error al obtener métodos de pago: ${error.message}`);
      throw new BadRequestException('Error al obtener métodos de pago');
    }

    return data || [];
  }

  //  HISTORIAL ADMINISTRATIVO 
  async obtenerHistorialAdmin(tipo?: string, estado?: string, searchTerm?: string, limit = 50, offset = 0) {
    let query = this.supabase
      .from('transaccion')
      .select(`
        *,
        usuario:usuario_id(nombre, apellido1, correo, nombre_usuario),
        entidad_financiera:entidad_financiera_id(nombre, tipo, codigo),
        metodo_pago:metodo_pago_id(nombre, tipo),
        cuenta_retiro:cuenta_retiro_id(*)
      `, { count: 'exact' })
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (tipo && tipo !== 'todos') {
      if (tipo.includes(',')) {
        query = query.in('tipo', tipo.split(','));
      } else {
        query = query.eq('tipo', tipo);
      }
    }
    if (estado && estado !== 'todos') query = query.eq('estado', estado);

    if (searchTerm) {
      const isNumber = !isNaN(Number(searchTerm));
      if (isNumber) {
        query = query.eq('id', Number(searchTerm));
      }
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`Error al obtener historial admin: ${error.message}`);
      throw new BadRequestException('Error al obtener historial admin');
    }

    return {
      transacciones: data?.map((t) => this.formatearTransaccion(t)) || [],
      total: count || 0,
      pagina: Math.floor(offset / limit) + 1,
      porPagina: limit,
    };
  }

  // OBTENER ENTIDADES FINANCIERAS 
  async obtenerEntidadesFinancieras(paisCodigo?: string) {
    let query = this.supabase
      .from('entidad_financiera')
      .select('*')
      .eq('habilitado', true)
      .order('nombre');

    if (paisCodigo) {
      query = query.eq('pais_codigo', paisCodigo);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Error al obtener entidades financieras: ${error.message}`);
      throw new BadRequestException('Error al obtener entidades financieras');
    }

    return data || [];
  }

  private formatearTransaccion(transaccion: any) {
    return {
      id: transaccion.id,
      tipo: transaccion.tipo,
      monto: parseFloat(transaccion.monto),
      estado: transaccion.estado,
      numeroOperacion: transaccion.numero_operacion,
      datosPago: transaccion.datos_pago,
      fechaCreacion: transaccion.fecha_creacion,
      fecha_creacion: transaccion.fecha_creacion,
      fechaProcesado: transaccion.fecha_procesado,
      fecha_procesado: transaccion.fecha_procesado,
      entidadFinanciera: transaccion.entidad_financiera,
      metodoPago: transaccion.metodo_pago,
      usuario: transaccion.usuario,
      cuenta_retiro: transaccion.cuenta_retiro,
      descripcion: transaccion.descripcion,
    };
  }
}
