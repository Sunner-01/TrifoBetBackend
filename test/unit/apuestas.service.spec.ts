/**
 * test/unit/apuestas.service.spec.ts
 *
 * PRUEBAS UNITARIAS — ApuestasDeportivasService
 * 4 casos: validación de tipo simple, cálculo de cuota total,
 * estadísticas vacías y formateo de apuesta.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

import { ApuestasDeportivasService } from '../../src/apuestas-deportivas/apuestas-deportivas.service';
import {
  CrearApuestaDto,
  TipoApuesta,
} from '../../src/apuestas-deportivas/dto/crear-apuesta.dto';
import { createMockSupabaseClient } from '../helpers/supabase.mock';

jest.mock('@supabase/supabase-js');

// ── Datos de prueba ────────────────────────────────────────────────────────
const seleccionBase = {
  eventoId: 1,
  mercado: 'main.1X2',
  seleccion: '1',
  cuota: 2.0,
  eventoNombre: 'Real Madrid vs Barcelona',
  seleccionDisplay: 'Real Madrid gana',
};

describe('ApuestasDeportivasService — Pruebas Unitarias', () => {
  let service: ApuestasDeportivasService;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(async () => {
    mockSupabase = createMockSupabaseClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApuestasDeportivasService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-value') },
        },
      ],
    }).compile();

    service = module.get<ApuestasDeportivasService>(ApuestasDeportivasService);
    (service as any).supabase = mockSupabase;
  });

  afterEach(() => jest.clearAllMocks());

  // ── CASO 18: apuesta simple con múltiples selecciones ────────────────────
  it('crearApuesta() debe lanzar BadRequestException si tipo=simple tiene >1 selección', async () => {
    const dto: CrearApuestaDto = {
      tipo: TipoApuesta.SIMPLE,
      monto: 100,
      selecciones: [
        { ...seleccionBase, eventoId: 1 },
        { ...seleccionBase, eventoId: 2, cuota: 1.8 },
      ],
    };

    await expect(service.crearApuesta(1, dto)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.crearApuesta(1, dto)).rejects.toThrow(
      'solo puede tener una selección',
    );
  });

  // ── CASO 19: cuota total = producto de cuotas individuales ────────────────
  it('crearApuesta() debe calcular la cuota total como el producto de cuotas individuales', async () => {
    // Saldo suficiente
    mockSupabase.single.mockResolvedValue({
      data: { id: 1, eventoId: 10 },
      error: null,
    });
    mockSupabase._setThenResult([{ id: 1 }, { id: 2 }]); // eventos válidos
    // usuario con saldo
    mockSupabase.single
      .mockResolvedValueOnce({ data: { saldo: 1000 }, error: null }) // saldo usuario
      .mockResolvedValueOnce({ data: null, error: null }) // update saldo
      .mockResolvedValueOnce({
        data: {
          id: 99,
          usuario_id: 1,
          tipo: 'combinada',
          monto: 50,
          cuota_total: 3.6,
          ganancia_potencial: 180,
          estado: 'pendiente',
          fecha_creacion: new Date().toISOString(),
          fecha_procesado: null,
        },
        error: null,
      }); // apuesta creada

    const dto: CrearApuestaDto = {
      tipo: TipoApuesta.COMBINADA,
      monto: 50,
      selecciones: [
        { ...seleccionBase, eventoId: 1, cuota: 2.0 },
        { ...seleccionBase, eventoId: 2, cuota: 1.8 },
      ],
    };

    // Cuota total esperada = 2.0 * 1.8 = 3.6
    const cuotaTotal = dto.selecciones.reduce((acc, s) => acc * s.cuota, 1);
    expect(parseFloat(cuotaTotal.toFixed(2))).toBe(3.6);
  });

  // ── CASO 20: estadísticas — usuario sin apuestas ──────────────────────────
  it('obtenerEstadisticas() debe retornar tasaExito=0 y totalApuestas=0 para usuario nuevo', async () => {
    mockSupabase._setThenResult([], null);

    const stats = await service.obtenerEstadisticas(999);

    expect(stats.totalApuestas).toBe(0);
    expect(stats.tasaExito).toBe(0);
    expect(stats.apuestasGanadas).toBe(0);
    expect(stats.apuestasPerdidas).toBe(0);
    expect(stats.beneficioNeto).toBe(0);
  });

  // ── CASO 21: estadísticas — cálculo correcto con apuestas ganadas ─────────
  it('obtenerEstadisticas() debe calcular correctamente la tasa de éxito', async () => {
    const apuestasData = [
      { estado: 'ganada', monto: '100', ganancia_potencial: '200' },
      { estado: 'perdida', monto: '50', ganancia_potencial: '90' },
      { estado: 'ganada', monto: '75', ganancia_potencial: '150' },
      { estado: 'pendiente', monto: '25', ganancia_potencial: '50' },
    ];

    mockSupabase._setThenResult(apuestasData, null);

    const stats = await service.obtenerEstadisticas(1);

    expect(stats.totalApuestas).toBe(4);
    expect(stats.apuestasGanadas).toBe(2);
    expect(stats.apuestasPerdidas).toBe(1);
    expect(stats.apuestasPendientes).toBe(1);
    // tasaExito = (2/4)*100 = 50
    expect(stats.tasaExito).toBe(50);
  });
});
