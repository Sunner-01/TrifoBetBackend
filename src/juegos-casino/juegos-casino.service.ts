import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

@Injectable()
export class JuegosCasinoService {
    private supabase: SupabaseClient;

    constructor(private configService: ConfigService) {
        this.supabase = createClient(
            this.configService.get<string>('SUPABASE_URL')!,
            this.configService.get<string>('SUPABASE_ANON_KEY')!
        );
    }

    async getActiveGames() {
        const { data, error } = await this.supabase
            .from('juego_casino')
            .select('*')
            .eq('habilitado', true);

        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    async getGameById(id: number) {
        const { data, error } = await this.supabase
            .from('juego_casino')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw new NotFoundException('Juego no encontrado');
        return data;
    }

    async getAllGamesAdmin() {
        const { data, error } = await this.supabase
            .from('juego_casino')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw new InternalServerErrorException(error.message);
        return data;
    }

    async getAllGamesAdminStats() {
        const { data: games, error: gamesError } = await this.supabase
            .from('juego_casino')
            .select('*')
            .order('created_at', { ascending: false });

        if (gamesError) throw new InternalServerErrorException(gamesError.message);

        const { data: logs, error: logsError } = await this.supabase
            .from('game_logs')
            .select('game_type, bet, profit');
        
        if (logsError) throw new InternalServerErrorException(logsError.message);

        const stats: Record<string, any> = {};
        if (logs) {
            logs.forEach(log => {
                const type = (log.game_type || '').toLowerCase();
                if (!stats[type]) {
                    stats[type] = {
                        montoApostado: 0,
                        montoRetorno: 0,
                        gananciaNeta: 0,
                        partidasJugadas: 0
                    };
                }
                
                stats[type].partidasJugadas += 1;
                const bet = Number(log.bet) || 0;
                const userProfit = Number(log.profit) || 0;

                stats[type].montoApostado += bet;
                stats[type].gananciaNeta -= userProfit;
                
                const returnAmount = bet + userProfit;
                if (returnAmount > 0) {
                    stats[type].montoRetorno += returnAmount;
                }
            });
        }

        const gamesWithStats = games.map(game => {
            let matchedType = '';
            const name = (game.nombre || '').toLowerCase();
            if (name.includes('blackjack')) matchedType = 'blackjack';
            else if (name.includes('tragamonedas') || name.includes('slots')) matchedType = 'tragamonedas';
            else if (name.includes('plinko')) matchedType = 'plinko';
            else if (name.includes('nebula')) matchedType = 'nebula';
            else if (name.includes('chicken')) matchedType = 'chicken_road';
            
            const gStats = stats[matchedType] || {
                montoApostado: 0,
                montoRetorno: 0,
                gananciaNeta: 0,
                partidasJugadas: 0
            };

            return {
                ...game,
                ...gStats
            };
        });

        return gamesWithStats;
    }

    async createGame(dto: any) {
        const { data, error } = await this.supabase
            .from('juego_casino')
            .insert(dto)
            .select()
            .single();

        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async updateGame(id: number, dto: any) {
        const { data, error } = await this.supabase
            .from('juego_casino')
            .update(dto)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new BadRequestException(error.message);
        if (!data) throw new NotFoundException('Juego no encontrado');
        return data;
    }

    async deleteGame(id: number) {
        const { error } = await this.supabase
            .from('juego_casino')
            .delete()
            .eq('id', id);

        if (error) throw new BadRequestException(error.message);
        return { message: 'Juego eliminado exitosamente' };
    }
}
