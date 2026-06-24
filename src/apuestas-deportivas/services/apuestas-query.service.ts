import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HistorialApuestasResponse, EstadisticasApuestasResponse, ApuestaResponse } from '../dto/apuesta-response.dto';

@Injectable()
export class ApuestasQueryService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(ApuestasQueryService.name);

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private formatearApuesta(apuesta: any, selecciones: any[]): ApuestaResponse {
    return {
      id: apuesta.id,
      usuarioId: apuesta.usuario_id,
      tipo: apuesta.tipo,
      monto: parseFloat(apuesta.monto),
      cuotaTotal: parseFloat(apuesta.cuota_total),
      gananciaPotencial: parseFloat(apuesta.ganancia_potencial),
      estado: apuesta.estado,
      fechaCreacion: apuesta.fecha_creacion,
      fechaProcesado: apuesta.fecha_procesado,
      selecciones: selecciones.map((sel) => ({
        id: sel.id,
        eventoId: sel.evento_deportivo_id,
        eventoNombre: sel.evento_nombre,
        mercado: sel.mercado,
        seleccion: sel.seleccion,
        seleccionDisplay: sel.seleccion_display,
        cuota: parseFloat(sel.cuota),
        resultado: sel.resultado_bool,
      })),
    };
  }

  async obtenerApuestaPorId(apuestaId: number, usuarioId: number): Promise<ApuestaResponse> {
    const { data: apuesta, error: apuestaError } = await this.supabase
      .from('apuesta')
      .select('*')
      .eq('id', apuestaId)
      .eq('usuario_id', usuarioId)
      .single();

    if (apuestaError || !apuesta) {
      throw new NotFoundException('Apuesta no encontrada');
    }

    const { data: selecciones, error: seleccionesError } = await this.supabase
      .from('item_apuesta')
      .select('*')
      .eq('apuesta_id', apuestaId);

    if (seleccionesError) {
      this.logger.error(`Error al obtener selecciones: ${seleccionesError.message}`);
    }

    return this.formatearApuesta(apuesta, selecciones || []);
  }

  async obtenerHistorial(usuarioId: number, estado?: string, limit = 20, offset = 0): Promise<HistorialApuestasResponse> {
    let query = this.supabase
      .from('apuesta')
      .select('*', { count: 'exact' })
      .eq('usuario_id', usuarioId)
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (estado) {
      query = query.eq('estado', estado);
    }

    const { data: apuestas, error, count } = await query;

    if (error) {
      this.logger.error(`Error al obtener historial: ${error.message}`);
      throw new BadRequestException('Error al obtener historial de apuestas');
    }

    const apuestasConSelecciones = await Promise.all(
      (apuestas || []).map(async (apuesta) => {
        const { data: selecciones } = await this.supabase
          .from('item_apuesta')
          .select('*')
          .eq('apuesta_id', apuesta.id);

        return this.formatearApuesta(apuesta, selecciones || []);
      })
    );

    return {
      apuestas: apuestasConSelecciones,
      total: count || 0,
      pagina: Math.floor(offset / limit) + 1,
      porPagina: limit,
    };
  }

  async obtenerEstadisticas(usuarioId: number): Promise<EstadisticasApuestasResponse> {
    const { data: apuestas, error } = await this.supabase
      .from('apuesta')
      .select('estado, monto, ganancia_potencial')
      .eq('usuario_id', usuarioId);

    if (error) {
      this.logger.error(`Error al obtener estadísticas: ${error.message}`);
      throw new BadRequestException('Error al obtener estadísticas');
    }

    const apuestasArray = apuestas || [];

    const totalApuestas = apuestasArray.length;
    const apuestasGanadas = apuestasArray.filter((a) => a.estado === 'ganada').length;
    const apuestasPerdidas = apuestasArray.filter((a) => a.estado === 'perdida').length;
    const apuestasPendientes = apuestasArray.filter((a) => a.estado === 'pendiente').length;

    const totalApostado = apuestasArray.reduce((sum, a) => sum + parseFloat(a.monto), 0);
    const totalGanado = apuestasArray
      .filter((a) => a.estado === 'ganada')
      .reduce((sum, a) => sum + parseFloat(a.ganancia_potencial), 0);

    const tasaExito = totalApuestas > 0 ? parseFloat(((apuestasGanadas / totalApuestas) * 100).toFixed(2)) : 0;
    const beneficioNeto = parseFloat((totalGanado - totalApostado).toFixed(2));

    return {
      totalApuestas,
      apuestasGanadas,
      apuestasPerdidas,
      apuestasPendientes,
      totalApostado: parseFloat(totalApostado.toFixed(2)),
      totalGanado: parseFloat(totalGanado.toFixed(2)),
      tasaExito,
      beneficioNeto,
    };
  }
}
