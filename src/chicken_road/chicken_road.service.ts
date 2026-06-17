import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChickenRoadService {
    private supabase: SupabaseClient;

    constructor(private configService: ConfigService) {
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
        const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY')!;
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    async getBalance(userId: string): Promise<number> {
        const { data } = await this.supabase
            .from('usuario')
            .select('saldo')
            .eq('id', userId)
            .single();
        return data?.saldo || 0;
    }

    async updateBalanceAndLog(
        userId: string,
        profit: number,
        bet: number,
        result: string,
    ): Promise<number> {
        const { data: current } = await this.supabase
            .from('usuario')
            .select('saldo')
            .eq('id', userId)
            .single();
        const newBalance = (current?.saldo || 0) + profit;

        await this.supabase
            .from('usuario')
            .update({ saldo: newBalance })
            .eq('id', userId);

        await this.supabase.from('game_logs').insert({
            user_id: userId,
            game_type: 'chicken_road',
            bet,
            profit,
            result,
            created_at: new Date().toISOString(),
        });

        return newBalance;
    }

    async initGame(userId: string) {
        const balance = await this.getBalance(userId);
        const { data } = await this.supabase
            .from('usuario')
            .select('nombre_usuario')
            .eq('id', userId)
            .single();

        return {
            balance,
            username: data?.nombre_usuario || 'Jugador',
        };
    }

    async processBet(userId: string, amount: number) {
        const balance = await this.getBalance(userId);
        if (balance < amount) {
            throw new Error('Fondos insuficientes');
        }

        // Deduct bet immediately
        await this.supabase
            .from('usuario')
            .update({ saldo: balance - amount })
            .eq('id', userId);

        const fechaIso = new Date().toISOString();
        await this.supabase.from('transaccion').insert({
            usuario_id: userId,
            tipo: 'apuesta',
            monto: amount,
            estado: 'completado',
            descripcion: 'Apuesta en Chicken Road',
            fecha_creacion: fechaIso,
            fecha_procesado: fechaIso,
        });

        return {
            success: true,
            newBalance: balance - amount,
            message: 'Apuesta aceptada'
        };
    }

    async processResult(userId: string, bet: number, won: boolean) {
        // If won, profit is (bet * 3) - bet = bet * 2 (net profit)
        // But since we already deducted the bet, we just need to add the winnings (bet * 3)
        // Profit for log: if won, (bet * 3) - bet. If lost, -bet.

        let profit = 0;
        let result = 'lose';
        let winnings = 0;

        if (won) {
            winnings = bet * 3;
            profit = winnings - bet;
            result = 'win';
        } else {
            profit = -bet;
            result = 'lose';
        }

        // We use updateBalanceAndLog but we need to be careful. 
        // The bet was already deducted in processBet.
        // So if we win, we add 'winnings' to the CURRENT balance (which is already minus bet).
        // updateBalanceAndLog adds 'profit' to current balance.
        // If we pass 'winnings' as profit, it will add winnings to current balance.
        // Example: Start 100. Bet 10. Balance 90.
        // Win: Winnings 30. New Balance should be 120.
        // If we pass profit=30, 90+30 = 120. Correct.
        // Lose: Winnings 0. New Balance should be 90.
        // If we pass profit=0, 90+0 = 90. Correct.

        // Wait, updateBalanceAndLog adds 'profit' to current balance.
        // If I lost, I already deducted the bet. So I don't need to deduct it again.
        // So if lost, profit to add to balance is 0.
        // If won, profit to add to balance is winnings (30).

        // But for the LOG, the profit is different.
        // Log profit: Win = +20 (30-10). Lose = -10.

        // So I should probably separate the log from the balance update or adjust the params.
        // Let's adjust the logic in this method to call supabase directly or reuse carefully.

        const { data: current } = await this.supabase
            .from('usuario')
            .select('saldo')
            .eq('id', userId)
            .single();

        const currentBalance = current?.saldo || 0;
        const newBalance = currentBalance + winnings; // Add winnings (0 if lost)

        await this.supabase
            .from('usuario')
            .update({ saldo: newBalance })
            .eq('id', userId);

        // Log
        await this.supabase.from('game_logs').insert({
            user_id: userId,
            game_type: 'chicken_road',
            bet,
            profit: won ? (bet * 2) : -bet, // Net profit
            result,
            created_at: new Date().toISOString(),
        });

        if (winnings > 0) {
            const fechaIso = new Date().toISOString();
            await this.supabase.from('transaccion').insert({
                usuario_id: userId,
                tipo: 'ganancia',
                monto: winnings,
                estado: 'completado',
                descripcion: 'Ganancia en Chicken Road',
                fecha_creacion: fechaIso,
                fecha_procesado: fechaIso,
            });
        }

        return {
            newBalance,
            won,
            winnings
        };
    }
}
