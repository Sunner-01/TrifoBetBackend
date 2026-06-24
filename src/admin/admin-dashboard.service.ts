// src/admin/admin-dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class AdminDashboardService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  async getDashboardStats(range: string = '7d') {
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
    }

    const dateLimitStr = dateLimit ? dateLimit.toISOString() : null;
    const hoyStr = now.toISOString().split('T')[0];

    const { count: usuariosTotales } = await this.supabase.from('usuario').select('*', { count: 'exact', head: true });
    const { count: usuariosNuevos } = await this.supabase.from('usuario').select('*', { count: 'exact', head: true }).gte('created_at', hoyStr);

    let recargasQuery = this.supabase.from('transaccion').select('monto').eq('tipo', 'deposito').eq('estado', 'aprobado');
    let retirosQuery = this.supabase.from('transaccion').select('monto').eq('tipo', 'retiro').eq('estado', 'aprobado');

    if (dateLimitStr) {
      recargasQuery = recargasQuery.gte('fecha_creacion', dateLimitStr);
      retirosQuery = retirosQuery.gte('fecha_creacion', dateLimitStr);
    }

    const [{ data: recargas }, { data: retiros }] = await Promise.all([recargasQuery, retirosQuery]);
    const totalRecargas = (recargas || []).reduce((acc, r) => acc + Number(r.monto), 0);
    const totalRetiros = (retiros || []).reduce((acc, r) => acc + Number(r.monto), 0);

    let apuestasQuery = this.supabase.from('apuesta').select('monto, ganancia_potencial, monto_cashout, estado');
    if (dateLimitStr) {
      apuestasQuery = apuestasQuery.gte('fecha_creacion', dateLimitStr);
    }
    const { data: apuestas } = await apuestasQuery;

    let totalApostado = 0;
    let totalPagado = 0;
    let apuestasActivas = 0;
    const distribucionApuestas = { ganadas: 0, perdidas: 0, pendientes: 0, cashout: 0 };

    (apuestas || []).forEach((a) => {
      totalApostado += Number(a.monto || 0);
      if (a.estado === 'ganada') {
        totalPagado += Number(a.ganancia_potencial || 0);
        distribucionApuestas.ganadas++;
      } else if (a.estado === 'perdida') distribucionApuestas.perdidas++;
      else if (a.estado === 'cashout') {
        totalPagado += Number(a.monto_cashout || 0);
        distribucionApuestas.cashout++;
      } else if (a.estado === 'pendiente') {
        apuestasActivas++;
        distribucionApuestas.pendientes++;
      }
    });

    const ggr = totalApostado - totalPagado;

    const [recargasPendientesRes, retirosPendientesRes, kycPendientesRes] = await Promise.all([
      this.supabase.from('transaccion').select('id', { count: 'exact', head: true }).eq('tipo', 'deposito').eq('estado', 'pendiente'),
      this.supabase.from('transaccion').select('id', { count: 'exact', head: true }).eq('tipo', 'retiro').eq('estado', 'pendiente'),
      this.supabase.from('verificacion_identidad').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    ]);

    let diasParaGrafica = numDays;
    if (range === 'all') diasParaGrafica = 30;

    const ultimosDias = [...Array(diasParaGrafica)]
      .map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      })
      .reverse();

    const chartData: any[] = [];
    const chartDateLimitStr = new Date(now.setDate(now.getDate() - diasParaGrafica)).toISOString();

    const [recargasChart, retirosChart] = await Promise.all([
      this.supabase.from('transaccion').select('monto, fecha_procesado').eq('tipo', 'deposito').eq('estado', 'aprobado').gte('fecha_procesado', chartDateLimitStr),
      this.supabase.from('transaccion').select('monto, fecha_procesado').eq('tipo', 'retiro').eq('estado', 'aprobado').gte('fecha_procesado', chartDateLimitStr),
    ]);

    for (const dia of ultimosDias) {
      const recargasDia = (recargasChart.data || []).filter((r) => r.fecha_procesado && r.fecha_procesado.startsWith(dia)).reduce((acc, r) => acc + Number(r.monto), 0);
      const retirosDia = (retirosChart.data || []).filter((r) => r.fecha_procesado && r.fecha_procesado.startsWith(dia)).reduce((acc, r) => acc + Number(r.monto), 0);

      const dayName = diasParaGrafica <= 14 ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(dia).getUTCDay()] : dia.substring(5);
      chartData.push({ name: dayName, fecha: dia, Recargas: recargasDia, Retiros: retirosDia, Balance: recargasDia - retirosDia });
    }

    const { data: ultimasRecargas } = await this.supabase.from('transaccion').select('id, monto, estado, fecha_creacion, metodo, usuario:usuario_id(nombre_usuario)').eq('tipo', 'deposito').order('fecha_creacion', { ascending: false }).limit(5);
    const { data: ultimosRetiros } = await this.supabase.from('transaccion').select('id, monto, estado, fecha_creacion, metodo, usuario:usuario_id(nombre_usuario)').eq('tipo', 'retiro').order('fecha_creacion', { ascending: false }).limit(5);

    const recientes = [
      ...(ultimasRecargas || []).map((r) => ({ ...r, tipo: 'Recarga', created_at: r.fecha_creacion })),
      ...(ultimosRetiros || []).map((r) => ({ ...r, tipo: 'Retiro', created_at: r.fecha_creacion })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

    const { data: ultimosUsuarios } = await this.supabase.from('usuario').select('id, nombre_usuario, correo, created_at, saldo, foto_perfil_url').order('created_at', { ascending: false }).limit(5);

    let casinoQuery = this.supabase.from('game_logs').select('bet, profit, created_at');
    if (dateLimitStr) {
      casinoQuery = casinoQuery.gte('created_at', dateLimitStr);
    }
    const { data: casinoLogs } = await casinoQuery;

    let casinoVolumen = 0;
    let casinoPagado = 0;
    let casinoGGR = 0;

    (casinoLogs || []).forEach((log) => {
      casinoVolumen += Number(log.bet || 0);
      const userProfit = Number(log.profit || 0);
      if (userProfit > 0) casinoPagado += userProfit;
      casinoGGR -= userProfit;
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
        casinoVolumen,
        casinoPagado,
        casinoGGR,
      },
      distribucionApuestas: [
        { name: 'Ganadas', value: distribucionApuestas.ganadas, color: '#10b981' },
        { name: 'Perdidas', value: distribucionApuestas.perdidas, color: '#ef4444' },
        { name: 'Cashout', value: distribucionApuestas.cashout, color: '#eab308' },
        { name: 'Pendientes', value: distribucionApuestas.pendientes, color: '#3b82f6' },
      ].filter((d) => d.value > 0),
      chartData,
      recientes,
      ultimosUsuarios: ultimosUsuarios || [],
    };
  }
}
