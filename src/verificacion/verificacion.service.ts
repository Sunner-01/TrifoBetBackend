// src/verificacion/verificacion.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ImageUploadService } from '../common/providers/image-upload.service';

@Injectable()
export class VerificacionService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(VerificacionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly imageUploadService: ImageUploadService, // DRY: Reutilizamos el servicio global
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
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
      throw new BadRequestException(error.message);
    }

    if (!data) return { estado: 'sin_enviar' };
    return data;
  }

  async subirDocumentos(userId: number, anverso: Express.Multer.File, reverso: Express.Multer.File) {
    const estadoActual = await this.getEstado(userId);
    if (estadoActual.estado === 'pendiente') {
      throw new BadRequestException('Ya tienes una solicitud de verificación pendiente de revisión.');
    }
    if (estadoActual.estado === 'aprobado') {
      throw new BadRequestException('Tu cuenta ya está verificada.');
    }

    try {
      this.logger.log(`Subiendo documentos para usuario ${userId}`);

      const folder = `trifobet/kyc/usuario_${userId}`;
      const urlAnverso = await this.imageUploadService.uploadImage(anverso.buffer, folder);
      const urlReverso = await this.imageUploadService.uploadImage(reverso.buffer, folder);

      const { data, error } = await this.supabase
        .from('documento')
        .insert({
          usuario_id: userId,
          url_imagen_anverso: urlAnverso,
          url_imagen_reverso: urlReverso,
          estado: 'pendiente',
        })
        .select()
        .single();

      if (error) throw new BadRequestException(error.message);

      return {
        message: 'Documentos subidos correctamente',
        documento: data,
      };
    } catch (error: any) {
      this.logger.error(`Error en subirDocumentos: ${error.message}`);
      throw new BadRequestException('Error al subir los documentos. Inténtelo de nuevo.');
    }
  }
}
