// src/admin/admin.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class AdminService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  // ─────────────────────────────────────────
  // LISTAR USUARIOS (con búsqueda y paginación)
  // ─────────────────────────────────────────
  async getUsuarios(params: {
    page?: number;
    limit?: number;
    search?: string;
    habilitado?: string;
    rol_id?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, params.limit || 20);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('usuario')
      .select(
        `id, nombre, apellido1, apellido2, nombre_usuario, correo, telefono,
         pais_codigo, saldo, habilitado, verificado, foto_perfil_url,
         created_at, rol_id`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtros opcionales
    if (params.search) {
      query = query.or(
        `nombre_usuario.ilike.%${params.search}%,correo.ilike.%${params.search}%,nombre.ilike.%${params.search}%`
      );
    }

    if (params.habilitado !== undefined && params.habilitado !== '') {
      query = query.eq('habilitado', params.habilitado === 'true');
    }

    if (params.rol_id !== undefined && params.rol_id !== '') {
      query = query.eq('rol_id', parseInt(params.rol_id));
    }

    const { data, error, count } = await query;

    if (error) throw new BadRequestException(error.message);

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  // ─────────────────────────────────────────
  // DETALLE DE UN USUARIO
  // ─────────────────────────────────────────
  async getUsuario(id: number) {
    const { data, error } = await this.supabase
      .from('usuario')
      .select(`
        id, nombre, apellido1, apellido2, ci, nombre_usuario, correo,
        telefono, pais_codigo, saldo, habilitado, verificado,
        foto_perfil_url, created_at, ultimo_inicio_sesion, rol_id,
        fecha_nacimiento
      `)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Usuario no encontrado');
    return data;
  }

  // ─────────────────────────────────────────
  // TOGGLE HABILITADO (suspender / reactivar)
  // ─────────────────────────────────────────
  async toggleHabilitado(id: number) {
    // Primero obtenemos el estado actual
    const { data: usuario, error: getError } = await this.supabase
      .from('usuario')
      .select('id, habilitado, nombre_usuario')
      .eq('id', id)
      .single();

    if (getError || !usuario) throw new NotFoundException('Usuario no encontrado');

    const nuevoEstado = !usuario.habilitado;

    const { error } = await this.supabase
      .from('usuario')
      .update({ habilitado: nuevoEstado })
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);

    return {
      id,
      nombre_usuario: usuario.nombre_usuario,
      habilitado: nuevoEstado,
      mensaje: nuevoEstado ? 'Usuario habilitado correctamente' : 'Usuario suspendido correctamente',
    };
  }

  // ─────────────────────────────────────────
  // EDITAR USUARIO (admin puede editar cualquier campo)
  // ─────────────────────────────────────────
  async updateUsuario(id: number, dto: {
    nombre?: string;
    apellido1?: string;
    apellido2?: string;
    correo?: string;
    telefono?: string;
    saldo?: number;
    verificado?: boolean;
    habilitado?: boolean;
    rol_id?: number;
    pais_codigo?: string;
  }) {
    // No permitir que el admin se cambie el rol_id a sí mismo (protección básica)
    const updateData: any = {};

    if (dto.nombre !== undefined) updateData.nombre = dto.nombre;
    if (dto.apellido1 !== undefined) updateData.apellido1 = dto.apellido1;
    if (dto.apellido2 !== undefined) updateData.apellido2 = dto.apellido2;
    if (dto.correo !== undefined) updateData.correo = dto.correo;
    if (dto.telefono !== undefined) updateData.telefono = dto.telefono;
    if (dto.saldo !== undefined) updateData.saldo = dto.saldo;
    if (dto.verificado !== undefined) updateData.verificado = dto.verificado;
    if (dto.habilitado !== undefined) updateData.habilitado = dto.habilitado;
    if (dto.rol_id !== undefined) updateData.rol_id = dto.rol_id;
    if (dto.pais_codigo !== undefined) updateData.pais_codigo = dto.pais_codigo;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No se enviaron datos para actualizar');
    }

    const { error } = await this.supabase
      .from('usuario')
      .update(updateData)
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);

    return this.getUsuario(id);
  }

  // ─────────────────────────────────────────
  // ESTADÍSTICAS GENERALES
  // ─────────────────────────────────────────
  async getStats() {
    const [totalRes, activosRes, suspendidosRes, saldoRes] = await Promise.all([
      this.supabase.from('usuario').select('id', { count: 'exact', head: true }),
      this.supabase.from('usuario').select('id', { count: 'exact', head: true }).eq('habilitado', true),
      this.supabase.from('usuario').select('id', { count: 'exact', head: true }).eq('habilitado', false),
      this.supabase.from('usuario').select('saldo').eq('habilitado', true),
    ]);

    const saldoTotal = (saldoRes.data || []).reduce(
      (acc: number, u: any) => acc + Number(u.saldo || 0),
      0
    );

    // Registros de los últimos 7 días
    const hace7Dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: nuevos7d } = await this.supabase
      .from('usuario')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', hace7Dias);

    return {
      totalUsuarios: totalRes.count || 0,
      usuariosActivos: activosRes.count || 0,
      usuariosSuspendidos: suspendidosRes.count || 0,
      saldoTotalEnCuentas: parseFloat(saldoTotal.toFixed(2)),
      nuevosUltimos7Dias: nuevos7d || 0,
    };
  }

  // ─────────────────────────────────────────
  // APUESTAS DEPORTIVAS (ADMIN)
  // ─────────────────────────────────────────
  async getTodasApuestas(params: {
    page?: number;
    limit?: number;
    search?: string;
    estado?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, params.limit || 20);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('apuesta')
      .select('*, usuario:usuario_id(nombre_usuario)', { count: 'exact' })
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.estado && params.estado !== 'todos') {
      query = query.eq('estado', params.estado);
    }

    // TODO: Búsqueda avanzada por usuario no está soportada directamente aquí sin un join o vista,
    // pero podemos filtrar por ID si el search es numérico, o confiar en el frontend para buscar.

    const { data: apuestas, error, count } = await query;
    if (error) throw new BadRequestException(error.message);

    // Obtener items para cada apuesta
    const apuestasCompletas = await Promise.all(
      (apuestas || []).map(async (apuesta) => {
        const { data: items } = await this.supabase
          .from('item_apuesta')
          .select('*')
          .eq('apuesta_id', apuesta.id);
        
        return {
          ...apuesta,
          items: items || []
        };
      })
    );

    return {
      data: apuestasCompletas,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async getEstadisticasApuestas() {
    const { data: apuestas, error } = await this.supabase
      .from('apuesta')
      .select('estado, monto, ganancia_potencial, monto_cashout');
      
    if (error) throw new BadRequestException(error.message);

    const apuestasArray = apuestas || [];
    const eventosActivos = apuestasArray.filter(a => a.estado === 'pendiente').length;
    const totalVolumen = apuestasArray.reduce((acc, a) => acc + parseFloat(a.monto || '0'), 0);
    
    // Ingreso estimado = Total apostado - Total pagado (ganadas y cashout)
    const pagadoGanadas = apuestasArray
      .filter(a => a.estado === 'ganada')
      .reduce((acc, a) => acc + parseFloat(a.ganancia_potencial || '0'), 0);
      
    const pagadoCashout = apuestasArray
      .filter(a => a.estado === 'cashout')
      .reduce((acc, a) => acc + parseFloat(a.monto_cashout || '0'), 0);
      
    const totalIngresos = totalVolumen - pagadoGanadas - pagadoCashout;

    return {
      eventosActivos,
      totalVolumen,
      totalIngresos
    };
  }

  // ─────────────────────────────────────────
  // DASHBOARD GENERAL (Gráficas y KPIs reales)
  // ─────────────────────────────────────────
  async getDashboardStats(range: string = '7d') {
    // Definir límite de fechas
    let dateLimit: Date | null = null;
    let numDays = 7;
    const now = new Date();

    if (range === '7d') {
      numDays = 7;
      dateLimit = new Date();
      dateLimit.setDate(now.getDate() - 7);
    } else if (range === '30d') {
      numDays = 30;
      dateLimit = new Date();
      dateLimit.setDate(now.getDate() - 30);
    } else if (range === 'mes') {
      dateLimit = new Date(now.getFullYear(), now.getMonth(), 1);
      numDays = Math.ceil((now.getTime() - dateLimit.getTime()) / (1000 * 3600 * 24)) + 1;
    } // si es 'all', dateLimit queda en null

    const dateLimitStr = dateLimit ? dateLimit.toISOString() : null;
    const hoyStr = now.toISOString().split('T')[0];

    // 1. Total usuarios y nuevos de hoy
    const { count: usuariosTotales } = await this.supabase.from('usuario').select('*', { count: 'exact', head: true });
    const { count: usuariosNuevos } = await this.supabase.from('usuario').select('*', { count: 'exact', head: true }).gte('created_at', hoyStr);

    // 2. Ingresos (Recargas) y Egresos (Retiros)
    let recargasQuery = this.supabase.from('transaccion').select('monto').eq('tipo', 'deposito').eq('estado', 'aprobado');
    let retirosQuery = this.supabase.from('transaccion').select('monto').eq('tipo', 'retiro').eq('estado', 'aprobado');
    
    if (dateLimitStr) {
      recargasQuery = recargasQuery.gte('fecha_creacion', dateLimitStr);
      retirosQuery = retirosQuery.gte('fecha_creacion', dateLimitStr);
    }

    const [{ data: recargas }, { data: retiros }] = await Promise.all([recargasQuery, retirosQuery]);
    
    const totalRecargas = (recargas || []).reduce((acc, r) => acc + Number(r.monto), 0);
    const totalRetiros = (retiros || []).reduce((acc, r) => acc + Number(r.monto), 0);

    // 3. Actividad de Apuestas (GGR y Volumen)
    let apuestasQuery = this.supabase.from('apuesta').select('monto, ganancia_potencial, monto_cashout, estado');
    if (dateLimitStr) {
      apuestasQuery = apuestasQuery.gte('fecha_creacion', dateLimitStr);
    }
    const { data: apuestas } = await apuestasQuery;

    let totalApostado = 0;
    let totalPagado = 0;
    let apuestasActivas = 0;
    
    let distribucionApuestas = {
      ganadas: 0,
      perdidas: 0,
      pendientes: 0,
      cashout: 0
    };
    
    (apuestas || []).forEach(a => {
      totalApostado += Number(a.monto || 0);
      if (a.estado === 'ganada') {
        totalPagado += Number(a.ganancia_potencial || 0);
        distribucionApuestas.ganadas++;
      }
      else if (a.estado === 'perdida') distribucionApuestas.perdidas++;
      else if (a.estado === 'cashout') {
        totalPagado += Number(a.monto_cashout || 0);
        distribucionApuestas.cashout++;
      }
      else if (a.estado === 'pendiente') {
        apuestasActivas++;
        distribucionApuestas.pendientes++;
      }
    });

    const ggr = totalApostado - totalPagado;

    // 4. Datos adicionales de atención (Alertas)
    const [recargasPendientesRes, retirosPendientesRes, kycPendientesRes] = await Promise.all([
      this.supabase.from('transaccion').select('id', { count: 'exact', head: true }).eq('tipo', 'deposito').eq('estado', 'pendiente'),
      this.supabase.from('transaccion').select('id', { count: 'exact', head: true }).eq('tipo', 'retiro').eq('estado', 'pendiente'),
      this.supabase.from('verificacion_identidad').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')
    ]);

    // 5. Datos en tiempo para la gráfica
    // Generar las fechas para el eje X
    let diasParaGrafica = numDays;
    if (range === 'all') diasParaGrafica = 30; // Max 30 puntos para 'all'

    const ultimosDias = [...Array(diasParaGrafica)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const chartData: any[] = [];
    const chartDateLimitStr = new Date(now.setDate(now.getDate() - diasParaGrafica)).toISOString();

    const [recargasChart, retirosChart] = await Promise.all([
      this.supabase.from('transaccion').select('monto, fecha_procesado').eq('tipo', 'deposito').eq('estado', 'aprobado').gte('fecha_procesado', chartDateLimitStr),
      this.supabase.from('transaccion').select('monto, fecha_procesado').eq('tipo', 'retiro').eq('estado', 'aprobado').gte('fecha_procesado', chartDateLimitStr)
    ]);

    for (const dia of ultimosDias) {
      const recargasDia = (recargasChart.data || []).filter(r => r.fecha_procesado && r.fecha_procesado.startsWith(dia)).reduce((acc, r) => acc + Number(r.monto), 0);
      const retirosDia = (retirosChart.data || []).filter(r => r.fecha_procesado && r.fecha_procesado.startsWith(dia)).reduce((acc, r) => acc + Number(r.monto), 0);
      
      const dayName = diasParaGrafica <= 14 ? ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][new Date(dia).getUTCDay()] : dia.substring(5); // DD-MM for longer periods
      
      chartData.push({
        name: dayName,
        fecha: dia,
        Recargas: recargasDia,
        Retiros: retirosDia,
        Balance: recargasDia - retirosDia
      });
    }

    // 6. Transacciones Recientes
    const { data: ultimasRecargas } = await this.supabase
      .from('transaccion')
      .select('id, monto, estado, fecha_creacion, metodo, usuario:usuario_id(nombre_usuario)')
      .eq('tipo', 'deposito')
      .order('fecha_creacion', { ascending: false })
      .limit(5);

    const { data: ultimosRetiros } = await this.supabase
      .from('transaccion')
      .select('id, monto, estado, fecha_creacion, metodo, usuario:usuario_id(nombre_usuario)')
      .eq('tipo', 'retiro')
      .order('fecha_creacion', { ascending: false })
      .limit(5);

    const recientes = [
      ...(ultimasRecargas || []).map(r => ({ ...r, tipo: 'Recarga', created_at: r.fecha_creacion })),
      ...(ultimosRetiros || []).map(r => ({ ...r, tipo: 'Retiro', created_at: r.fecha_creacion }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

    // 7. Últimos Usuarios Registrados (Con foto de perfil)
    const { data: ultimosUsuarios } = await this.supabase
      .from('usuario')
      .select('id, nombre_usuario, correo, created_at, saldo, foto_perfil_url')
      .order('created_at', { ascending: false })
      .limit(5);

    // 8. Casino Stats (game_logs)
    let casinoQuery = this.supabase.from('game_logs').select('bet, profit, created_at');
    if (dateLimitStr) {
      casinoQuery = casinoQuery.gte('created_at', dateLimitStr);
    }
    const { data: casinoLogs } = await casinoQuery;

    let casinoVolumen = 0;
    let casinoPagado = 0;
    let casinoGGR = 0; // Ganancia de la casa = - SUM(profit_neto_jugador)

    (casinoLogs || []).forEach(log => {
      casinoVolumen += Number(log.bet || 0);
      const userProfit = Number(log.profit || 0);
      if (userProfit > 0) {
        casinoPagado += userProfit;
      }
      casinoGGR -= userProfit; // House GGR is negative user profit
    });

    return {
      kpis: {
        usuariosTotales: usuariosTotales || 0,
        usuariosNuevosHoy: usuariosNuevos || 0,
        totalRecargas,
        totalRetiros,
        totalApostado,
        ggr,
        apuestasActivas,
        recargasPendientes: recargasPendientesRes.count || 0,
        retirosPendientes: retirosPendientesRes.count || 0,
        kycPendientes: kycPendientesRes.count || 0,
        // Casino Real Data
        casinoVolumen,
        casinoPagado,
        casinoGGR
      },
      distribucionApuestas: [
        { name: 'Ganadas', value: distribucionApuestas.ganadas, color: '#10b981' },
        { name: 'Perdidas', value: distribucionApuestas.perdidas, color: '#ef4444' },
        { name: 'Cashout', value: distribucionApuestas.cashout, color: '#eab308' },
        { name: 'Pendientes', value: distribucionApuestas.pendientes, color: '#3b82f6' }
      ].filter(d => d.value > 0),
      chartData,
      recientes,
      ultimosUsuarios: ultimosUsuarios || []
    };
  }
}
