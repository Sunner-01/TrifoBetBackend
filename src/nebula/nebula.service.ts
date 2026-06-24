import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

@Injectable()
export class NebulaService {
  private supabase: SupabaseClient;
  // Store active game sessions
  private activeSessions = new Map<
    string,
    {
      bet: number;
      crashPoint: number;
      startTime: number;
      active: boolean;
      cashedOut: boolean;
      timeoutId: any;
    }
  >();

  constructor(private configService: ConfigService) {
    const { createClient } = require('@supabase/supabase-js');
    this.supabase = createClient(
      this.configService.get('SUPABASE_URL'),
      this.configService.get('SUPABASE_ANON_KEY'),
    );
  }

  async getBalance(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('usuario')
      .select('saldo')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Supabase Error in getBalance:', error);
      throw new Error('Error fetching balance');
    }
    return parseFloat(data.saldo);
  }

  async getUsername(userId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('usuario')
      .select('nombre_usuario')
      .eq('id', userId)
      .single();

    if (error) return 'Jugador';
    return data.nombre_usuario;
  }

  async initGame(userId: string) {
    console.log('🎮 NEBULA initGame - userId:', userId);
    const balance = await this.getBalance(userId);
    const username = await this.getUsername(userId);
    console.log('🎮 NEBULA initGame - Returning:', { balance, username });
    return { balance, username };
  }

  async placeBet(userId: string, amount: number) {
    const balance = await this.getBalance(userId);
    if (balance < amount) {
      throw new BadRequestException('Saldo insuficiente');
    }

    const newBalance = balance - amount;
    const { error } = await this.supabase
      .from('usuario')
      .update({ saldo: newBalance })
      .eq('id', userId);

    if (error) throw new Error('Error updating balance');

    this.activeSessions.set(userId, {
      bet: amount,
      crashPoint: 0,
      startTime: 0,
      active: false,
      cashedOut: false,
      timeoutId: null,
    });

    const fechaIso = new Date().toISOString();
    await this.supabase.from('transaccion').insert({
      tipo: 'apuesta',
      monto: amount,
      usuario_id: userId,
      estado: 'completado',
      fecha_creacion: fechaIso,
      fecha_procesado: fechaIso,
      descripcion: 'Apuesta Nebula Crash',
    });

    return { success: true, newBalance };
  }

  async cancelBet(userId: string) {
    const session = this.activeSessions.get(userId);
    if (!session || session.active) {
      throw new BadRequestException('No se puede cancelar la apuesta ahora');
    }

    const balance = await this.getBalance(userId);
    const newBalance = balance + session.bet;

    const { error } = await this.supabase
      .from('usuario')
      .update({ saldo: newBalance })
      .eq('id', userId);

    if (error) throw new Error('Error refunding balance');

    this.activeSessions.delete(userId);

    const fechaIso = new Date().toISOString();
    await this.supabase.from('transaccion').insert({
      tipo: 'reembolso',
      monto: session.bet,
      usuario_id: userId,
      estado: 'completado',
      fecha_creacion: fechaIso,
      fecha_procesado: fechaIso,
      descripcion: 'Cancelación Apuesta Nebula',
    });

    return { success: true, newBalance };
  }

  async startGame(userId: string, client: Socket) {
    let session = this.activeSessions.get(userId);
    if (!session) {
      // Si no hay apuesta, creamos una sesión de "observador" (apuesta 0)
      session = {
        bet: 0,
        crashPoint: 0,
        startTime: 0,
        active: false,
        cashedOut: false,
        timeoutId: null,
      };
    }

    // 1. Calculate Crash Point
    const h = Math.random();
    let crashPoint = 1.0;
    if (h >= 0.04) {
      crashPoint = Math.floor((0.99 / (1 - h)) * 100) / 100;
    }

    // 2. Calculate Duration (sync with frontend formula)
    // Formula: M = e^(0.096 * t)  => t = ln(M) / 0.096
    const durationSeconds = Math.log(crashPoint) / 0.096;
    const durationMs = durationSeconds * 1000;

    // 3. Set Timeout to trigger crash
    const timeoutId = setTimeout(() => {
      this.triggerCrash(userId, client, crashPoint);
    }, durationMs);

    // 4. Update Session
    session.crashPoint = crashPoint;
    session.startTime = Date.now();
    session.active = true;
    session.timeoutId = timeoutId;
    this.activeSessions.set(userId, session);

    // 5. Return success (BUT DO NOT SEND CRASH POINT)
    return { success: true, startTime: session.startTime };
  }

  async cashout(userId: string, multiplier: number) {
    const session = this.activeSessions.get(userId);
    if (!session || !session.active) {
      throw new BadRequestException('Juego no activo o ya terminado');
    }
    if (session.cashedOut) {
      throw new BadRequestException('Ya has retirado');
    }

    if (multiplier >= session.crashPoint) {
      throw new BadRequestException('Crash occurred before cashout');
    }

    session.cashedOut = true;
    this.activeSessions.set(userId, session);

    const winnings = session.bet * multiplier;

    // OPTIMIZATION: Run DB updates in parallel and avoid extra 'select'
    // We use an RPC or just update. Since we need the new balance for the UI,
    // we can fetch it during the update if possible, or just calculate it optimistically if we trust the state.
    // For speed, let's do:
    // 1. Get current balance AND Update it in one go? Supabase doesn't support "increment and return" easily without RPC.
    // Let's stick to: Get Balance (needed for UI) + Update + Log.
    // But we can parallelize Log.

    // Faster approach:
    // 1. Fetch balance.
    // 2. Update Balance & Insert Log in parallel.

    const balance = await this.getBalance(userId);
    const newBalance = balance + winnings;

    const updateBalancePromise = this.supabase
      .from('usuario')
      .update({ saldo: newBalance })
      .eq('id', userId);

    const fechaIso = new Date().toISOString();
    const logTransactionPromise = this.supabase.from('transaccion').insert({
      tipo: 'ganancia',
      monto: winnings,
      usuario_id: userId,
      estado: 'completado',
      fecha_creacion: fechaIso,
      fecha_procesado: fechaIso,
      descripcion: `Ganancia Nebula (${multiplier.toFixed(2)}x)`,
    });

    // Await both in parallel
    const [updateResult, logResult] = await Promise.all([
      updateBalancePromise,
      logTransactionPromise,
    ]);

    if (updateResult.error) throw new Error('Error paying winnings');

    return { success: true, newBalance, winnings };
  }

  private triggerCrash(userId: string, client: Socket, crashPoint: number) {
    const session = this.activeSessions.get(userId);
    if (session) {
      // Emit crash event to client
      client.emit('nebulaGameCrashed', { crashPoint });

      // Cleanup
      this.activeSessions.delete(userId);
    }
  }

  handleDisconnect(userId: string) {
    const session = this.activeSessions.get(userId);
    if (session && session.timeoutId) {
      clearTimeout(session.timeoutId);
      this.activeSessions.delete(userId);
    }
  }
}
