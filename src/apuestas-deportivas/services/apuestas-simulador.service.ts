import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class ApuestasSimuladorService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(ApuestasSimuladorService.name);

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  programarSimulacion(apuestaId: number): void {
    setTimeout(async () => {
      try {
        await this.simularApuesta(apuestaId);
      } catch (error) {
        this.logger.error(`Error en simulación de apuesta #${apuestaId}: ${error.message}`);
      }
    }, 60000); // 60 segundos

    this.logger.log(`Simulación programada para apuesta #${apuestaId} (60 segundos)`);
  }

  private async simularApuesta(apuestaId: number): Promise<void> {
    this.logger.log(`Simulando resultado de apuesta #${apuestaId}...`);

    const { data: apuesta, error: apuestaError } = await this.supabase
      .from('apuesta')
      .select('*')
      .eq('id', apuestaId)
      .single();

    if (apuestaError || !apuesta) {
      this.logger.error(`Apuesta #${apuestaId} no encontrada`);
      return;
    }

    if (apuesta.estado !== 'pendiente') {
      this.logger.warn(`Apuesta #${apuestaId} ya fue procesada (estado: ${apuesta.estado})`);
      return;
    }

    const { data: selecciones, error: seleccionesError } = await this.supabase
      .from('item_apuesta')
      .select('*')
      .eq('apuesta_id', apuestaId);

    if (seleccionesError || !selecciones || selecciones.length === 0) {
      this.logger.error(`No se encontraron selecciones para apuesta #${apuestaId}`);
      return;
    }

    const probabilidadGanar = apuesta.tipo === 'simple' ? 0.6 : 0.7;
    let todasGanaron = true;

    for (const seleccion of selecciones) {
      const gano = Math.random() < probabilidadGanar;

      await this.supabase
        .from('item_apuesta')
        .update({ resultado_bool: gano })
        .eq('id', seleccion.id);

      if (!gano) {
        todasGanaron = false;
      }
    }

    const apuestaGanada = todasGanaron;
    const nuevoEstado = apuestaGanada ? 'ganada' : 'perdida';

    const { error: updateApuestaError } = await this.supabase
      .from('apuesta')
      .update({
        estado: nuevoEstado,
        resultado_simulado: apuestaGanada,
        fecha_procesado: new Date().toISOString(),
      })
      .eq('id', apuestaId);

    if (updateApuestaError) {
      this.logger.error(`Error al actualizar apuesta #${apuestaId}: ${updateApuestaError.message}`);
      return;
    }

    if (apuestaGanada) {
      await this.acreditarGanancias(
        apuesta.usuario_id,
        apuesta.ganancia_potencial,
        'ganancia',
        `Ganancia de apuesta deportiva #${apuestaId}`
      );
      this.logger.log(`Apuesta #${apuestaId} GANADA! Usuario ${apuesta.usuario_id} ganó ${apuesta.ganancia_potencial} BOB`);
    } else {
      this.logger.log(`Apuesta #${apuestaId} PERDIDA`);
    }
  }

  async acreditarGanancias(
    usuarioId: number,
    monto: number,
    tipo: string = 'ganancia',
    descripcion: string = 'Ganancia de apuesta',
  ): Promise<void> {
    const { data: usuario, error: fetchError } = await this.supabase
      .from('usuario')
      .select('saldo')
      .eq('id', usuarioId)
      .single();

    if (fetchError || !usuario) {
      this.logger.error(`Error al obtener saldo del usuario ${usuarioId}`);
      return;
    }

    const nuevoSaldo = parseFloat(usuario.saldo) + monto;

    const { error: updateError } = await this.supabase
      .from('usuario')
      .update({ saldo: nuevoSaldo })
      .eq('id', usuarioId);

    if (updateError) {
      this.logger.error(`Error al acreditar ganancias a usuario ${usuarioId}: ${updateError.message}`);
      return;
    }

    await this.supabase.from('transaccion').insert({
      usuario_id: usuarioId,
      tipo: tipo,
      monto: monto,
      estado: 'completado',
      descripcion: descripcion,
      fecha_creacion: new Date().toISOString(),
      fecha_procesado: new Date().toISOString(),
    });

    this.logger.log(`Acreditado ${monto} BOB a usuario ${usuarioId}`);
  }
}
