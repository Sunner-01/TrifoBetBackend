/**
 * test/e2e/blackjack.e2e-spec.ts
 *
 * PRUEBAS E2E — Blackjack WebSocket Gateway
 * 5 casos probando la conexión autenticada y flujo del juego.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { JwtService } from '@nestjs/jwt';
import { io, Socket } from 'socket.io-client';
import { createClient } from '@supabase/supabase-js';

import { AppModule } from '../../src/app.module';
import { createMockSupabaseClient } from '../helpers/supabase.mock';

jest.mock('@supabase/supabase-js');
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('$hashed$'),
}));

// Helper: espera un evento del socket con timeout
function waitForEvent(
  socket: Socket,
  event: string,
  timeoutMs = 4000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(
        new Error(`Timeout esperando evento '${event}' tras ${timeoutMs}ms`),
      );
    }, timeoutMs);

    const handler = (data: any) => {
      clearTimeout(timer);
      resolve(data);
    };
    socket.once(event, handler);
  });
}

describe('BlackjackGateway (e2e)', () => {
  let app: INestApplication;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let socket: Socket;
  let jwtToken: string;

  beforeAll(async () => {
    mockSupabase = createMockSupabaseClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0); // Puerto aleatorio

    // Token JWT real firmado con el secreto de pruebas
    const jwtService = moduleFixture.get<JwtService>(JwtService);
    jwtToken = jwtService.sign({ sub: '1', username: 'wsUser' });

    const url = await app.getUrl();

    // Mocks para handleConnection: getBalance + nombre_usuario
    mockSupabase.single
      .mockResolvedValueOnce({ data: { saldo: 1000 }, error: null })
      .mockResolvedValueOnce({
        data: { nombre_usuario: 'wsUser' },
        error: null,
      });

    socket = io(`${url}`, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: jwtToken },
    });

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', (err) =>
        reject(new Error(`WS connect error: ${err.message}`)),
      );
      setTimeout(
        () => reject(new Error('Timeout al conectar WebSocket')),
        8000,
      );
    });
  }, 20000);

  afterAll(async () => {
    socket.disconnect();
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  // ── CASO 16: Conexión autenticada + joinGame ───────────────────────────────
  it('Debe conectarse y recibir gameState al emitir joinGame', async () => {
    mockSupabase.single
      .mockResolvedValueOnce({ data: { saldo: 1000 }, error: null })
      .mockResolvedValueOnce({
        data: { nombre_usuario: 'wsUser' },
        error: null,
      });

    socket.emit('joinGame');
    const state = await waitForEvent(socket, 'gameState');

    expect(state).toBeDefined();
    expect(state).toHaveProperty('balance');
  });

  // ── CASO 17: addBet ───────────────────────────────────────────────────────
  it('Debe responder con gameUpdate al añadir apuesta', async () => {
    socket.emit('addBet', { amount: 50 });
    const update = await waitForEvent(socket, 'gameUpdate');

    expect(update).toBeDefined();
    expect(update.currentBet).toBe(50);
  });

  // ── CASO 18: dealInitial ──────────────────────────────────────────────────
  it('Debe repartir cartas al emitir dealInitial', async () => {
    socket.emit('dealInitial');

    // dealInitial envía múltiples gameUpdate; esperamos que alguno tenga playerHands
    const state = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off('gameUpdate', handler);
        reject(new Error('Timeout esperando dealInitial con playerHands'));
      }, 9000);

      const handler = (data: any) => {
        if (
          data.playerHands &&
          data.playerHands[0] &&
          data.playerHands[0].length > 0
        ) {
          clearTimeout(timer);
          socket.off('gameUpdate', handler);
          resolve(data);
        }
      };
      socket.on('gameUpdate', handler);
    });

    expect(state.playerHands[0].length).toBeGreaterThan(0);
  }, 12000);

  // ── CASO 19: resetGame ────────────────────────────────────────────────────
  it('Debe reiniciar el juego y recibir gameState', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { saldo: 1000 },
      error: null,
    });

    socket.emit('resetGame');
    const state = await waitForEvent(socket, 'gameState');

    expect(state).toBeDefined();
    expect(state).toHaveProperty('balance');
  });

  // ── CASO 20: stand (responde con gameUpdate) ──────────────────────────────
  it('Debe responder con gameUpdate al emitir stand', async () => {
    socket.emit('stand');
    const update = await waitForEvent(socket, 'gameUpdate');

    expect(update).toBeDefined();
  });
});
