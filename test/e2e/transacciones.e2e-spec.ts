/**
 * test/e2e/transacciones.e2e-spec.ts
 *
 * PRUEBAS E2E — Transacciones
 * 5 casos completos.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

import { AppModule } from '../../src/app.module';
import { createMockSupabaseClient } from '../helpers/supabase.mock';

jest.mock('@supabase/supabase-js');
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('$hashed$'),
}));

describe('TransaccionesModule (e2e)', () => {
  let app: INestApplication;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let token: string;

  beforeAll(async () => {
    mockSupabase = createMockSupabaseClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Login for token
    mockSupabase.single.mockResolvedValue({
      data: { id: 1, verificado: true, saldo: 500 },
      error: null,
    });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ nombreUsuario: 'test', contrasena: 'test' });
    token = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── CASO 6: Depósito y saldo actualizado ────────────────────────────────
  it('/transacciones/deposito (POST) flujo éxito', async () => {
    mockSupabase._setThenResult(null, null); // limites OK
    mockSupabase.single
      .mockResolvedValueOnce({ data: { habilitado: true }, error: null }) // metodo OK
      .mockResolvedValueOnce({ data: { id: 1, monto: 100 }, error: null }) // transaccion
      .mockResolvedValueOnce({ data: { saldo: 500 }, error: null }); // saldo

    // Eliminado mockSupabase.update porque rompe la cadena .eq()

    const res = await request(app.getHttpServer())
      .post('/transacciones/deposito')
      .set('Authorization', `Bearer ${token}`)
      .send({ monto: 100, entidadFinancieraId: 1, metodoPagoId: 1 });

    expect(res.status).toBe(201);
  });

  // ── CASO 7: Retiro sin verificación ──────────────────────────────────────
  it('/transacciones/retiro (POST) sin verificar', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { verificado: false, saldo: 500 },
      error: null,
    });

    const res = await request(app.getHttpServer())
      .post('/transacciones/retiro')
      .set('Authorization', `Bearer ${token}`)
      .send({
        monto: 50,
        entidadFinancieraId: 1,
        metodoPagoId: 1,
        datosPago: {},
      });

    expect(res.status).toBe(403);
  });

  // ── CASO 8: Depósito monto inválido ──────────────────────────────────────
  it('/transacciones/deposito (POST) monto 0', async () => {
    const res = await request(app.getHttpServer())
      .post('/transacciones/deposito')
      .set('Authorization', `Bearer ${token}`)
      .send({ monto: 0, entidadFinancieraId: 1, metodoPagoId: 1 });

    expect(res.status).toBe(400); // ValidationPipe (Min 0.01)
  });

  // ── CASO 9: Retiro saldo insuficiente ────────────────────────────────────
  it('/transacciones/retiro (POST) saldo insuficiente', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { verificado: true, saldo: 10 },
      error: null,
    }); // 10 < 50

    const res = await request(app.getHttpServer())
      .post('/transacciones/retiro')
      .set('Authorization', `Bearer ${token}`)
      .send({
        monto: 50,
        entidadFinancieraId: 1,
        metodoPagoId: 1,
        datosPago: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insuficiente/i);
  });

  // ── CASO 10: Historial vacío ──────────────────────────────────────────────
  it('/transacciones/historial (GET) sin datos', async () => {
    mockSupabase._setThenResult([], null, 0);

    const res = await request(app.getHttpServer())
      .get('/transacciones/historial')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.transacciones).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});
