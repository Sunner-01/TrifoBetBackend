import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class ReportesService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(ReportesService.name);

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  // ==============================================
  // 1. FINANCIEROS Y TRANSACCIONES
  // ==============================================

  async getCashflow(startDate?: string, endDate?: string) {
    let depQuery = this.supabase
      .from('transaccion')
      .select('monto')
      .eq('tipo', 'deposito')
      .in('estado', ['completado', 'aprobado']);

    if (startDate) depQuery = depQuery.gte('fecha_creacion', startDate);
    if (endDate) depQuery = depQuery.lte('fecha_creacion', endDate);

    const { data: depositos, error: errDep } = await depQuery;

    let retQuery = this.supabase
      .from('transaccion')
      .select('monto')
      .eq('tipo', 'retiro')
      .in('estado', ['completado', 'aprobado']);

    if (startDate) retQuery = retQuery.gte('fecha_creacion', startDate);
    if (endDate) retQuery = retQuery.lte('fecha_creacion', endDate);

    const { data: retiros, error: errRet } = await retQuery;

    const totalDepositos =
      depositos?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;
    const totalRetiros =
      retiros?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;

    return {
      totalDepositos,
      totalRetiros,
      balance: totalDepositos - totalRetiros,
    };
  }

  async getGGR(startDate?: string, endDate?: string) {
    // Gross Gaming Revenue = Apuestas - Premios (Ganancias)
    let apQuery = this.supabase
      .from('transaccion')
      .select('monto')
      .eq('tipo', 'apuesta');

    if (startDate) apQuery = apQuery.gte('fecha_creacion', startDate);
    if (endDate) apQuery = apQuery.lte('fecha_creacion', endDate);

    const { data: apuestas } = await apQuery;

    let ganQuery = this.supabase
      .from('transaccion')
      .select('monto')
      .eq('tipo', 'ganancia');

    if (startDate) ganQuery = ganQuery.gte('fecha_creacion', startDate);
    if (endDate) ganQuery = ganQuery.lte('fecha_creacion', endDate);

    const { data: ganancias } = await ganQuery;

    const totalApostado =
      apuestas?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;
    const totalPagado =
      ganancias?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;

    return {
      totalApostado,
      totalPagado,
      ggr: totalApostado - totalPagado,
    };
  }

  async getDepositosPorMetodo(startDate?: string, endDate?: string) {
    // This requires joining transaccion with metodo_pago.
    // For simplicity, we can fetch all successful deposits and group in memory if DB lacks strict foreign key mapping
    let query = this.supabase
      .from('transaccion')
      .select('monto, metodo_pago:metodo_pago_id(nombre), metodo')
      .eq('tipo', 'deposito')
      .in('estado', ['completado', 'aprobado']);

    if (startDate) query = query.gte('fecha_creacion', startDate);
    if (endDate) query = query.lte('fecha_creacion', endDate);

    const { data, error } = await query;

    if (error) throw error;

    const agrupado: Record<string, number> = {};
    data.forEach((tx) => {
      // Usar nombre de metodo_pago relacional o el fallback de la columna legacy 'metodo'
      const metodoObj = tx.metodo_pago as any;
      const nombreMetodo =
        (metodoObj && !Array.isArray(metodoObj)
          ? metodoObj.nombre
          : Array.isArray(metodoObj)
            ? metodoObj[0]?.nombre
            : null) ||
        tx.metodo ||
        'Transferencia Bancaria';
      if (!agrupado[nombreMetodo]) agrupado[nombreMetodo] = 0;
      agrupado[nombreMetodo] += Number(tx.monto);
    });

    return Object.entries(agrupado).map(([metodo, total]) => ({
      metodo,
      total,
    }));
  }

  async getRetiros(startDate?: string, endDate?: string) {
    let query = this.supabase
      .from('transaccion')
      .select('*, usuario:usuario_id(nombre, apellido1, correo)')
      .eq('tipo', 'retiro')
      .order('fecha_creacion', { ascending: false });

    if (startDate) query = query.gte('fecha_creacion', startDate);
    if (endDate) query = query.lte('fecha_creacion', endDate);

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  // ==============================================
  // 2. JUGADORES
  // ==============================================

  async getKardexJugador(usuarioId: number) {
    const { data, error } = await this.supabase
      .from('transaccion')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('fecha_creacion', { ascending: false });
    if (error) throw error;
    return data;
  }

  async getTopJugadores(startDate?: string, endDate?: string) {
    // Get all bets
    let query = this.supabase
      .from('transaccion')
      .select('monto, usuario:usuario_id(id, nombre, apellido1, correo)')
      .eq('tipo', 'apuesta');

    if (startDate) query = query.gte('fecha_creacion', startDate);
    if (endDate) query = query.lte('fecha_creacion', endDate);

    const { data, error } = await query;

    if (error) throw error;

    const volumenMap: Record<number, { usuario: any; total: number }> = {};

    data.forEach((tx) => {
      const usuarioObj = tx.usuario as any;
      const usr = Array.isArray(usuarioObj) ? usuarioObj[0] : usuarioObj;
      const uId = usr?.id;
      if (!uId) return;
      if (!volumenMap[uId]) {
        volumenMap[uId] = { usuario: usr, total: 0 };
      }
      volumenMap[uId].total += Number(tx.monto);
    });

    return Object.values(volumenMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }

  async getNuevosRegistros(startDate?: string, endDate?: string) {
    let query = this.supabase
      .from('usuario')
      .select('created_at')
      .order('created_at', { ascending: true });

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query;

    if (error) throw error;

    const agrupado: Record<string, number> = {};
    data.forEach((u) => {
      const fecha = new Date(u.created_at).toISOString().split('T')[0];
      if (!agrupado[fecha]) agrupado[fecha] = 0;
      agrupado[fecha]++;
    });

    return Object.entries(agrupado).map(([fecha, total]) => ({ fecha, total }));
  }

  // ==============================================
  // 3. APUESTAS DEPORTIVAS
  // ==============================================

  async getApuestasDeportivas(startDate?: string, endDate?: string) {
    let query = this.supabase
      .from('apuesta')
      .select('*, usuario:usuario_id(nombre, apellido1)')
      .order('fecha_apuesta', { ascending: false })
      .limit(500); // Para no colapsar la memoria

    if (startDate) query = query.gte('fecha_apuesta', startDate);
    if (endDate) query = query.lte('fecha_apuesta', endDate);

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  // ==============================================
  // 4. CASINO
  // ==============================================

  async getRentabilidadCasino(startDate?: string, endDate?: string) {
    // Utilizando game_logs que guarda cada partida de casino
    let query = this.supabase
      .from('game_logs')
      .select('game_type, bet, profit, created_at');

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query;

    if (error) throw error;

    const rentabilidadMap: Record<
      string,
      { apostado: number; pagado: number; ggr: number }
    > = {};

    data.forEach((log) => {
      const j = log.game_type || 'Juego Desconocido';
      if (!rentabilidadMap[j]) {
        rentabilidadMap[j] = { apostado: 0, pagado: 0, ggr: 0 };
      }
      rentabilidadMap[j].apostado += Number(log.bet || 0);
      rentabilidadMap[j].pagado += Number(log.profit || 0);
      rentabilidadMap[j].ggr =
        rentabilidadMap[j].apostado - rentabilidadMap[j].pagado;
    });

    return Object.entries(rentabilidadMap)
      .map(([juego, stats]) => ({
        juego,
        ...stats,
      }))
      .sort((a, b) => b.ggr - a.ggr);
  }

  // ==============================================
  // 5. SOPORTE
  // ==============================================

  async getEficienciaSoporte(startDate?: string, endDate?: string) {
    let query = this.supabase
      .from('ticket_soporte')
      .select('estado, categoria');

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query;

    if (error) throw error;

    const resumen = {
      abiertos: 0,
      cerrados: 0,
      porCategoria: {} as Record<string, number>,
    };

    data.forEach((ticket) => {
      if (ticket.estado === 'abierto') resumen.abiertos++;
      if (ticket.estado === 'cerrado') resumen.cerrados++;

      const cat = ticket.categoria || 'Otro';
      if (!resumen.porCategoria[cat]) resumen.porCategoria[cat] = 0;
      resumen.porCategoria[cat]++;
    });

    return resumen;
  }
}
