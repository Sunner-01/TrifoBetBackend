import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class VerificacionService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(VerificacionService.name);

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );

    // Configurar Cloudinary
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME')?.replace(/^["']|["']$/g, '').trim();
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY')?.replace(/^["']|["']$/g, '').trim();
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET')?.replace(/^["']|["']$/g, '').trim();

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    this.logger.log('Cloudinary configurado en VerificacionService');
  }

  // Sube imágenes a Cloudinary
  private async uploadImageToCloudinary(file: Express.Multer.File, userId: number, type: 'anverso' | 'reverso'): Promise<string> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder: `trifobet/kyc/usuario_${userId}`,
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result!.secure_url);
        },
      );
      upload.end(file.buffer);
    });
  }

  async getEstado(userId: number) {
    const { data, error } = await this.supabase
      .from('documento')
      .select('*')
      .eq('usuario_id', userId)
      .order('fecha_subida', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "No rows found"
      throw new BadRequestException(error.message);
    }

    if (!data) {
      return { estado: 'sin_enviar' };
    }

    return data;
  }

  async subirDocumentos(userId: number, anverso: Express.Multer.File, reverso: Express.Multer.File) {
    // Verificar si ya tiene uno pendiente o aprobado
    const estadoActual = await this.getEstado(userId);
    if (estadoActual.estado === 'pendiente') {
      throw new BadRequestException('Ya tienes una solicitud de verificación pendiente de revisión.');
    }
    if (estadoActual.estado === 'aprobado') {
      throw new BadRequestException('Tu cuenta ya está verificada.');
    }

    try {
      this.logger.log(`Subiendo documentos para usuario ${userId}`);
      
      const urlAnverso = await this.uploadImageToCloudinary(anverso, userId, 'anverso');
      const urlReverso = await this.uploadImageToCloudinary(reverso, userId, 'reverso');

      const { data, error } = await this.supabase
        .from('documento')
        .insert({
          usuario_id: userId,
          url_imagen_anverso: urlAnverso,
          url_imagen_reverso: urlReverso,
          estado: 'pendiente'
        })
        .select()
        .single();

      if (error) throw new BadRequestException(error.message);

      return {
        message: 'Documentos subidos correctamente',
        documento: data
      };
    } catch (error: any) {
      this.logger.error(`Error en subirDocumentos: ${error.message}`);
      throw new BadRequestException('Error al subir los documentos. Inténtelo de nuevo.');
    }
  }

  // ─────────────────────────────────────────────────────────
  // MÉTODOS PARA ADMINISTRADORES
  // ─────────────────────────────────────────────────────────
  async getVerificaciones(params: { page?: number; limit?: number; estado?: string }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, params.limit || 20);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('documento')
      .select(`
        *,
        usuario:usuario_id (
          id, nombre, apellido1, correo, ci, verificado
        )
      `, { count: 'exact' })
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
    // 1. Obtener el documento
    const { data: doc, error: docError } = await this.supabase
      .from('documento')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !doc) throw new NotFoundException('Solicitud de verificación no encontrada');
    if (doc.estado !== 'pendiente') throw new BadRequestException(`Esta solicitud ya está ${doc.estado}`);

    const nuevoEstado = dto.accion === 'aprobar' ? 'aprobado' : 'rechazado';

    // 2. Actualizar el documento
    const { error: updateError } = await this.supabase
      .from('documento')
      .update({
        estado: nuevoEstado,
        notas_rechazo: dto.motivo || null,
        revisado_por: adminId,
        fecha_revision: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw new BadRequestException(updateError.message);

    // 3. Si se aprueba, actualizar el usuario a verificado=true
    if (nuevoEstado === 'aprobado') {
      await this.supabase
        .from('usuario')
        .update({ verificado: true })
        .eq('id', doc.usuario_id);
    }

    return {
      message: `Solicitud ${nuevoEstado} correctamente`,
      id,
      estado: nuevoEstado
    };
  }
}
