// src/admin/admin-apuestas.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { PaginationUtil } from '../common/utils/pagination.util';

@Injectable()
export class AdminApuestasService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  async getTodasApuestas(params: { page?: number; limit?: number; search?: string; estado?: string; }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, params.limit || 20);
    const offset = PaginationUtil.getOffset(page, limit);

    let query = this.supabase
      .from('apuesta')
      .select('*, usuario:usuario_id(nombre_usuario)', { count: 'exact' })
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.estado && params.estado !== 'todos') {
      query = query.eq('estado', params.estado);
    }

    const { data: apuestas, error, count } = await query;
    if (error) throw new BadRequestException(error.message);

    const apuestasCompletas = await Promise.all(
      (apuestas || []).map(async (apuesta) => {
        const { data: items } = await this.supabase
          .from('item_apuesta')
          .select('*')
          .eq('apuesta_id', apuesta.id);

        return {
          ...apuesta,
          items: items || [],
        };
      }),
    );

    return PaginationUtil.formatResponse(apuestasCompletas, count || 0, page, limit);
  }

  async getEstadisticasApuestas() {
    const { data: apuestas, error } = await this.supabase
      .from('apuesta')
      .select('estado, monto, ganancia_potencial, monto_cashout');

    if (error) throw new BadRequestException(error.message);

    const apuestasArray = apuestas || [];
    const eventosActivos = apuestasArray.filter((a) => a.estado === 'pendiente').length;
    const totalVolumen = apuestasArray.reduce((acc, a) => acc + parseFloat(a.monto || '0'), 0);

    const pagadoGanadas = apuestasArray
      .filter((a) => a.estado === 'ganada')
      .reduce((acc, a) => acc + parseFloat(a.ganancia_potencial || '0'), 0);

    const pagadoCashout = apuestasArray
      .filter((a) => a.estado === 'cashout')
      .reduce((acc, a) => acc + parseFloat(a.monto_cashout || '0'), 0);

    const totalIngresos = totalVolumen - pagadoGanadas - pagadoCashout;

    return {
      eventosActivos,
      totalVolumen,
      totalIngresos,
    };
  }
}
