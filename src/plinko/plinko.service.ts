import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class PlinkoService {
  private supabase: SupabaseClient;
  // Multipliers for 14 rows (must match frontend)
  private readonly multipliers = [
    1000, 100, 10, 5, 2, 1, 0.5, 0.2, 0.5, 1, 2, 5, 10, 100, 1000,
  ];
  private readonly rows = 14;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get('SUPABASE_URL') || '',
      this.configService.get('SUPABASE_ANON_KEY') || '',
    );
  }

  async getBalance(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('usuario')
      .select('saldo')
      .eq('id', userId)
      .single();

    if (error) throw new Error('Error fetching balance');
    return parseFloat(data.saldo);
  }

  async play(userId: string, betAmount: number) {
    if (betAmount <= 0) throw new BadRequestException('Apuesta inválida');

    const balance = await this.getBalance(userId);
    if (balance < betAmount)
      throw new BadRequestException('Saldo insuficiente');

    // 1. Deduct bet
    let newBalance = balance - betAmount;
    await this.supabase
      .from('usuario')
      .update({ saldo: newBalance })
      .eq('id', userId);

    // Log bet
    await this.supabase.from('transaccion').insert({
      tipo: 'apuesta',
      monto: betAmount,
      usuario_id: userId,
      estado: 'completado',
      fecha_creacion: new Date().toISOString(),
      fecha_procesado: new Date().toISOString(),
      descripcion: 'Apuesta Plinko',
    });

    // 2. Simulate Path
    // 0 = Left, 1 = Right
    const path: number[] = [];
    let currentSlot = 0; // Starting index relative to the row center?
    // Actually, simpler logic:
    // We have 14 rows. Each row adds 0 or 1 to the "rightness".
    // Total "rights" determines the final bucket.
    // Bucket index 0 to 14.

    for (let i = 0; i < this.rows; i++) {
      const direction = Math.random() < 0.5 ? 0 : 1; // 0: Left, 1: Right
      path.push(direction);
      currentSlot += direction;
    }

    // currentSlot is now between 0 and 14, mapping directly to multipliers array
    const multiplier = this.multipliers[currentSlot];
    const payout = betAmount * multiplier;

    // 3. Update Balance if Win
    if (payout > 0) {
      newBalance += payout;
      await this.supabase
        .from('usuario')
        .update({ saldo: newBalance })
        .eq('id', userId);

      // Log win
      await this.supabase.from('transaccion').insert({
        tipo: 'ganancia',
        monto: payout,
        usuario_id: userId,
        estado: 'completado',
        fecha_creacion: new Date().toISOString(),
        fecha_procesado: new Date().toISOString(),
        descripcion: `Ganancia Plinko (${multiplier}x)`,
      });
    }

    return {
      path,
      multiplier,
      payout,
      finalBalance: newBalance,
      slotIndex: currentSlot,
    };
  }
}
