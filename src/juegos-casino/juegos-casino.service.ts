// src/juegos-casino/juegos-casino.service.ts
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

@Injectable()
export class JuegosCasinoService {
  private supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
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

  async getUserHistory(userId: number) {
    const { data, error } = await this.supabase
      .from('game_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) throw new Error(error.message);
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
}
