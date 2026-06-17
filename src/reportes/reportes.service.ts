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

  async getCashflow() {
    const { data: depositos, error: errDep } = await this.supabase
      .from('transaccion')
      .select('monto')
      .eq('tipo', 'deposito')
      .in('estado', ['completado', 'aprobado']);
      
    const { data: retiros, error: errRet } = await this.supabase
      .from('transaccion')
      .select('monto')
      .eq('tipo', 'retiro')
      .in('estado', ['completado', 'aprobado']);

    const totalDepositos = depositos?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;
    const totalRetiros = retiros?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;

    return {
      totalDepositos,
      totalRetiros,
      balance: totalDepositos - totalRetiros
    };
  }

  async getGGR() {
    // Gross Gaming Revenue = Apuestas - Premios (Ganancias)
    const { data: apuestas } = await this.supabase
      .from('transaccion')
      .select('monto')
      .eq('tipo', 'apuesta');

    const { data: ganancias } = await this.supabase
      .from('transaccion')
      .select('monto')
      .eq('tipo', 'ganancia');

    const totalApostado = apuestas?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;
    const totalPagado = ganancias?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;

    return {
      totalApostado,
      totalPagado,
      ggr: totalApostado - totalPagado
    };
  }

  async getDepositosPorMetodo() {
    // This requires joining transaccion with metodo_pago.
    // For simplicity, we can fetch all successful deposits and group in memory if DB lacks strict foreign key mapping
    const { data, error } = await this.supabase
      .from('transaccion')
      .select('monto, metodo_pago:metodo_pago_id(nombre), metodo')
      .eq('tipo', 'deposito')
      .in('estado', ['completado', 'aprobado']);

    if (error) throw error;

    const agrupado: Record<string, number> = {};
    data.forEach(tx => {
      // Usar nombre de metodo_pago relacional o el fallback de la columna legacy 'metodo'
      const metodoObj = tx.metodo_pago as any;
      const nombreMetodo = (metodoObj && !Array.isArray(metodoObj) ? metodoObj.nombre : (Array.isArray(metodoObj) ? metodoObj[0]?.nombre : null)) || tx.metodo || 'Transferencia Bancaria'; 
      if (!agrupado[nombreMetodo]) agrupado[nombreMetodo] = 0;
      agrupado[nombreMetodo] += Number(tx.monto);
    });

    return Object.entries(agrupado).map(([metodo, total]) => ({ metodo, total }));
  }

  async getRetiros() {
    const { data, error } = await this.supabase
      .from('transaccion')
      .select('*, usuario:usuario_id(nombre, apellido1, correo)')
      .eq('tipo', 'retiro')
      .order('fecha_creacion', { ascending: false });
    
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

  async getTopJugadores() {
    // Get all bets
    const { data, error } = await this.supabase
      .from('transaccion')
      .select('monto, usuario:usuario_id(id, nombre, apellido1, correo)')
      .eq('tipo', 'apuesta');

    if (error) throw error;

    const volumenMap: Record<number, { usuario: any, total: number }> = {};
    
    data.forEach(tx => {
      const usuarioObj = tx.usuario as any;
      const usr = Array.isArray(usuarioObj) ? usuarioObj[0] : usuarioObj;
      const uId = usr?.id;
      if (!uId) return;
      if (!volumenMap[uId]) {
        volumenMap[uId] = { usuario: usr, total: 0 };
      }
      volumenMap[uId].total += Number(tx.monto);
    });

    return Object.values(volumenMap).sort((a, b) => b.total - a.total).slice(0, 10);
  }

  async getNuevosRegistros() {
    const { data, error } = await this.supabase
      .from('usuario')
      .select('created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;

    const agrupado: Record<string, number> = {};
    data.forEach(u => {
      const fecha = new Date(u.created_at).toISOString().split('T')[0];
      if (!agrupado[fecha]) agrupado[fecha] = 0;
      agrupado[fecha]++;
    });

    return Object.entries(agrupado).map(([fecha, total]) => ({ fecha, total }));
  }

  // ==============================================
  // 3. APUESTAS DEPORTIVAS
  // ==============================================

  async getApuestasDeportivas() {
    const { data, error } = await this.supabase
      .from('apuesta')
      .select('*, usuario:usuario_id(nombre, apellido1)')
      .order('fecha_apuesta', { ascending: false })
      .limit(500); // Para no colapsar la memoria

    if (error) throw error;
    return data;
  }

  // ==============================================
  // 4. CASINO
  // ==============================================

  async getRentabilidadCasino() {
    // Utilizando game_logs que guarda cada partida de casino
    const { data, error } = await this.supabase
      .from('game_logs')
      .select('juego, apuesta, premio');

    if (error) throw error;

    const rentabilidadMap: Record<string, { apostado: number, pagado: number, ggr: number }> = {};
    
    data.forEach(log => {
      const j = log.juego || 'Juego Desconocido';
      if (!rentabilidadMap[j]) {
        rentabilidadMap[j] = { apostado: 0, pagado: 0, ggr: 0 };
      }
      rentabilidadMap[j].apostado += Number(log.apuesta || 0);
      rentabilidadMap[j].pagado += Number(log.premio || 0);
      rentabilidadMap[j].ggr = rentabilidadMap[j].apostado - rentabilidadMap[j].pagado;
    });

    return Object.entries(rentabilidadMap).map(([juego, stats]) => ({
      juego,
      ...stats
    })).sort((a, b) => b.ggr - a.ggr);
  }

  // ==============================================
  // 5. SOPORTE
  // ==============================================

  async getEficienciaSoporte() {
    const { data, error } = await this.supabase
      .from('ticket_soporte')
      .select('estado, categoria');

    if (error) throw error;

    const resumen = {
      abiertos: 0,
      cerrados: 0,
      porCategoria: {} as Record<string, number>
    };

    data.forEach(ticket => {
      if (ticket.estado === 'abierto') resumen.abiertos++;
      if (ticket.estado === 'cerrado') resumen.cerrados++;

      const cat = ticket.categoria || 'Otro';
      if (!resumen.porCategoria[cat]) resumen.porCategoria[cat] = 0;
      resumen.porCategoria[cat]++;
    });

    return resumen;
  }
}
