/**
 * test/integration/auth.integration.spec.ts
 *
 * PRUEBAS DE INTEGRACIÓN — Auth (HTTP con Supertest)
 * 5 casos: registro, login, rutas protegidas.
 * Usa el módulo AuthModule real con Supabase completamente mockeado.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';

import { AuthModule } from '../../src/auth/auth.module';
import { createMockSupabaseClient } from '../helpers/supabase.mock';

jest.mock('@supabase/supabase-js');
jest.mock('bcrypt');

// ── Usuario de prueba ──────────────────────────────────────────────────────
const mockUser = {
  id: 42,
  nombre_usuario: 'integrationUser',
  correo: 'integration@trifobet.com',
  contrasena_hash: '$2b$10$hashedpassword',
  nombre: 'Integration',
  apellido1: 'Test',
  apellido2: null,
  saldo: 500,
  verificado: true,
  pais_codigo: 'BO',
  telefono: null,
  foto_perfil_url: null,
  created_at: new Date().toISOString(),
};

describe('Auth — Pruebas de Integración', () => {
  let app: INestApplication;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let jwtService: JwtService;

  beforeAll(async () => {
    mockSupabase = createMockSupabaseClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (bcrypt.hash as jest.Mock).mockResolvedValue('$hashed$');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }),
    );
    await app.init();

    jwtService = moduleRef.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  // ── CASO 1: POST /auth/register — éxito ──────────────────────────────────
  it('POST /auth/register debe retornar 201 con token y datos del usuario', async () => {
    // No existe
    mockSupabase.single
      .mockResolvedValueOnce({ data: null, error: { message: 'No rows' } })
      .mockResolvedValueOnce({ data: mockUser, error: null });

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nombre: 'Integration',
        apellido1: 'Test',
        ci: '99999999',
        fechaNacimiento: '1995-06-15',
        nombreUsuario: 'integrationUser',
        correo: 'integration@trifobet.com',
        contrasena: 'password123',
        paisCodigo: 'BO',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty(
      'message',
      'Usuario registrado exitosamente',
    );
  });

  // ── CASO 2: POST /auth/register — campos requeridos faltantes ────────────
  it('POST /auth/register debe retornar 400 si faltan campos obligatorios', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        correo: 'test@test.com',
        // Faltan: nombre, apellido1, ci, fechaNacimiento, nombreUsuario, contrasena
      });

    expect(response.status).toBe(400);
  });

  // ── CASO 3: POST /auth/login — éxito ─────────────────────────────────────
  it('POST /auth/login debe retornar 200 con access_token en login exitoso', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ nombreUsuario: 'integrationUser', contrasena: 'password123' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('access_token');
    expect(response.body).toHaveProperty('usuario');
    expect(response.body.usuario).toHaveProperty(
      'nombre_usuario',
      mockUser.nombre_usuario,
    );
  });

  // ── CASO 4: POST /auth/login — credenciales inválidas ─────────────────────
  it('POST /auth/login debe retornar 401 si las credenciales son inválidas', async () => {
    mockSupabase.single
      .mockResolvedValueOnce({ data: null, error: { message: 'No rows' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'No rows' } });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ nombreUsuario: 'noexiste', contrasena: 'wrongpass' });

    expect(response.status).toBe(401);
  });

  // ── CASO 5: GET /auth/me — retorna perfil con token válido ───────────────
  it('GET /auth/me debe retornar 200 con datos del usuario cuando el token es válido', async () => {
    // El JWT guard valida el token y llama a la estrategia que busca el usuario
    mockSupabase.single.mockResolvedValue({ data: mockUser, error: null });

    const token = jwtService.sign({
      sub: mockUser.id,
      username: mockUser.nombre_usuario,
    });

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
  });
});
