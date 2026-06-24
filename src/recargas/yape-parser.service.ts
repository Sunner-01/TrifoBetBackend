// src/recargas/yape-parser.service.ts
import { Injectable, Logger } from '@nestjs/common';

/**
 * Servicio dedicado exclusivamente al análisis de notificaciones de Yape.
 *
 * Responsabilidad única (SRP): extraer nombre y monto de un texto crudo de
 * notificación, sin conocer nada de la lógica de recargas ni de la base de datos.
 *
 * Al ser un servicio independiente (OCP), se pueden agregar nuevos parsers o
 * formatos de Yape extendiendo esta clase sin tocar RecargasService.
 */
@Injectable()
export class YapeParserService {
  private readonly logger = new Logger(YapeParserService.name);

  /**
   * Extrae nombre del pagador y monto de un texto de notificación de Yape.
   * Formatos reales observados:
   *   "Recibiste un yapeo QR DE BARRERA QUIROGA OSMER SUNER te envió Bs. 3.00"
   *   "Juan Pérez te envió Bs 50.00"
   *   "Recibiste Bs 50.00 de Juan Pérez"
   *   "¡Yapeaste Bs 50.00 a Juan Pérez!"
   *   "Yape - Juan Pérez te envió S/ 50.00"
   *   "Recibiste un Yape de S/50.00 de Juan P."
   */
  parse(texto: string): { nombre: string | null; monto: number | null } {
    const monto = this.extraerMonto(texto);
    const nombre = this.extraerNombre(texto);

    this.logger.log(
      `Parseado → nombre="${nombre}" monto=${monto} | texto: "${texto}"`,
    );

    return { nombre, monto };
  }

  /**
   * Calcula la similitud normalizada entre dos strings usando distancia de Levenshtein.
   * Retorna un valor entre 0.0 (totalmente diferente) y 1.0 (idénticos).
   * Normaliza tildes y mayúsculas antes de comparar.
   */
  similitud(a: string, b: string): number {
    const s1 = this.normalizar(a);
    const s2 = this.normalizar(b);

    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    const matriz: number[][] = Array.from({ length: s2.length + 1 }, (_, i) =>
      Array.from({ length: s1.length + 1 }, (_, j) =>
        i === 0 ? j : j === 0 ? i : 0,
      ),
    );

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        const costo = s1[j - 1] === s2[i - 1] ? 0 : 1;
        matriz[i][j] = Math.min(
          matriz[i - 1][j] + 1,
          matriz[i][j - 1] + 1,
          matriz[i - 1][j - 1] + costo,
        );
      }
    }

    const distancia = matriz[s2.length][s1.length];
    const maxLen = Math.max(s1.length, s2.length);
    return 1.0 - distancia / maxLen;
  }

  // ─── Métodos privados ─────────────────────────────────────────────────────

  private extraerMonto(texto: string): number | null {
    const match = texto.match(/(?:Bs\.?|S\/)\s*([\d]+(?:[.,]\d{1,2})?)/i);
    return match ? parseFloat(match[1].replace(',', '.')) : null;
  }

  private extraerNombre(texto: string): string | null {
    let nombre: string | null = null;

    // "Recibiste un yapeo NOMBRE te envió Bs. X.XX"
    nombre ??= texto.match(/recibiste\s+un\s+yapeo\s+(.+?)\s+te\s+envi[oó]/i)?.[1]?.trim() ?? null;

    // "Yape - NOMBRE te envió ..."
    nombre ??= texto.match(/yape\s*[-–—]\s*(.+?)\s+te\s+envi[oó]/i)?.[1]?.trim() ?? null;

    // "NOMBRE te envió" (al inicio del texto)
    nombre ??= texto.match(/^(.+?)\s+te\s+envi[oó]/i)?.[1]?.trim() ?? null;

    // "Recibiste un Yape de S/X.XX de NOMBRE"
    nombre ??= texto.match(
      /recibiste\s+un\s+yape\s+de\s+(?:Bs\.?|S\/)\s*[\d.,]+\s+de\s+(.+?)(?:\s*$|[.!])/i,
    )?.[1]?.trim() ?? null;

    // "de NOMBRE" al final del texto
    nombre ??= texto.match(/de\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s.]+?)(?:\s*$|[.!])/i)?.[1]?.trim() ?? null;

    // "a NOMBRE" al final (cuando el admin yapea a alguien)
    nombre ??= texto.match(/a\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s.]+?)(?:\s*$|[.!¡])/i)?.[1]?.trim() ?? null;

    // Descartar resultados que sean demasiado cortos para ser un nombre real
    return nombre && nombre.length >= 3 ? nombre : null;
  }

  private normalizar(s: string): string {
    return s
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
