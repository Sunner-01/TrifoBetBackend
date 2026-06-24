import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CrearApuestaDto } from '../dto/crear-apuesta.dto';
import { ApuestaResponse } from '../dto/apuesta-response.dto';
import { ApuestasSimuladorService } from './apuestas-simulador.service';
import { ApuestasQueryService } from './apuestas-query.service';

@Injectable()
export class ApuestasCoreService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(ApuestasCoreService.name);

  constructor(
    private configService: ConfigService,
    private simuladorService: ApuestasSimuladorService,
    private queryService: ApuestasQueryService
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async crearApuesta(usuarioId: number, dto: CrearApuestaDto): Promise<ApuestaResponse> {
    this.logger.log(`Usuario ${usuarioId} creando apuesta ${dto.tipo}`);

    if (dto.tipo === 'simple' && dto.selecciones.length > 1) {
      throw new BadRequestException('Una apuesta simple solo puede tener una selección');
    }

    await this.validarEventos(dto.selecciones.map((s) => s.eventoId));

    const cuotaTotal = dto.selecciones.reduce((acc, sel) => acc * sel.cuota, 1);
    const gananciaPotencial = dto.monto * cuotaTotal;

    const { data: usuario, error: usuarioError } = await this.supabase
      .from('usuario')
      .select('saldo')
      .eq('id', usuarioId)
      .single();

    if (usuarioError || !usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (parseFloat(usuario.saldo) < dto.monto) {
      throw new BadRequestException(`Saldo insuficiente. Saldo disponible: ${parseFloat(usuario.saldo).toFixed(2)} BOB`);
    }

    const nuevoSaldo = parseFloat(usuario.saldo) - dto.monto;
    const { error: updateSaldoError } = await this.supabase
      .from('usuario')
      .update({ saldo: nuevoSaldo })
      .eq('id', usuarioId);

    if (updateSaldoError) {
      this.logger.error(`Error al actualizar saldo: ${updateSaldoError.message}`);
      throw new BadRequestException('Error al procesar el pago de la apuesta');
    }

    await this.supabase.from('transaccion').insert({
      usuario_id: usuarioId,
      tipo: 'apuesta',
      monto: dto.monto,
      estado: 'completado',
      descripcion: `Apuesta deportiva ${dto.tipo} (${dto.selecciones.length} selecciones)`,
      fecha_creacion: new Date().toISOString(),
      fecha_procesado: new Date().toISOString(),
    });

    const { data: apuesta, error: apuestaError } = await this.supabase
      .from('apuesta')
      .insert({
        usuario_id: usuarioId,
        tipo: dto.tipo,
        monto: dto.monto,
        monto_total: dto.monto,
        cuota_total: parseFloat(cuotaTotal.toFixed(2)),
        ganancia_potencial: parseFloat(gananciaPotencial.toFixed(2)),
        estado: 'pendiente',
        fecha_creacion: new Date().toISOString(),
      })
      .select()
      .single();

    if (apuestaError || !apuesta) {
      await this.supabase.from('usuario').update({ saldo: usuario.saldo }).eq('id', usuarioId);
      this.logger.error(`Error al crear apuesta: ${apuestaError?.message}`);
      throw new BadRequestException('Error al crear la apuesta');
    }

    const seleccionesData = dto.selecciones.map((sel) => ({
      apuesta_id: apuesta.id,
      evento_deportivo_id: sel.eventoId,
      mercado: sel.mercado,
      seleccion: sel.seleccion,
      cuota: sel.cuota,
      evento_nombre: sel.eventoNombre || `Evento #${sel.eventoId}`,
      seleccion_display: sel.seleccionDisplay || `${sel.seleccion} (${sel.cuota})`,
      resultado_bool: null,
    }));

    const { error: seleccionesError } = await this.supabase.from('item_apuesta').insert(seleccionesData);

    if (seleccionesError) {
      this.logger.error(`Error al crear selecciones: ${seleccionesError.message}`);
    }

    this.logger.log(`Apuesta #${apuesta.id} creada exitosamente (Monto: ${dto.monto} BOB)`);

    this.simuladorService.programarSimulacion(apuesta.id);

    return this.queryService.obtenerApuestaPorId(apuesta.id, usuarioId);
  }

  async cerrarApuesta(apuestaId: number, usuarioId: number): Promise<any> {
    this.logger.log(`Usuario ${usuarioId} solicitando cashout para apuesta #${apuestaId}`);

    const { data: apuesta, error: apuestaError } = await this.supabase
      .from('apuesta')
      .select('*')
      .eq('id', apuestaId)
      .eq('usuario_id', usuarioId)
      .single();

    if (apuestaError || !apuesta) {
      throw new NotFoundException('Apuesta no encontrada');
    }

    if (apuesta.estado !== 'pendiente') {
      throw new BadRequestException(`No se puede hacer cashout de una apuesta que ya está ${apuesta.estado}`);
    }

    const montoCashout = parseFloat((apuesta.monto * 0.85).toFixed(2));

    const { error: updateApuestaError } = await this.supabase
      .from('apuesta')
      .update({
        estado: 'cashout',
        monto_cashout: montoCashout,
        fecha_cashout: new Date().toISOString(),
        fecha_procesado: new Date().toISOString(),
      })
      .eq('id', apuestaId);

    if (updateApuestaError) {
      throw new BadRequestException('Error al procesar el cashout');
    }

    await this.simuladorService.acreditarGanancias(
      usuarioId,
      montoCashout,
      'reembolso',
      `Cashout de apuesta deportiva #${apuestaId}`
    );

    this.logger.log(`Cashout exitoso para apuesta #${apuestaId}. Se devolvió ${montoCashout} BOB`);

    return {
      mensaje: 'Apuesta cerrada exitosamente',
      montoDevuelto: montoCashout,
      apuestaId: apuestaId,
    };
  }

  private async validarEventos(eventosIds: number[]): Promise<void> {
    const uniqueIds = [...new Set(eventosIds)];
    const { data: eventos, error } = await this.supabase
      .from('partidos_futbol')
      .select('id')
      .in('id', uniqueIds);

    if (error) {
      this.logger.error(`Error al validar eventos: ${error.message}`);
      throw new BadRequestException('Error al validar eventos');
    }

    if (!eventos || eventos.length !== uniqueIds.length) {
      throw new BadRequestException('Uno o más eventos no existen o no están disponibles');
    }
  }
}
