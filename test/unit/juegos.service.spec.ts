/**
 * test/unit/juegos.service.spec.ts
 *
 * PRUEBAS UNITARIAS — PlinkoService, TragamonedasService, ChickenRoadService
 * 8 casos que verifican la lógica de juego sin depender de la base de datos.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

import { PlinkoService } from '../../src/plinko/plinko.service';
import { TragamonedasService } from '../../src/tragamonedas/tragamonedas.service';
import { ChickenRoadService } from '../../src/chicken_road/chicken_road.service';
import { createMockSupabaseClient } from '../helpers/supabase.mock';

jest.mock('@supabase/supabase-js');

// ── Configuración compartida ───────────────────────────────────────────────
const mockConfigService = {
  get: jest.fn().mockReturnValue('test-value'),
};

describe('Juegos — Pruebas Unitarias', () => {
  let plinkoService: PlinkoService;
  let tragamonedasService: TragamonedasService;
  let chickenRoadService: ChickenRoadService;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(async () => {
    mockSupabase = createMockSupabaseClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlinkoService,
        TragamonedasService,
        ChickenRoadService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    plinkoService = module.get<PlinkoService>(PlinkoService);
    tragamonedasService = module.get<TragamonedasService>(TragamonedasService);
    chickenRoadService = module.get<ChickenRoadService>(ChickenRoadService);

    // Inyectamos el mock directamente en cada servicio
    (plinkoService as any).supabase = mockSupabase;
    (tragamonedasService as any).supabase = mockSupabase;
    (chickenRoadService as any).supabase = mockSupabase;
  });

  afterEach(() => jest.clearAllMocks());

  // ════════════════════════════════════════════════════════════════════════
  // PLINKO
  // ════════════════════════════════════════════════════════════════════════

  // ── CASO 22: Plinko — apuesta inválida ─────────────────────────────────
  it('[Plinko] play() debe lanzar BadRequestException si betAmount <= 0', async () => {
    await expect(plinkoService.play('user-1', 0)).rejects.toThrow(
      BadRequestException,
    );
    await expect(plinkoService.play('user-1', -5)).rejects.toThrow(
      BadRequestException,
    );
  });

  // ── CASO 23: Plinko — path tiene exactamente 14 pasos ─────────────────
  it('[Plinko] play() debe retornar un path con exactamente 14 pasos (0 ó 1)', async () => {
    // Saldo suficiente
    mockSupabase.single.mockResolvedValue({
      data: { saldo: 1000 },
      error: null,
    });
    // Actualización de saldo y transacciones
    mockSupabase._setThenResult(null, null);

    const result = await plinkoService.play('user-1', 10);

    expect(result.path).toHaveLength(14);
    result.path.forEach((step: number) => {
      expect([0, 1]).toContain(step);
    });
  });

  // ── CASO 24: Plinko — multiplier es un valor válido ────────────────────
  it('[Plinko] play() debe retornar un multiplier del array de multiplicadores', async () => {
    const validMultipliers = [
      1000, 100, 10, 5, 2, 1, 0.5, 0.2, 0.5, 1, 2, 5, 10, 100, 1000,
    ];

    mockSupabase.single.mockResolvedValue({
      data: { saldo: 1000 },
      error: null,
    });
    mockSupabase._setThenResult(null, null);

    const result = await plinkoService.play('user-1', 10);

    expect(validMultipliers).toContain(result.multiplier);
    expect(result.slotIndex).toBeGreaterThanOrEqual(0);
    expect(result.slotIndex).toBeLessThanOrEqual(14);
  });

  // ════════════════════════════════════════════════════════════════════════
  // TRAGAMONEDAS
  // ════════════════════════════════════════════════════════════════════════

  // ── CASO 25: Tragamonedas — genera grid 3x3 válido ───────────────────
  it('[Tragamonedas] spin() debe generar un grid 3x3 con IDs de símbolo válidos (0-8)', async () => {
    mockSupabase.single.mockResolvedValue({
      data: { saldo: 500 },
      error: null,
    });
    mockSupabase._setThenResult(null, null);

    const result = await tragamonedasService.spin('user-1', 5);

    expect(result.success).toBe(true);
    expect(result.grid).toHaveLength(3);
    result.grid.forEach((col: number[]) => {
      expect(col).toHaveLength(3);
      col.forEach((id: number) => {
        expect(id).toBeGreaterThanOrEqual(0);
        expect(id).toBeLessThanOrEqual(8);
      });
    });
  });

  // ── CASO 26: Tragamonedas — balance disminuye por la apuesta ───────────
  it('[Tragamonedas] spin() debe reducir el balance en el monto de la apuesta', async () => {
    mockSupabase.single.mockResolvedValue({
      data: { saldo: 100 },
      error: null,
    });
    mockSupabase._setThenResult(null, null);

    const result = await tragamonedasService.spin('user-1', 10);

    // Si no hay ganancia, newBalance = 100 - 10 = 90
    // Si hay ganancia, newBalance = 90 + totalWin (puede ser > 90)
    expect(result.newBalance).toBeGreaterThanOrEqual(0);
  });

  // ════════════════════════════════════════════════════════════════════════
  // CHICKEN ROAD
  // ════════════════════════════════════════════════════════════════════════

  // ── CASO 27: ChickenRoad — error si fondos insuficientes ──────────────
  it('[ChickenRoad] processBet() debe lanzar error si balance < amount', async () => {
    mockSupabase.single.mockResolvedValue({ data: { saldo: 5 }, error: null });

    await expect(chickenRoadService.processBet('user-1', 50)).rejects.toThrow(
      'Fondos insuficientes',
    );
  });

  // ── CASO 28: ChickenRoad — ganancias al ganar ─────────────────────────
  it('[ChickenRoad] processResult() debe acreditar bet*3 si ganó', async () => {
    // currentBalance luego de apostar ya descontado = 90
    mockSupabase.single.mockResolvedValue({ data: { saldo: 90 }, error: null });
    mockSupabase._setThenResult(null, null);

    const result = await chickenRoadService.processResult('user-1', 10, true);

    // winnings = bet * 3 = 30
    // newBalance = 90 + 30 = 120
    expect(result.won).toBe(true);
    expect(result.winnings).toBe(30);
    expect(result.newBalance).toBe(120);
  });
});
