/**
 * test/integration/blackjack.integration.spec.ts
 *
 * PRUEBAS DE INTEGRACIÓN — Blackjack
 * 5 casos: flujo completo usando los métodos del servicio en secuencia.
 * Verifica interacciones complejas de estado.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

import { BlackjackService } from '../../src/blackjack/blackjack.service';
import { createMockSupabaseClient } from '../helpers/supabase.mock';

jest.mock('@supabase/supabase-js');

describe('Blackjack — Pruebas de Integración (Estado)', () => {
  let service: BlackjackService;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(async () => {
    mockSupabase = createMockSupabaseClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlackjackService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test') } },
      ],
    }).compile();

    service = module.get<BlackjackService>(BlackjackService);
    (service as any).supabase = mockSupabase;
  });

  // ── CASO 16: BlackjackService — hit completo ──────────────────────────────
  it('Flujo hit: deal + hit incrementa el score correctamente', async () => {
    const userId = 'user-1';
    service.initGame(userId, 1000);
    service.addBet(userId, 100);
    
    await service.dealInitial(userId);
    // Forzamos cartas para prueba estable
    const state = service.getState(userId);
    state.playerHands[0] = [{ suit: 'Heart', value: '10', isRed: true, numericValue: 10 } as any];
    state.playerScores[0] = 10;
    
    // Forzamos la siguiente carta en el deck
    state.deck.cards.push({ suit: 'Club', value: '5', isRed: false, numericValue: 5 } as any);
    
    const update = service.hit(userId) as any;
    expect(update.playerScores[0]).toBe(15);
    expect(update.handStatus[0]).toBe('playing');
  });

  // ── CASO 17: BlackjackService — bust ──────────────────────────────────────
  it('Bust: hit hasta superar 21 cambia el estado a busted', async () => {
    const userId = 'user-2';
    service.initGame(userId, 1000);
    service.addBet(userId, 100);
    
    await service.dealInitial(userId);
    const state = service.getState(userId);
    // Mano inicial 15
    state.playerHands[0] = [
      { suit: 'Heart', value: '10', isRed: true, numericValue: 10 } as any,
      { suit: 'Club', value: '5', isRed: false, numericValue: 5 } as any
    ];
    state.playerScores[0] = 15;
    
    // Siguiente carta 10
    state.deck.cards.push({ suit: 'Diamond', value: '10', isRed: true, numericValue: 10 } as any);
    
    const update = service.hit(userId) as any;
    expect(update.playerScores[0]).toBe(25);
    expect(update.handStatus[0]).toBe('busted');
  });

  // ── CASO 18: BlackjackService — stand ─────────────────────────────────────
  it('Stand: marca la mano como stood y activa el turno del dealer', async () => {
    const userId = 'user-3';
    service.initGame(userId, 1000);
    service.addBet(userId, 100);
    
    await service.dealInitial(userId);
    const update = service.stand(userId) as any;
    
    expect(update.handStatus[0]).toBe('stood');
    expect(update.message).toMatch(/dealer/i);
  });

  // ── CASO 19: BlackjackService — split ─────────────────────────────────────
  it('Split: divide un par en dos manos separadas', async () => {
    const userId = 'user-4';
    service.initGame(userId, 1000);
    service.addBet(userId, 100); // 100 apuesta inicial
    
    await service.dealInitial(userId);
    const state = service.getState(userId);
    
    // Forzar un par de 8s
    const card8 = { suit: 'Heart', value: '8', isRed: true, numericValue: 8 } as any;
    state.playerHands[0] = [card8, card8];
    state.playerScores[0] = 16;
    
    const update = service.split(userId) as any;
    expect(update.playerHands).toHaveLength(2);
    expect(update.playerHands[0]).toHaveLength(1);
    expect(update.playerHands[1]).toHaveLength(1);
    expect(update.handBets).toHaveLength(2);
    expect(update.handBets[0]).toBe(100);
    expect(update.handBets[1]).toBe(100);
    expect(update.balance).toBe(800); // 1000 - 100 (initial) - 100 (split)
  });

  // ── CASO 20: BlackjackService — double ────────────────────────────────────
  it('Double: dobla la apuesta, pide 1 carta y cambia a stood', async () => {
    const userId = 'user-5';
    service.initGame(userId, 1000);
    service.addBet(userId, 100);
    
    await service.dealInitial(userId);
    const state = service.getState(userId);
    state.playerHands[0] = [
       { suit: 'Heart', value: '5', isRed: true, numericValue: 5 } as any,
       { suit: 'Club', value: '6', isRed: false, numericValue: 6 } as any,
    ];
    state.playerScores[0] = 11;
    state.deck.cards.push({ suit: 'Spade', value: '10', isRed: false, numericValue: 10 } as any);
    
    const update = service.double(userId) as any;
    expect(update.handBets[0]).toBe(200);
    expect(update.playerHands[0]).toHaveLength(3);
    expect(update.playerScores[0]).toBe(21);
    expect(update.handStatus[0]).toBe('stood');
  });
});
