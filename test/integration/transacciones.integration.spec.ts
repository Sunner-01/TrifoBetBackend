/**
 * test/integration/transacciones.integration.spec.ts
 *
 * PRUEBAS DE INTEGRACIÓN — Transacciones (HTTP con Supertest)
 * 5 casos: depósito, retiro, historial, métodos de pago.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createClient } from '@supabase/supabase-js';

import { TransaccionesModule } from '../../src/transacciones/transacciones.module';
import { AuthModule } from '../../src/auth/auth.module';
import { createMockSupabaseClient } from '../helpers/supabase.mock';

jest.mock('@supabase/supabase-js');

// ── Datos de prueba ────────────────────────────────────────────────────────
const mockUser = {
  id: 1,
  nombre_usuario: 'testuser',
  saldo: 1000,
  verificado: true,
};

const depositoPayload = {
  monto: 100,
  entidadFinancieraId: 1,
  metodoPagoId: 1,
  datosPago: {},
};

const retiroPayload = {
  monto: 50,
  entidadFinancieraId: 1,
  metodoPagoId: 1,
  datosPago: { cuenta: '1234567890', titular: 'Test' },
};

describe('Transacciones — Pruebas de Integración', () => {
  let app: INestApplication;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let jwtService: JwtService;
  let authToken: string;

  beforeAll(async () => {
    mockSupabase = createMockSupabaseClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [TransaccionesModule, AuthModule],
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

  // ── CASO 6: POST /transacciones/deposito — éxito ──────────────────────────
  it('POST /transacciones/deposito debe retornar 201 con transacción creada', async () => {
    const mockTransaccion = {
      id: 1,
      usuario_id: 1,
      tipo: 'deposito',
      monto: 100,
      estado: 'aprobado',
      numero_operacion: null,
      datos_pago: {},
      fecha_creacion: new Date().toISOString(),
      fecha_procesado: new Date().toISOString(),
    };

    // validarLimitesDeposito → config null (usa defaults: min=10, max=5000)
    mockSupabase._setThenResult(null, null);
    // validarMetodoPago → método válido
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 1, habilitado: true }, error: null })
      // insert transacción
      .mockResolvedValueOnce({ data: mockTransaccion, error: null })
      // obtener saldo usuario
      .mockResolvedValueOnce({ data: { saldo: 1000 }, error: null });

    const response = await request(app.getHttpServer())
      .post('/transacciones/deposito')
      .set('Authorization', `Bearer ${authToken}`)
      .send(depositoPayload);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('mensaje');
    expect(response.body).toHaveProperty('transaccion');
  });

  // ── CASO 7: POST /transacciones/deposito — monto fuera de rango ──────────
  it('POST /transacciones/deposito debe retornar 400 si monto < mínimo', async () => {
    mockSupabase._setThenResult(null, null);

    const response = await request(app.getHttpServer())
      .post('/transacciones/deposito')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ...depositoPayload, monto: 2 }); // monto < 10 (mínimo)

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/mínimo/i);
  });

  // ── CASO 8: POST /transacciones/retiro — usuario no verificado ────────────
  it('POST /transacciones/retiro debe retornar 403 si usuario no verificado', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { verificado: false, saldo: 500 },
      error: null,
    });

    const response = await request(app.getHttpServer())
      .post('/transacciones/retiro')
      .set('Authorization', `Bearer ${authToken}`)
      .send(retiroPayload);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/verificar/i);
  });

  // ── CASO 9: GET /transacciones/historial — lista paginada ────────────────
  it('GET /transacciones/historial debe retornar estructura paginada', async () => {
    const mockTransacciones = [
      { id: 1, tipo: 'deposito', monto: 100, estado: 'aprobado', fecha_creacion: new Date().toISOString() },
      { id: 2, tipo: 'retiro', monto: 50, estado: 'aprobado', fecha_creacion: new Date().toISOString() },
    ];

    mockSupabase._setThenResult(mockTransacciones, null, 2);

    const response = await request(app.getHttpServer())
      .get('/transacciones/historial')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('transacciones');
    expect(response.body).toHaveProperty('pagina', 1);
    expect(response.body).toHaveProperty('porPagina');
  });

  // ── CASO 10: GET /transacciones/metodos-pago — lista de métodos ──────────
  it('GET /transacciones/metodos-pago debe retornar array de métodos habilitados', async () => {
    const mockMetodos = [
      { id: 1, nombre: 'Transferencia Bancaria', tipo: 'transferencia', habilitado: true },
      { id: 2, nombre: 'QR Simple', tipo: 'qr', habilitado: true },
    ];

    mockSupabase._setThenResult(mockMetodos, null);

    const response = await request(app.getHttpServer())
      .get('/transacciones/metodos-pago')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
