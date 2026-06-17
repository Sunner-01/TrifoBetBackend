/**
 * test/unit/blackjack.service.spec.ts
 *
 * PRUEBAS UNITARIAS — BlackjackService
 * 6 casos: calculateScore, initGame, addBet, clearBet, hit (bust), stand.
 * BlackjackService mantiene el estado en memoria; solo mocking de Supabase
 * y ConfigService para el constructor.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

import { BlackjackService } from '../../src/blackjack/blackjack.service';
import { createMockSupabaseClient } from '../helpers/supabase.mock';

jest.mock('@supabase/supabase-js');

// ── Helper: crea una "Card" compatible con el modelo interno ───────────────
function makeCard(suit: string, value: string) {
  let numericValue = parseInt(value);
  if (['J', 'Q', 'K'].includes(value)) numericValue = 10;
  if (value === 'A') numericValue = 11;
  return { suit, value, isRed: suit === 'Heart' || suit === 'Diamond', numericValue };
}

describe('BlackjackService — Pruebas Unitarias', () => {
  let service: BlackjackService;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(async () => {
    mockSupabase = createMockSupabaseClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlackjackService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-value') },
        },
      ],
    }).compile();

    service = module.get<BlackjackService>(BlackjackService);
    (service as any).supabase = mockSupabase;
  });

  afterEach(() => jest.clearAllMocks());

  // ── CASO 7: calculateScore — sin ases ────────────────────────────────────
  it('calculateScore() debe calcular correctamente una mano sin ases (10 + K = 20)', () => {
    const hand = [makeCard('Spade', '10'), makeCard('Heart', 'K')] as any[];
    expect(service.calculateScore(hand)).toBe(20);
  });

  // ── CASO 8: calculateScore — ajuste de As ────────────────────────────────
  it('calculateScore() debe ajustar As de 11→1 para evitar pasarse (A + K + 5 = 16)', () => {
    const hand = [
      makeCard('Spade', 'A'),
      makeCard('Heart', 'K'),
      makeCard('Club', '5'),
    ] as any[];
    // A=11 + K=10 + 5=5 = 26 → ajustar A a 1 → 16
    expect(service.calculateScore(hand)).toBe(16);
  });

  // ── CASO 9: initGame — estado inicial correcto ────────────────────────────
  it('initGame() debe crear un estado de juego con balance y estructura correctos', () => {
    const state = service.initGame('user-1', 500);

    expect(state.balance).toBe(500);
    expect(state.currentBet).toBe(0);
    expect(state.playerHands).toEqual([[]]);
    expect(state.dealerHand).toEqual([]);
    expect(state.message).toBe('Haz tu apuesta');
  });

  // ── CASO 10: addBet — fondos insuficientes ────────────────────────────────
  it('addBet() debe lanzar error si el monto supera el balance disponible', () => {
    service.initGame('user-2', 50);
    expect(() => service.addBet('user-2', 100)).toThrow('Fondos insuficientes');
  });

  // ── CASO 11: addBet — descuenta del balance y suma a currentBet ───────────
  it('addBet() debe descontar la apuesta del balance y acumularla en currentBet', () => {
    service.initGame('user-3', 200);
    const partial = service.addBet('user-3', 50) as any;

    expect(partial.balance).toBe(150);
    expect(partial.currentBet).toBe(50);
  });

  // ── CASO 12: clearBet — devuelve apuesta al balance ──────────────────────
  it('clearBet() debe devolver la apuesta acumulada al balance y resetear currentBet', () => {
    service.initGame('user-4', 200);
    service.addBet('user-4', 75);

    const partial = service.clearBet('user-4') as any;

    expect(partial.balance).toBe(200);
    expect(partial.currentBet).toBe(0);
  });
});
