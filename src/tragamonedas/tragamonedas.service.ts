import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';

// --- CONFIGURATION FROM FRONTEND ---
const SYMBOLS = {
    0: { id: 0, name: 'Cherry', value: 5, type: 'standard' },
    1: { id: 1, name: 'Bell', value: 10, type: 'standard' },
    2: { id: 2, name: 'Bar', value: 20, type: 'standard' },
    3: { id: 3, name: 'Bar2', value: 40, type: 'standard' },
    4: { id: 4, name: 'Bar3', value: 60, type: 'standard' },
    5: { id: 5, name: 'Seven', value: 100, type: 'standard' },
    6: { id: 6, name: 'Diamond', value: 200, type: 'standard' },
    7: { id: 7, name: 'Wild', value: 500, type: 'wild' },
    8: { id: 8, name: 'Scatter', value: 100, type: 'scatter' }
};

const WEIGHTS = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 7, 8];

const PAYLINES = [
    [[0, 0], [1, 0], [2, 0]], // Top
    [[0, 1], [1, 1], [2, 1]], // Middle
    [[0, 2], [1, 2], [2, 2]], // Bottom
    [[0, 0], [1, 1], [2, 2]], // Diagonal \
    [[0, 2], [1, 1], [2, 0]]  // Diagonal /
];

@Injectable()
export class TragamonedasService {
    private supabase: SupabaseClient;

    constructor(private configService: ConfigService) {
        const { createClient } = require('@supabase/supabase-js');
        this.supabase = createClient(
            this.configService.get('SUPABASE_URL'),
            this.configService.get('SUPABASE_ANON_KEY'),
        );
    }

    private getRandomSymbolId(): number {
        const idx = Math.floor(Math.random() * WEIGHTS.length);
        return WEIGHTS[idx];
    }

    async getBalance(userId: string): Promise<number> {
        const { data, error } = await this.supabase
            .from('usuario') // Correct table name
            .select('saldo')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Supabase Error in getBalance (Tragamonedas):', error);
            throw new Error('Error fetching balance');
        }
        return parseFloat(data.saldo);
    }

    async spin(userId: string, totalBet: number) {
        if (totalBet <= 0) throw new BadRequestException('Apuesta inválida');

        // 1. Validate and Deduct Bet
        const balance = await this.getBalance(userId);
        if (balance < totalBet) {
            throw new BadRequestException('Saldo insuficiente');
        }

        // Deduct bet immediately
        const balanceAfterBet = balance - totalBet;
        const { error: updateError } = await this.supabase
            .from('usuario')
            .update({ saldo: balanceAfterBet })
            .eq('id', userId);

        if (updateError) throw new Error('Error deducting bet');

        // 2. Generate Grid (RNG)
        const grid: number[][] = [];
        for (let col = 0; col < 3; col++) {
            let column: number[] = [];
            for (let row = 0; row < 3; row++) {
                column.push(this.getRandomSymbolId());
            }
            grid.push(column);
        }

        // 3. Calculate Winnings
        let totalWin = 0;
        const winLines: number[] = []; // Indices of winning paylines

        // A. Scatters (Any position)
        let scatterCount = 0;
        grid.flat().forEach(id => {
            if (SYMBOLS[id].type === 'scatter') scatterCount++;
        });

        if (scatterCount >= 3) {
            // 3 Scatters = 5x, >3 (impossible in 3x3 but logic exists) = 10x? 
            // Frontend logic: if (scatterCount >= 3) totalWin += totalBet * (scatterCount === 3 ? 5 : 10);
            const scatterWin = totalBet * (scatterCount === 3 ? 5 : 10);
            totalWin += scatterWin;
        }

        // B. Paylines
        PAYLINES.forEach((line, idx) => {
            const ids = line.map(p => grid[p[0]][p[1]]);
            const firstId = ids[0];
            const firstSym = SYMBOLS[firstId];

            let matchCount = 1;

            // Check match against first symbol (or Wild logic)
            // Frontend logic:
            // for (let i = 1; i < 3; i++) {
            //    const s = SYMBOLS[ids[i]];
            //    if (ids[i] === first || s.type === 'wild') count++;
            //    else break;
            // }
            // NOTE: This logic implies if First is Wild, it matches Wilds. 
            // If First is Cherry, it matches Cherries OR Wilds.

            for (let i = 1; i < 3; i++) {
                const currentId = ids[i];
                const currentSym = SYMBOLS[currentId];

                if (currentId === firstId || currentSym.type === 'wild') {
                    matchCount++;
                } else {
                    break;
                }
            }

            if (matchCount === 3) {
                // Win!
                // Value depends on the FIRST symbol (unless it's a Wild substitution? No, frontend uses first symbol value)
                // const val = sym.type === 'wild' ? 500 : sym.value;
                const symbolValue = firstSym.type === 'wild' ? 500 : firstSym.value;

                // Frontend formula: totalWin += val * (this.totalBet / 5);
                const lineWin = symbolValue * (totalBet / 5);
                totalWin += lineWin;
                winLines.push(idx);
            }
        });

        // 4. Update Balance with Winnings (if any)
        let finalBalance = balanceAfterBet;

        // Logging to game_logs
        const result = totalWin > 0 ? 'win' : 'lose';
        const profit = totalWin - totalBet;

        const logPromise = this.supabase.from('game_logs').insert({
            user_id: userId,
            game_type: 'tragamonedas',
            bet: totalBet,
            profit: profit,
            result: result,
            metadata: { grid, winLines, scatterCount },
            created_at: new Date().toISOString(),
        });

        const fechaIso = new Date().toISOString();
        const txBetPromise = this.supabase.from('transaccion').insert({
            usuario_id: userId,
            tipo: 'apuesta',
            monto: totalBet,
            estado: 'completado',
            descripcion: 'Apuesta en Tragamonedas',
            fecha_creacion: fechaIso,
            fecha_procesado: fechaIso
        });

        let txWinPromise: any = null;
        if (totalWin > 0) {
            finalBalance += totalWin;
            const updatePromise = this.supabase
                .from('usuario')
                .update({ saldo: finalBalance })
                .eq('id', userId);
            
            txWinPromise = this.supabase.from('transaccion').insert({
                usuario_id: userId,
                tipo: 'ganancia',
                monto: totalWin,
                estado: 'completado',
                descripcion: 'Ganancia en Tragamonedas',
                fecha_creacion: fechaIso,
                fecha_procesado: fechaIso
            });
            
            await Promise.all([updatePromise, logPromise, txBetPromise, txWinPromise]);
        } else {
            await Promise.all([logPromise, txBetPromise]);
        }

        return {
            success: true,
            grid,
            totalWin,
            newBalance: finalBalance,
            winLines,
            scatterCount
        };
    }
}
