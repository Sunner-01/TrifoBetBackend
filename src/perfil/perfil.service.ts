// src/perfil/perfil.service.ts
import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
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

    // 3. Estadísticas reales de la cuenta
    // 3.1. Obtener todas las transacciones exitosas (depósitos y retiros)
    const { data: transacciones } = await this.supabase
      .from('transaccion')
      .select('tipo, monto, fecha_creacion, estado')
      .eq('usuario_id', userId)
      .in('estado', ['aprobado', 'completado']);

    let totalDepositos = 0;
    let totalRetiros = 0;

    if (transacciones) {
      transacciones.forEach((t) => {
        if (t.tipo === 'deposito' || t.tipo === 'recarga' || t.tipo === 'abono') {
          totalDepositos += Number(t.monto);
        } else if (t.tipo === 'retiro') {
          totalRetiros += Number(t.monto);
        }
      });
    }

    // 3.2. Obtener todas las apuestas realizadas
    const { data: apuestas } = await this.supabase
      .from('apuesta')
      .select('monto, estado, fecha_creacion')
      .eq('usuario_id', userId);

    const totalApuestas = apuestas?.length || 0;
    let ganadas = 0;
    if (apuestas) {
      apuestas.forEach(a => {
        if (a.estado === 'ganada') ganadas++;
      });
    }
    const winRate = totalApuestas > 0 ? Math.round((ganadas / totalApuestas) * 100) : 0;

    // 3.3. Actividad reciente (Uniendo transacciones y apuestas recientes)
    const allActivity: any[] = [];
    if (transacciones) {
      transacciones.forEach(t => {
        allActivity.push({
          type: 'transaction',
          description: t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1),
          time: t.fecha_creacion,
          amount: `Bs ${Number(t.monto).toFixed(2)}`,
          status: t.estado,
        });
      });
    }
    if (apuestas) {
      apuestas.forEach(a => {
        allActivity.push({
          type: 'bet',
          description: 'Apuesta Deportiva',
          time: a.fecha_creacion,
          amount: `Bs ${Number(a.monto).toFixed(2)}`,
          status: a.estado,
        });
      });
    }

    // Ordenar por tiempo descendente y tomar las 5 más recientes
    allActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    const recentActivity = allActivity.slice(0, 5);

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
      stats: {
        memberSince: data.created_at ? new Date(data.created_at).toLocaleDateString('es-BO') : "N/A",
        totalDeposits: totalDepositos.toFixed(2),
        totalWithdrawals: totalRetiros.toFixed(2),
        totalBets: totalApuestas,
        winRate: winRate,
        favoriteGame: "Apuestas Deportivas",
      },
      actividad_reciente: recentActivity,
    };
  }

  async updateProfile(userId: number, dto: any) {
    // Validar usuario primero para verificar si está verificado
    const currentUser = await this.getProfile(userId);

    // Convertir campos de camelCase a snake_case para Supabase
    const updateData: any = {};

    if (dto.nombre !== undefined) updateData.nombre = dto.nombre;
    if (dto.apellido1 !== undefined) updateData.apellido1 = dto.apellido1;
    if (dto.apellido2 !== undefined) updateData.apellido2 = dto.apellido2;
    if (dto.correo !== undefined) updateData.correo = dto.correo;
    if (dto.telefono !== undefined) updateData.telefono = dto.telefono;
    if (dto.paisCodigo !== undefined) updateData.pais_codigo = dto.paisCodigo;

    // Validación de fecha de nacimiento y CI si está presente
    if (dto.ci !== undefined || dto.fechaNacimiento !== undefined) {
      if (currentUser.verificado) {
        throw new BadRequestException('No puedes modificar tu Documento de Identidad (CI) o Fecha de Nacimiento porque tu cuenta ya ha sido verificada.');
      }
      
      if (dto.ci !== undefined) {
        updateData.ci = dto.ci;
      }
      
      if (dto.fechaNacimiento !== undefined) {
        const dateStr = dto.fechaNacimiento;
        const bornDate = new Date(dateStr);
        const today = new Date();
        const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
        const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());

        if (bornDate > maxDate) {
          throw new BadRequestException('Debes tener al menos 18 años de edad.');
        }
        if (bornDate < minDate) {
          throw new BadRequestException('Por favor ingresa una fecha de nacimiento válida.');
        }
        updateData.fecha_nacimiento = dto.fechaNacimiento;
      }
    }

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
