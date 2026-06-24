// src/deportes/deportes.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FootballApiService } from './football-api.service';
import { CuotasGeneratorService } from './cuotas-generator.service';

@Injectable()
export class DeportesService {
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private footballApi: FootballApiService,
    private cuotasGenerator: CuotasGeneratorService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  async obtenerPartidosFutbol(fecha?: string) {
    await this.limpiarPartidosAntiguos();

    const now = new Date();
    now.setHours(now.getHours() - 4);
    const todayStr = now.toISOString().split('T')[0];

    const datesToFetch = fecha
      ? [fecha]
      : [
          todayStr,
          this.addDays(todayStr, 1),
          this.addDays(todayStr, 2),
          this.addDays(todayStr, 3),
          this.addDays(todayStr, 4),
        ];

    console.log(`📅 Procesando fechas: ${datesToFetch.join(', ')}`);
    const resultados: any[] = [];

    for (const date of datesToFetch) {
      const isToday = date === todayStr;
      const cacheTime = isToday ? 15 * 60 * 1000 : 24 * 60 * 60 * 1000;

      const { data: cachedData, error } = await this.supabase
        .from('partidos_futbol')
        .select('*')
        .gte('fecha', `${date}T00:00:00`)
        .lte('fecha', `${date}T23:59:59`)
        .order('fecha', { ascending: true });

      const hasData = cachedData && cachedData.length > 0;
      let needsUpdate = !hasData;

      if (hasData && isToday) {
        const lastUpdate = new Date(cachedData[0].updated_at).getTime();
        if (Date.now() - lastUpdate > cacheTime) {
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        console.log(`🔄 Actualizando datos para ${date} (Es hoy: ${isToday})...`);
        const newMatches = await this.fetchAndCacheDay(date);
        resultados.push(...newMatches);
      } else {
        console.log(`✅ Usando caché para ${date} (${cachedData?.length || 0} partidos)`);
        if (cachedData) {
          resultados.push(...cachedData);
        }
      }
    }

    return this.filtrarYAgrupar(resultados);
  }

  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  private async fetchAndCacheDay(date: string) {
    try {
      const fixtures = await this.footballApi.fetchFixturesByDate(date);
      if (!fixtures || fixtures.length === 0) return [];

      const partidosProcesados = fixtures.map((fixture: any) => {
        const cuotas = this.cuotasGenerator.generarCuotasProfesionales(fixture);

        return {
          id: fixture.fixture.id,
          fecha: fixture.fixture.date,
          liga: fixture.league.name,
          logo_liga: fixture.league.logo,
          pais: fixture.league.country,
          bandera_pais: fixture.league.flag,
          equipo_local: fixture.teams.home.name,
          equipo_visitante: fixture.teams.away.name,
          escudo_local: fixture.teams.home.logo,
          escudo_visitante: fixture.teams.away.logo,
          estado: fixture.fixture.status.short,
          minuto: fixture.fixture.status.elapsed,
          goles_local: fixture.goals.home,
          goles_visitante: fixture.goals.away,
          cuotas: cuotas,
          updated_at: new Date(),
        };
      });

      const { error } = await this.supabase
        .from('partidos_futbol')
        .upsert(partidosProcesados);

      if (error) console.error(`Error guardando partidos del ${date}:`, error);

      return partidosProcesados;
    } catch (error) {
      console.error(`Error fetching ${date}:`, error);
      return [];
    }
  }

  private async limpiarPartidosAntiguos() {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const liveStatus = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];

    const { error } = await this.supabase
      .from('partidos_futbol')
      .delete()
      .lt('fecha', threeHoursAgo)
      .not('estado', 'in', `(${liveStatus.join(',')})`);

    if (error) console.error('Error limpiando partidos antiguos:', error);
  }

  private filtrarYAgrupar(partidos: any[]) {
    const now = new Date();
    const liveStatus = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];

    const partidosValidos = partidos.filter((p) => {
      const fechaPartido = new Date(p.fecha);
      const esLive = liveStatus.includes(p.estado);
      if (esLive) return true;
      return fechaPartido.getTime() > now.getTime() - 2 * 60 * 60 * 1000;
    });

    return this.agruparPorDia(this.ordenarPartidos(partidosValidos));
  }

  private ordenarPartidos(partidos: any[]) {
    const liveStatus = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'];

    return partidos.sort((a, b) => {
      const aLive = liveStatus.includes(a.estado);
      const bLive = liveStatus.includes(b.estado);

      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;

      return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
    });
  }

  private agruparPorDia(partidos: any[]) {
    return partidos.reduce((acc, partido) => {
      const fecha = partido.fecha.split('T')[0];
      if (!acc[fecha]) acc[fecha] = [];
      acc[fecha].push(partido);
      return acc;
    }, {});
  }
}
