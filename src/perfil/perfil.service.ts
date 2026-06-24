// src/perfil/perfil.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class PerfilService {
  private supabase;
  private readonly logger = new Logger(PerfilService.name);

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );

    // CONFIGURACIÓN COMPLETA DE CLOUDINARY usando variables de entorno
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    // DEBUG: Verificar valores exactos (incluyendo comillas y espacios)
    this.logger.log('=== CONFIGURACIÓN DE CLOUDINARY ===');
    this.logger.log(
      `Cloud Name RAW: "${cloudName}" (length: ${cloudName?.length})`,
    );
    this.logger.log(`API Key RAW: "${apiKey}" (length: ${apiKey?.length})`);
    this.logger.log(
      `API Secret presente: ${apiSecret ? 'SÍ' : 'NO'} (length: ${apiSecret?.length})`,
    );

    // Limpiar posibles comillas si existen
    const cleanCloudName = cloudName?.replace(/^["']|["']$/g, '').trim();
    const cleanApiKey = apiKey?.replace(/^["']|["']$/g, '').trim();
    const cleanApiSecret = apiSecret?.replace(/^["']|["']$/g, '').trim();

    this.logger.log(`Cloud Name LIMPIO: "${cleanCloudName}"`);
    this.logger.log(`API Key LIMPIO: "${cleanApiKey}"`);

    cloudinary.config({
      cloud_name: cleanCloudName,
      api_key: cleanApiKey,
      api_secret: cleanApiSecret,
    });

    this.logger.log('Cloudinary configurado correctamente');
  }

  async getProfile(userId: number) {
    // 1. Obtener datos del usuario
    const { data, error } = await this.supabase
      .from('usuario')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      this.logger.error(
        `Error obteniendo perfil de usuario ${userId}: ${error?.message}`,
      );
      throw new NotFoundException('Usuario no encontrado');
    }

    // 2. Calcular saldo retenido
    const { data: retirosData, error: retirosError } = await this.supabase
      .from('transaccion')
      .select('monto')
      .eq('usuario_id', userId)
      .eq('tipo', 'retiro')
      .eq('estado', 'pendiente');

    let saldoRetenido = 0;
    if (!retirosError && retirosData) {
      saldoRetenido = retirosData.reduce(
        (acc, curr) => acc + Number(curr.monto),
        0,
      );
    }

    return {
      id: data.id,
      nombre: data.nombre || null,
      apellido1: data.apellido1 || null,
      apellido2: data.apellido2 || null,
      nombre_usuario: data.nombre_usuario,
      correo: data.correo,
      telefono: data.telefono || null,
      ci: data.ci || null,
      pais_codigo: data.pais_codigo || 'BO',
      fecha_nacimiento: data.fecha_nacimiento || null,
      saldo: Number(data.saldo),
      saldo_retenido: saldoRetenido,
      foto_perfil_url: data.foto_perfil_url || null,
      verificado: data.verificado,
      created_at: data.created_at,
    };
  }

  async updateProfile(userId: number, dto: any) {
    // Convertir campos de camelCase a snake_case para Supabase
    const updateData: any = {};

    if (dto.nombre !== undefined) updateData.nombre = dto.nombre;
    if (dto.apellido1 !== undefined) updateData.apellido1 = dto.apellido1;
    if (dto.apellido2 !== undefined) updateData.apellido2 = dto.apellido2;
    if (dto.ci !== undefined) updateData.ci = dto.ci;
    if (dto.fechaNacimiento !== undefined)
      updateData.fecha_nacimiento = dto.fechaNacimiento;
    if (dto.correo !== undefined) updateData.correo = dto.correo;
    if (dto.telefono !== undefined) updateData.telefono = dto.telefono;
    if (dto.paisCodigo !== undefined) updateData.pais_codigo = dto.paisCodigo;

    const { error } = await this.supabase
      .from('usuario')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      this.logger.error(
        `Error actualizando perfil de usuario ${userId}: ${error.message}`,
      );
      throw new NotFoundException(error.message);
    }

    return this.getProfile(userId);
  }

  async updateProfilePhoto(userId: number, file: Express.Multer.File) {
    try {
      // Subir nueva imagen a Cloudinary
      const result: any = await new Promise((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
          {
            folder: 'trifobet/avatars',
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (error, result) => (error ? reject(error) : resolve(result)),
        );
        upload.end(file.buffer);
      });

      const nuevaUrl = result.secure_url;

      // Obtener la foto anterior
      const { data: usuario } = await this.supabase
        .from('usuario')
        .select('foto_perfil_url')
        .eq('id', userId)
        .single();

      // Eliminar foto anterior SOLO si NO es la imagen predeterminada
      if (usuario?.foto_perfil_url) {
        const isDefaultPhoto =
          usuario.foto_perfil_url.includes('default-avatar');

        if (!isDefaultPhoto) {
          try {
            const urlParts = usuario.foto_perfil_url.split('/');
            const uploadIndex = urlParts.indexOf('upload');
            if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
              const pathAfterVersion = urlParts
                .slice(uploadIndex + 2)
                .join('/');
              const publicId = pathAfterVersion.replace(/\.[^/.]+$/, '');

              this.logger.log(
                `Eliminando foto personalizada anterior: ${publicId}`,
              );
              await cloudinary.uploader.destroy(publicId);
            }
          } catch (deleteError: any) {
            this.logger.warn(
              `No se pudo eliminar la foto anterior: ${deleteError.message}`,
            );
          }
        } else {
          this.logger.log(
            'La foto anterior es la imagen predeterminada, NO se eliminará',
          );
        }
      }

      // Actualizar la URL en la base de datos
      const { error } = await this.supabase
        .from('usuario')
        .update({ foto_perfil_url: nuevaUrl })
        .eq('id', userId);

      if (error) {
        this.logger.error(
          `Error actualizando URL de foto de usuario ${userId}: ${error.message}`,
        );
        throw new NotFoundException(error.message);
      }

      return { foto_perfil_url: nuevaUrl };
    } catch (error: any) {
      this.logger.error(
        `Error en updateProfilePhoto para usuario ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  async deleteProfilePhoto(userId: number) {
    try {
      // Obtener la foto actual del usuario
      const { data: usuario } = await this.supabase
        .from('usuario')
        .select('foto_perfil_url')
        .eq('id', userId)
        .single();

      if (!usuario?.foto_perfil_url) {
        throw new NotFoundException('El usuario no tiene foto de perfil');
      }

      // Verificar si es la imagen predeterminada
      const isDefaultPhoto = usuario.foto_perfil_url.includes('default-avatar');

      if (isDefaultPhoto) {
        return {
          mensaje: 'Ya tienes la imagen predeterminada',
          foto_perfil_url: usuario.foto_perfil_url,
        };
      }

      // Eliminar la foto personalizada de Cloudinary
      try {
        const urlParts = usuario.foto_perfil_url.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
          const pathAfterVersion = urlParts.slice(uploadIndex + 2).join('/');
          const publicId = pathAfterVersion.replace(/\.[^/.]+$/, '');

          this.logger.log(`Eliminando foto personalizada: ${publicId}`);
          await cloudinary.uploader.destroy(publicId);
        }
      } catch (deleteError: any) {
        this.logger.warn(
          `No se pudo eliminar la foto de Cloudinary: ${deleteError.message}`,
        );
      }

      // Restaurar la imagen predeterminada
      const defaultPhotoUrl = this.configService.get<string>(
        'DEFAULT_PROFILE_PHOTO_URL',
      );

      const { error } = await this.supabase
        .from('usuario')
        .update({ foto_perfil_url: defaultPhotoUrl })
        .eq('id', userId);

      if (error) {
        this.logger.error(
          `Error restaurando imagen predeterminada para usuario ${userId}: ${error.message}`,
        );
        throw new NotFoundException(error.message);
      }

      return {
        mensaje: 'Foto de perfil eliminada correctamente',
        foto_perfil_url: defaultPhotoUrl,
      };
    } catch (error: any) {
      this.logger.error(
        `Error en deleteProfilePhoto para usuario ${userId}: ${error.message}`,
      );
      throw error;
    }
  }
}
