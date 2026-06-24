// src/transacciones/retiros.service.ts
import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RetiroDto } from './dto/retiro.dto';

@Injectable()
export class RetirosService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(RetirosService.name);

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!
    );
  }

  async crearRetiro(userId: number, dto: RetiroDto) {
    const { data: usuario } = await this.supabase
      .from('usuario')
      .select('verificado, saldo')
      .eq('id', userId)
      .single();

    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (!usuario.verificado) {
      throw new ForbiddenException('Debes verificar tu cuenta para realizar retiros. Por favor, completa el proceso de verificación.');
    }

    await this.validarLimitesRetiro(dto.monto);

    if (usuario.saldo < dto.monto) {
      throw new BadRequestException(`Saldo insuficiente. Saldo disponible: ${usuario.saldo.toFixed(2)} BOB`);
    }

    await this.validarMetodoPago(dto.metodoPagoId, dto.entidadFinancieraId);

    const { data, error } = await this.supabase
      .from('transaccion')
      .insert({
        usuario_id: userId,
        tipo: 'retiro',
        monto: dto.monto,
        entidad_financiera_id: dto.entidadFinancieraId,
        metodo_pago_id: dto.metodoPagoId,
        datos_pago: dto.datosPago,
        estado: 'aprobado',
        fecha_creacion: new Date().toISOString(),
        fecha_procesado: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Error al crear retiro: ${error.message}`);
      throw new BadRequestException('Error al procesar el retiro');
    }

    const nuevoSaldo = parseFloat(usuario.saldo) - dto.monto;

    const { error: updateError } = await this.supabase
      .from('usuario')
      .update({ saldo: nuevoSaldo })
      .eq('id', userId);

    if (updateError) {
      this.logger.error(`Error al actualizar saldo: ${updateError.message}`);
      throw new BadRequestException('Error al actualizar el saldo');
    }

    this.logger.log(`Retiro aprobado automáticamente: ID ${data.id} - Usuario ${userId} - Monto ${dto.monto}`);

    return {
      mensaje: 'Retiro procesado exitosamente. Tu saldo ha sido actualizado.',
      transaccion: this.formatearTransaccion(data),
    };
  }

  private async validarLimitesRetiro(monto: number) {
    const { data } = await this.supabase
      .from('config_transacciones')
      .select('clave, valor')
      .in('clave', ['retiro_minimo', 'retiro_maximo']);

    const config = data?.reduce((acc, item: any) => {
      acc[item.clave] = parseFloat(item.valor);
      return acc;
    }, {} as Record<string, number>) || {};

    const min = config.retiro_minimo || 20;
    const max = config.retiro_maximo || 2000;

    if (monto < min) throw new BadRequestException(`El monto mínimo de retiro es ${min} BOB`);
    if (monto > max) throw new BadRequestException(`El monto máximo de retiro es ${max} BOB`);
  }

  private async validarMetodoPago(metodoPagoId: number, entidadFinancieraId: number) {
    const { data, error } = await this.supabase
      .from('metodo_pago')
      .select('*')
      .eq('id', metodoPagoId)
      .eq('entidad_financiera_id', entidadFinancieraId)
      .eq('habilitado', true)
      .single();

    if (error || !data) {
      throw new BadRequestException('Método de pago no válido para esta entidad financiera');
    }
  }

  private formatearTransaccion(transaccion: any) {
    return {
      id: transaccion.id,
      tipo: transaccion.tipo,
      monto: parseFloat(transaccion.monto),
      estado: transaccion.estado,
      numeroOperacion: transaccion.numero_operacion,
      datosPago: transaccion.datos_pago,
      fechaCreacion: transaccion.fecha_creacion,
      fecha_creacion: transaccion.fecha_creacion,
      fechaProcesado: transaccion.fecha_procesado,
      fecha_procesado: transaccion.fecha_procesado,
      entidadFinanciera: transaccion.entidad_financiera,
      metodoPago: transaccion.metodo_pago,
      usuario: transaccion.usuario,
      cuenta_retiro: transaccion.cuenta_retiro,
      descripcion: transaccion.descripcion,
    };
  }
}
