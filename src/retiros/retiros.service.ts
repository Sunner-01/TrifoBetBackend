import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class RetirosService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(RetirosService.name);

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || this.configService.get<string>('SUPABASE_ANON_KEY')!
    );

    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    cloudinary.config({
      cloud_name: cloudName?.replace(/^["']|["']$/g, '').trim(),
      api_key: apiKey?.replace(/^["']|["']$/g, '').trim(),
      api_secret: apiSecret?.replace(/^["']|["']$/g, '').trim(),
    });
  }

  // --- MÉTODOS DE USUARIO ---

  async addAccount(userId: number, dto: any, file?: Express.Multer.File) {
    // Validar nombre con el usuario registrado
    const { data: user } = await this.supabase.from('usuario').select('nombre, apellido1, apellido2').eq('id', userId).single();
    
    let qrUrl = null;
    if (file) {
      try {
        const result: any = await new Promise((resolve, reject) => {
          const upload = cloudinary.uploader.upload_stream(
            { folder: 'trifobet/retiros/qr' },
            (error, result) => (error ? reject(error) : resolve(result)),
          );
          upload.end(file.buffer);
        });
        qrUrl = result.secure_url;
      } catch (error) {
        throw new BadRequestException('Error al subir la imagen QR');
      }
    }

    const { data, error } = await this.supabase.from('cuenta_retiro').insert({
      usuario_id: userId,
      billetera: dto.billetera,
      numero_cuenta: dto.numero_cuenta,
      nombre_titular: dto.nombre_titular,
      qr_url: qrUrl,
      estado: 'pendiente'
    }).select().single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getMyAccounts(userId: number) {
    const { data, error } = await this.supabase
      .from('cuenta_retiro')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async requestWithdrawal(userId: number, dto: { cuenta_retiro_id: number; monto: number }) {
    if (dto.monto <= 0) throw new BadRequestException('Monto inválido');

    // Verificar cuenta aprobada
    const { data: cuenta, error: errCuenta } = await this.supabase
      .from('cuenta_retiro')
      .select('*')
      .eq('id', dto.cuenta_retiro_id)
      .eq('usuario_id', userId)
      .single();

    if (errCuenta || !cuenta || cuenta.estado !== 'aprobada') {
      throw new BadRequestException('La cuenta de retiro no está aprobada o no existe.');
    }

    // Verificar saldo
    const { data: user } = await this.supabase.from('usuario').select('saldo').eq('id', userId).single();
    if (!user || Number(user.saldo) < dto.monto) {
      throw new BadRequestException('Saldo insuficiente para realizar el retiro.');
    }

    // Descontar saldo y crear transacción
    // Nota: Debería usar RPC para atomicidad, pero usamos este flujo por simplicidad.
    const nuevoSaldo = Number(user.saldo) - dto.monto;
    await this.supabase.from('usuario').update({ saldo: nuevoSaldo }).eq('id', userId);

    const { data: transaccion, error } = await this.supabase.from('transaccion').insert({
      usuario_id: userId,
      tipo: 'retiro',
      monto: dto.monto,
      estado: 'pendiente',
      cuenta_retiro_id: cuenta.id,
      descripcion: `Solicitud de retiro a ${cuenta.billetera} (${cuenta.numero_cuenta})`
    }).select().single();

    if (error) throw new BadRequestException(error.message);
    return transaccion;
  }

  // --- MÉTODOS DE ADMINISTRADOR ---

  async getAllAccounts(estado?: string, billetera?: string, limit: number = 20, offset: number = 0) {
    let query = this.supabase
      .from('cuenta_retiro')
      .select('*, usuario:usuario_id (nombre, apellido1, correo)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (estado && estado !== 'todos') {
      query = query.eq('estado', estado);
    }
    if (billetera && billetera !== 'todas') {
      query = query.eq('billetera', billetera);
    }

    const { data, count, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return { data, total: count || 0, limit, offset };
  }

  async processAccount(id: number, estado: 'aprobada' | 'rechazada') {
    const { data, error } = await this.supabase
      .from('cuenta_retiro')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select().single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getPendingWithdrawals(limit: number = 20, offset: number = 0) {
    const { data, count, error } = await this.supabase
      .from('transaccion')
      .select('*, usuario:usuario_id (nombre, apellido1, correo), cuenta_retiro:cuenta_retiro_id (*)', { count: 'exact' })
      .eq('tipo', 'retiro')
      .eq('estado', 'pendiente')
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new BadRequestException(error.message);
    return { data, total: count || 0, limit, offset };
  }

  async processWithdrawal(id: number, adminId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Debe proporcionar un comprobante (imagen)');

    let comprobanteUrl = null;
    try {
      const result: any = await new Promise((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
          { folder: 'trifobet/retiros/comprobantes' },
          (error, result) => (error ? reject(error) : resolve(result)),
        );
        upload.end(file.buffer);
      });
      comprobanteUrl = result.secure_url;
    } catch (error) {
      throw new BadRequestException('Error al subir el comprobante');
    }

    const { data, error } = await this.supabase
      .from('transaccion')
      .update({
        estado: 'completado',
        comprobante_url: comprobanteUrl,
        fecha_procesado: new Date().toISOString(),
        procesado_por: adminId
      })
      .eq('id', id)
      .select().single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async cancelWithdrawal(id: number, userId: number) {
    // Verificar que la transaccion sea del usuario y este pendiente
    const { data: transaccion, error: transError } = await this.supabase
      .from('transaccion')
      .select('monto, estado')
      .eq('id', id)
      .eq('usuario_id', userId)
      .single();
      
    if (transError || !transaccion) throw new BadRequestException('Transacción no encontrada');
    if (transaccion.estado !== 'pendiente') throw new BadRequestException('Solo se pueden cancelar retiros pendientes');

    // Cambiar estado a cancelado
    await this.supabase.from('transaccion').update({ estado: 'cancelado' }).eq('id', id);

    // Devolver el saldo
    const { data: user } = await this.supabase.from('usuario').select('saldo').eq('id', userId).single();
    if (user) {
      const nuevoSaldo = Number(user.saldo) + transaccion.monto;
      await this.supabase.from('usuario').update({ saldo: nuevoSaldo }).eq('id', userId);
    }

    return { message: 'Retiro cancelado exitosamente y saldo devuelto.' };
  }

  async rejectWithdrawal(id: number, adminId: number) {
    // Verificar transaccion
    const { data: transaccion, error: transError } = await this.supabase
      .from('transaccion')
      .select('monto, estado, usuario_id')
      .eq('id', id)
      .single();
      
    if (transError || !transaccion) throw new BadRequestException('Transacción no encontrada');
    if (transaccion.estado !== 'pendiente') throw new BadRequestException('Solo se pueden rechazar retiros pendientes');

    // Cambiar estado a rechazado
    await this.supabase.from('transaccion').update({ 
      estado: 'rechazado',
      fecha_procesado: new Date().toISOString(),
      procesado_por: adminId
    }).eq('id', id);

    // Devolver el saldo
    const { data: user } = await this.supabase.from('usuario').select('saldo').eq('id', transaccion.usuario_id).single();
    if (user) {
      const nuevoSaldo = Number(user.saldo) + transaccion.monto;
      await this.supabase.from('usuario').update({ saldo: nuevoSaldo }).eq('id', transaccion.usuario_id);
    }

    return { message: 'Retiro rechazado exitosamente y saldo devuelto.' };
  }
}
