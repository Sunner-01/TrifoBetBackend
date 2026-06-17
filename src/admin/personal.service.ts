import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PersonalService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  async getPersonal(params: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, params.limit || 20);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('usuario')
      .select(`id, nombre, apellido1, apellido2, ci, telefono, fecha_nacimiento, correo, nombre_usuario, habilitado, created_at, rol_id, rol:rol_id(nombre)`, { count: 'exact' })
      .neq('rol_id', 2) // No incluir jugadores
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.search) {
      query = query.or(`nombre_usuario.ilike.%${params.search}%,correo.ilike.%${params.search}%,nombre.ilike.%${params.search}%`);
    }

    const { data, error, count } = await query;

    if (error) throw new BadRequestException(error.message);

    // Formatear y obtener conteo de transacciones
    const personal = await Promise.all((data || []).map(async (p) => {
      // Contar transacciones procesadas
      const { count: txCount } = await this.supabase
        .from('transaccion')
        .select('id', { count: 'exact', head: true })
        .eq('procesado_por', p.id);

      const { count: recargasCount } = await this.supabase
        .from('solicitud_recarga')
        .select('id', { count: 'exact', head: true })
        .eq('aprobado_por', p.id);

      return {
        ...p,
        transacciones_procesadas: (txCount || 0) + (recargasCount || 0)
      };
    }));

    return {
      data: personal,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async createPersonal(dto: any) {
    const { nombre, correo, nombre_usuario, rol_id } = dto;
    const defaultPassword = 'Pass123.';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const { data: existingUser } = await this.supabase
      .from('usuario')
      .select('id')
      .or(`nombre_usuario.eq.${nombre_usuario},correo.eq.${correo}`)
      .single();

    if (existingUser) {
      throw new BadRequestException('El nombre de usuario o correo ya está en uso');
    }

    const { data, error } = await this.supabase
      .from('usuario')
      .insert({
        nombre_usuario,
        correo,
        nombre,
        contrasena_hash: hashedPassword,
        rol_id: parseInt(rol_id),
        habilitado: true,
        verificado: true
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    return data;
  }

  async toggleHabilitado(id: number) {
    const { data: usuario, error: getError } = await this.supabase
      .from('usuario')
      .select('id, habilitado, rol_id')
      .eq('id', id)
      .single();

    if (getError || !usuario) throw new NotFoundException('Usuario no encontrado');
    if (usuario.rol_id === 2) throw new BadRequestException('Solo se puede modificar personal administrativo');

    const nuevoEstado = !usuario.habilitado;

    const { error } = await this.supabase
      .from('usuario')
      .update({ habilitado: nuevoEstado })
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);

    return { id, habilitado: nuevoEstado };
  }

  async resetPassword(id: number) {
    const { data: usuario, error: getError } = await this.supabase
      .from('usuario')
      .select('id, rol_id')
      .eq('id', id)
      .single();

    if (getError || !usuario) throw new NotFoundException('Usuario no encontrado');
    if (usuario.rol_id === 2) throw new BadRequestException('Solo personal administrativo');

    const hashedPassword = await bcrypt.hash('Pass123.', 10);

    const { error } = await this.supabase
      .from('usuario')
      .update({ contrasena_hash: hashedPassword })
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);

    return { success: true, message: 'Contraseña restablecida correctamente a Pass123.' };
  }

  async updatePersonal(id: number, dto: any) {
    const { data: usuario, error: getError } = await this.supabase
      .from('usuario')
      .select('id, rol_id')
      .eq('id', id)
      .single();

    if (getError || !usuario) throw new NotFoundException('Usuario no encontrado');
    if (usuario.rol_id === 2) throw new BadRequestException('No se puede editar jugadores desde aquí');

    const { error } = await this.supabase
      .from('usuario')
      .update({
        nombre: dto.nombre,
        correo: dto.correo,
        nombre_usuario: dto.nombre_usuario,
        rol_id: parseInt(dto.rol_id)
      })
      .eq('id', id);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async getPersonalStats(id: number) {
    // Rendimiento detallado
    const [txAprobadas, txRechazadas, recargasAprobadas, recargasRechazadas] = await Promise.all([
      this.supabase.from('transaccion').select('id', { count: 'exact', head: true }).eq('procesado_por', id).eq('estado', 'aprobado'),
      this.supabase.from('transaccion').select('id', { count: 'exact', head: true }).eq('procesado_por', id).eq('estado', 'rechazado'),
      this.supabase.from('solicitud_recarga').select('id', { count: 'exact', head: true }).eq('aprobado_por', id).eq('estado', 'aprobado'),
      this.supabase.from('solicitud_recarga').select('id', { count: 'exact', head: true }).eq('aprobado_por', id).eq('estado', 'rechazado'),
    ]);

    const totalAprobadas = (txAprobadas.count || 0) + (recargasAprobadas.count || 0);
    const totalRechazadas = (txRechazadas.count || 0) + (recargasRechazadas.count || 0);
    const total = totalAprobadas + totalRechazadas;

    // Métricas por día (últimos 7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: history } = await this.supabase
      .from('transaccion')
      .select('fecha_procesado, estado')
      .eq('procesado_por', id)
      .gte('fecha_procesado', sevenDaysAgo.toISOString());

    const { data: recargasHistory } = await this.supabase
      .from('solicitud_recarga')
      .select('fecha_procesado, estado')
      .eq('aprobado_por', id)
      .gte('fecha_procesado', sevenDaysAgo.toISOString());

    // Agrupar
    const graphData: Record<string, { aprobadas: number; rechazadas: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      graphData[dateStr] = { aprobadas: 0, rechazadas: 0 };
    }

    [...(history || []), ...(recargasHistory || [])].forEach(t => {
      if (!t.fecha_procesado) return;
      const dateStr = t.fecha_procesado.split('T')[0];
      if (graphData[dateStr]) {
        if (t.estado === 'aprobado') graphData[dateStr].aprobadas++;
        if (t.estado === 'rechazado') graphData[dateStr].rechazadas++;
      }
    });

    return {
      id,
      totalAprobadas,
      totalRechazadas,
      total,
      tasaAprobacion: total === 0 ? 0 : Math.round((totalAprobadas / total) * 100),
      historial: Object.keys(graphData).map(date => ({
        fecha: date,
        aprobadas: graphData[date].aprobadas,
        rechazadas: graphData[date].rechazadas,
      }))
    };
  }
}
