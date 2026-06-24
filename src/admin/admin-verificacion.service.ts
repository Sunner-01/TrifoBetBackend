// src/admin/admin-verificacion.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class AdminVerificacionService {
  private supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  async getVerificaciones(params: { page?: number; limit?: number; estado?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, params.limit || 20);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('documento')
      .select(`*, usuario:usuario_id (id, nombre, apellido1, correo, ci, verificado)`, { count: 'exact' })
      .order('fecha_subida', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.estado && params.estado !== '') {
      query = query.eq('estado', params.estado);
    }

    const { data, count, error } = await query;

    if (error) throw new BadRequestException(error.message);

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async procesarVerificacion(id: number, adminId: number, dto: { accion: 'aprobar' | 'rechazar'; motivo?: string }) {
    const { data: doc, error: docError } = await this.supabase
      .from('documento')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !doc) throw new NotFoundException('Solicitud de verificación no encontrada');
    if (doc.estado !== 'pendiente') throw new BadRequestException(`Esta solicitud ya está ${doc.estado}`);

    const nuevoEstado = dto.accion === 'aprobar' ? 'aprobado' : 'rechazado';

    const { error: updateError } = await this.supabase
      .from('documento')
      .update({
        estado: nuevoEstado,
        notas_rechazo: dto.motivo || null,
        revisado_por: adminId,
        fecha_revision: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) throw new BadRequestException(updateError.message);

    if (nuevoEstado === 'aprobado') {
      await this.supabase
        .from('usuario')
        .update({ verificado: true })
        .eq('id', doc.usuario_id);
    }

    return {
      message: `Solicitud ${nuevoEstado} correctamente`,
      id,
      estado: nuevoEstado,
    };
  }
}
