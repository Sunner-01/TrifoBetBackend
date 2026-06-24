import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class GeolocalizacionService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  /**
   * Verifica si un punto está dentro de Bolivia
   * @param lat Latitud
   * @param lng Longitud
   * @returns true si está dentro de Bolivia, false si no
   */
  async verificarDentroDeBolivia(lat: number, lng: number): Promise<boolean> {
    try {
      // Obtener el polígono de Bolivia de la base de datos
      const { data, error } = await this.supabase
        .from('zonas_permitidas')
        .select('poligono')
        .eq('nombre', 'Bolivia')
        .eq('activo', true)
        .single();

      if (error || !data) {
        console.error('Error obteniendo polígono de Bolivia:', error);
        return false;
      }

      const poligono = data.poligono as Array<{ lat: number; lng: number }>;

      console.log(`[GeoDebug] Verificando punto: Lat=${lat}, Lng=${lng}`);
      console.log(`[GeoDebug] Polígono puntos: ${poligono.length}`);
      console.log(
        `[GeoDebug] Primer punto polígono: ${JSON.stringify(poligono[0])}`,
      );

      // Algoritmo Ray Casting para point-in-polygon
      const resultado = this.puntoEnPoligono(lat, lng, poligono);
      console.log(`[GeoDebug] Resultado: ${resultado}`);
      return resultado;
    } catch (error) {
      console.error('Error en verificarDentroDeBolivia:', error);
      return false;
    }
  }

  /**
   * Algoritmo Ray Casting para verificar si un punto está dentro de un polígono
   * @param lat Latitud del punto
   * @param lng Longitud del punto
   * @param poligono Array de coordenadas del polígono
   * @returns true si el punto está dentro, false si no
   */
  private puntoEnPoligono(
    lat: number,
    lng: number,
    poligono: Array<{ lat: number; lng: number }>,
  ): boolean {
    let dentro = false;
    const n = poligono.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = poligono[i].lng;
      const yi = poligono[i].lat;
      const xj = poligono[j].lng;
      const yj = poligono[j].lat;

      const intersect =
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

      if (intersect) dentro = !dentro;
    }

    return dentro;
  }
}
