/**
 * test/integration/apuestas.integration.spec.ts
 *
 * PRUEBAS DE INTEGRACIÓN — Apuestas Deportivas (HTTP con Supertest)
 * 5 casos: crear apuesta simple/múltiple, saldo insuficiente, historial, estadísticas.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createClient } from '@supabase/supabase-js';

import { ApuestasDeportivasModule } from '../../src/apuestas-deportivas/apuestas-deportivas.module';
import { AuthModule } from '../../src/auth/auth.module';
import { TipoApuesta } from '../../src/apuestas-deportivas/dto/crear-apuesta.dto';
import { createMockSupabaseClient } from '../helpers/supabase.mock';

jest.mock('@supabase/supabase-js');

const mockUser = {
  id: 1,
  nombre_usuario: 'apuestas_user',
  saldo: 1000,
};

const seleccionValida = {
  eventoId: 1,
  mercado: 'main.1X2',
  seleccion: '1',
  cuota: 2.0,
};

describe('Apuestas Deportivas — Pruebas de Integración', () => {
  let app: INestApplication;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let jwtService: JwtService;
  let authToken: string;

  beforeAll(async () => {
    mockSupabase = createMockSupabaseClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ApuestasDeportivasModule, AuthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    jwtService = moduleRef.get<JwtService>(JwtService);
    authToken = jwtService.sign({ sub: mockUser.id, username: mockUser.nombre_usuario });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  // ── CASO 11: POST /apuestas-deportivas — éxito (apuesta simple) ───────────
  it('POST /apuestas-deportivas debe crear una apuesta simple', async () => {
    // Validar evento
    mockSupabase._setThenResult([{ id: 1 }], null);
    // Saldo usuario
    mockSupabase.single
      .mockResolvedValueOnce({ data: mockUser, error: null }) // saldo
      // Insert apuesta
      .mockResolvedValueOnce({
        data: {
          id: 1,
          usuario_id: mockUser.id,
          tipo: TipoApuesta.SIMPLE,
          monto: 100,
          cuota_total: 2.0,
          ganancia_potencial: 200,
          estado: 'pendiente',
        },
        error: null,
      })
      // Select creada
      .mockResolvedValueOnce({
         data: {
          id: 1,
          usuario_id: mockUser.id,
          tipo: TipoApuesta.SIMPLE,
          monto: 100,
          cuota_total: 2.0,
          ganancia_potencial: 200,
          estado: 'pendiente',
         },
         error: null
      });

    // Mock para update saldo y selecciones (eliminado para no romper la cadena .select())

    const response = await request(app.getHttpServer())
      .post('/apuestas-deportivas/crear')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        tipo: TipoApuesta.SIMPLE,
        monto: 100,
        selecciones: [seleccionValida],
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('estado', 'pendiente');
  });

  // ── CASO 12: POST /apuestas-deportivas — error (múltiples selecciones en simple)
  it('POST /apuestas-deportivas debe rechazar apuesta simple con múltiples selecciones', async () => {
    const response = await request(app.getHttpServer())
      .post('/apuestas-deportivas/crear')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        tipo: TipoApuesta.SIMPLE,
        monto: 100,
        selecciones: [seleccionValida, { ...seleccionValida, eventoId: 2 }],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/una selección/i);
  });

  // ── CASO 13: POST /apuestas-deportivas — error (saldo insuficiente) ────────
  it('POST /apuestas-deportivas debe rechazar si el saldo es insuficiente', async () => {
    mockSupabase._setThenResult([{ id: 1 }], null);
    mockSupabase.single.mockResolvedValueOnce({ data: { saldo: 50 }, error: null });

    const response = await request(app.getHttpServer())
      .post('/apuestas-deportivas/crear')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        tipo: TipoApuesta.SIMPLE,
        monto: 100,
        selecciones: [seleccionValida],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/insuficiente/i);
  });

  // ── CASO 14: GET /apuestas-deportivas/historial — éxito ───────────────────
  it('GET /apuestas-deportivas/historial debe devolver el historial paginado', async () => {
    const apuestas = [
      { id: 1, usuario_id: mockUser.id, monto: 100, estado: 'ganada' },
      { id: 2, usuario_id: mockUser.id, monto: 50, estado: 'perdida' },
    ];
    mockSupabase._setThenResult(apuestas, null, 2);

    const response = await request(app.getHttpServer())
      .get('/apuestas-deportivas/historial')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('apuestas');
    expect(response.body).toHaveProperty('total', 2);
  });

  // ── CASO 15: GET /apuestas-deportivas/estadisticas — éxito ────────────────
  it('GET /apuestas-deportivas/estadisticas debe devolver métricas correctas', async () => {
    const apuestas = [
      { estado: 'ganada', monto: '100', ganancia_potencial: '200' },
    ];
    mockSupabase._setThenResult(apuestas, null);

    const response = await request(app.getHttpServer())
      .get('/apuestas-deportivas/estadisticas/resumen')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('totalApuestas', 1);
    expect(response.body).toHaveProperty('tasaExito', 100);
  });
});
