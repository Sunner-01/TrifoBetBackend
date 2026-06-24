/**
 * test/e2e/apuestas.e2e-spec.ts
 *
 * PRUEBAS E2E — Apuestas
 * 5 casos completos.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

import { AppModule } from '../../src/app.module';
import { createMockSupabaseClient } from '../helpers/supabase.mock';
import { TipoApuesta } from '../../src/apuestas-deportivas/dto/crear-apuesta.dto';

jest.mock('@supabase/supabase-js');
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('$hashed$'),
}));

describe('ApuestasModule (e2e)', () => {
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

  afterEach(() => jest.clearAllMocks());

  const seleccionBase = {
    eventoId: 1,
    mercado: '1X2',
    seleccion: '1',
    cuota: 1.5,
  };

  // ── CASO 11: Apuesta Simple ──────────────────────────────────────────────
  it('/apuestas-deportivas (POST) simple éxito', async () => {
    mockSupabase._setThenResult([{ id: 1 }], null); // evento
    mockSupabase.single
      .mockResolvedValueOnce({ data: { saldo: 500 }, error: null }) // saldo
      .mockResolvedValueOnce({ data: { id: 1, tipo: 'simple' }, error: null }) // insert apuesta
      .mockResolvedValueOnce({ data: { id: 1, tipo: 'simple' }, error: null }); // select apuesta

    // Eliminado mockSupabase.insert porque rompe la cadena .select()

    const res = await request(app.getHttpServer())
      .post('/apuestas-deportivas/crear')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo: TipoApuesta.SIMPLE,
        monto: 100,
        selecciones: [seleccionBase],
      });

    expect(res.status).toBe(201);
  });

  // ── CASO 12: Apuesta Múltiple ────────────────────────────────────────────
  it('/apuestas-deportivas (POST) combinada éxito', async () => {
    mockSupabase._setThenResult([{ id: 1 }, { id: 2 }], null);
    mockSupabase.single
      .mockResolvedValueOnce({ data: { saldo: 500 }, error: null })
      .mockResolvedValueOnce({
        data: { id: 2, tipo: 'combinada' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 2, tipo: 'combinada' },
        error: null,
      });

    const res = await request(app.getHttpServer())
      .post('/apuestas-deportivas/crear')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo: TipoApuesta.COMBINADA,
        monto: 50,
        selecciones: [
          seleccionBase,
          { ...seleccionBase, eventoId: 2, cuota: 2.0 },
        ],
      });

    expect(res.status).toBe(201);
  });

  // ── CASO 13: Apuesta DTO Inválido ─────────────────────────────────────────
  it('/apuestas-deportivas (POST) bad request por DTO', async () => {
    const res = await request(app.getHttpServer())
      .post('/apuestas-deportivas/crear')
      .set('Authorization', `Bearer ${token}`)
      .send({ tipo: 'Invalido', monto: -10, selecciones: [] });

    expect(res.status).toBe(400);
  });

  // ── CASO 14: Estadísticas — resumen ────────────────────────────────────────
  it('/apuestas-deportivas/estadisticas/resumen (GET) retorna estadísticas', async () => {
    mockSupabase._setThenResult(
      [{ estado: 'ganada', monto: '100', ganancia_potencial: '200' }],
      null,
    );

    const res = await request(app.getHttpServer())
      .get('/apuestas-deportivas/estadisticas/resumen')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalApuestas');
    expect(res.body).toHaveProperty('tasaExito');
  });

  // ── CASO 15: Historial y paginación ───────────────────────────────────────
  it('/apuestas-deportivas/historial (GET) con paginacion', async () => {
    mockSupabase._setThenResult([{ id: 1, estado: 'ganada' }], null, 1);

    const res = await request(app.getHttpServer())
      .get('/apuestas-deportivas/historial?offset=0&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.apuestas).toHaveLength(1);
    expect(res.body.pagina).toBe(1);
    expect(res.body.porPagina).toBe(10);
  });
});
