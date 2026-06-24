// src/transacciones/depositos.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DepositoDto } from './dto/deposito.dto';

@Injectable()
export class DepositosService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(DepositosService.name);

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!
    );
  }

  async crearDeposito(userId: number, dto: DepositoDto) {
    await this.validarLimitesDeposito(dto.monto);
    await this.validarMetodoPago(dto.metodoPagoId, dto.entidadFinancieraId);

    const { data, error } = await this.supabase
      .from('transaccion')
      .insert({
        usuario_id: userId,
        tipo: 'deposito',
        monto: dto.monto,
        entidad_financiera_id: dto.entidadFinancieraId,
        metodo_pago_id: dto.metodoPagoId,
        numero_operacion: dto.numeroOperacion || null,
        datos_pago: dto.datosPago || {},
        estado: 'aprobado',
        fecha_creacion: new Date().toISOString(),
        fecha_procesado: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Error al crear depósito: ${error.message}`);
      throw new BadRequestException('Error al procesar el depósito');
    }

    const { data: usuarioData, error: fetchError } = await this.supabase
      .from('usuario')
      .select('saldo')
      .eq('id', userId)
      .single();

    if (fetchError || !usuarioData) {
      this.logger.error(`Error al obtener saldo del usuario: ${fetchError?.message}`);
      throw new BadRequestException('Error al obtener información del usuario');
    }

    const nuevoSaldo = parseFloat(usuarioData.saldo) + dto.monto;

    const { error: updateError } = await this.supabase
      .from('usuario')
      .update({ saldo: nuevoSaldo })
      .eq('id', userId);

    if (updateError) {
      this.logger.error(`Error al actualizar saldo: ${updateError.message}`);
      throw new BadRequestException('Error al actualizar el saldo');
    }

    this.logger.log(`Depósito aprobado automáticamente: ID ${data.id} - Usuario ${userId} - Monto ${dto.monto}`);

    return {
      mensaje: 'Depósito procesado exitosamente. Tu saldo ha sido actualizado.',
      transaccion: this.formatearTransaccion(data),
    };
  }

  private async validarLimitesDeposito(monto: number) {
    const { data } = await this.supabase
      .from('config_transacciones')
      .select('clave, valor')
      .in('clave', ['deposito_minimo', 'deposito_maximo']);

    const config = data?.reduce((acc, item: any) => {
      acc[item.clave] = parseFloat(item.valor);
      return acc;
    }, {} as Record<string, number>) || {};

    const min = config.deposito_minimo || 10;
    const max = config.deposito_maximo || 5000;

    if (monto < min) throw new BadRequestException(`El monto mínimo de depósito es ${min} BOB`);
    if (monto > max) throw new BadRequestException(`El monto máximo de depósito es ${max} BOB`);
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
