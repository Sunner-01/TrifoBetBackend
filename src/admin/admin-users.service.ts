// src/admin/admin-users.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { PaginationUtil } from '../common/utils/pagination.util';

@Injectable()
export class AdminUsersService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  async getUsuarios(params: { page?: number; limit?: number; search?: string; habilitado?: string; rol_id?: string; }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, params.limit || 20);
    const offset = PaginationUtil.getOffset(page, limit);

    let query = this.supabase
      .from('usuario')
      .select('id, nombre, apellido1, apellido2, nombre_usuario, correo, telefono, pais_codigo, saldo, habilitado, verificado, foto_perfil_url, created_at, rol_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.search) {
      query = query.or(`nombre_usuario.ilike.%${params.search}%,correo.ilike.%${params.search}%,nombre.ilike.%${params.search}%`);
    }

    if (params.habilitado !== undefined && params.habilitado !== '') {
      query = query.eq('habilitado', params.habilitado === 'true');
    }

    if (params.rol_id !== undefined && params.rol_id !== '') {
      query = query.eq('rol_id', parseInt(params.rol_id));
    }

    const { data, error, count } = await query;
    if (error) throw new BadRequestException(error.message);

    return PaginationUtil.formatResponse(data, count || 0, page, limit);
  }

  async getUsuario(id: number) {
    const { data, error } = await this.supabase
      .from('usuario')
      .select('id, nombre, apellido1, apellido2, ci, nombre_usuario, correo, telefono, pais_codigo, saldo, habilitado, verificado, foto_perfil_url, created_at, ultimo_inicio_sesion, rol_id, fecha_nacimiento')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Usuario no encontrado');
    return data;
  }

  async toggleHabilitado(id: number) {
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

  async updateUsuario(id: number, dto: any) {
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

    if (Object.keys(updateData).length === 0) throw new BadRequestException('No se enviaron datos para actualizar');

    const { error } = await this.supabase.from('usuario').update(updateData).eq('id', id);
    if (error) throw new BadRequestException(error.message);

    return this.getUsuario(id);
  }

  async getStats() {
    const [totalRes, activosRes, suspendidosRes, saldoRes] = await Promise.all([
      this.supabase.from('usuario').select('id', { count: 'exact', head: true }),
      this.supabase.from('usuario').select('id', { count: 'exact', head: true }).eq('habilitado', true),
      this.supabase.from('usuario').select('id', { count: 'exact', head: true }).eq('habilitado', false),
      this.supabase.from('usuario').select('saldo').eq('habilitado', true),
    ]);

    const saldoTotal = (saldoRes.data || []).reduce((acc: number, u: any) => acc + Number(u.saldo || 0), 0);
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
}
