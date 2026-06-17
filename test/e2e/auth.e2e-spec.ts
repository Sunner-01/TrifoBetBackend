/**
 * test/e2e/auth.e2e-spec.ts
 *
 * PRUEBAS E2E — Auth
 * 5 casos de prueba completos simulando llamadas HTTP desde fuera.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';

import { AppModule } from '../../src/app.module';
import { createMockSupabaseClient } from '../helpers/supabase.mock';

jest.mock('@supabase/supabase-js');
jest.mock('bcrypt');

const mockUser = {
  id: 1,
  nombre_usuario: 'e2eUser',
  correo: 'e2e@trifobet.com',
  contrasena_hash: '$2b$10$hashed',
  verificado: true,
};

describe('AuthModule (e2e)', () => {
  let app: INestApplication;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeAll(async () => {
    mockSupabase = createMockSupabaseClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (bcrypt.hash as jest.Mock).mockResolvedValue('$hashed$');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // AppModule real completo
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  let validToken: string;

  // ── CASO 1: Registro → Login → /auth/me ─────────────────────────────────
  it('/auth/register (POST) y /auth/login (POST) flujo completo', async () => {
    // 1. Register (no existe, luego crea)
    mockSupabase.single
      .mockResolvedValueOnce({ data: null, error: { message: 'No rows' } })
      .mockResolvedValueOnce({ data: mockUser, error: null });

    const resRegister = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nombre: 'E2E',
        apellido1: 'User',
        ci: '12312312',
        fechaNacimiento: '2000-01-01',
        nombreUsuario: 'e2eUser',
        correo: 'e2e@trifobet.com',
        contrasena: 'password',
      });
    expect(resRegister.status).toBe(201);

    // 2. Login
    mockSupabase.single.mockResolvedValue({ data: mockUser, error: null });
    const resLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ nombreUsuario: 'e2eUser', contrasena: 'password' });
    
    expect(resLogin.status).toBe(200);
    validToken = resLogin.body.access_token;
    expect(validToken).toBeDefined();

    // 3. Obtener perfil
    const resMe = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${validToken}`);
    expect(resMe.status).toBe(200);
  });

  // ── CASO 2: Ruta protegida sin token ──────────────────────────────────────
  it('/auth/me (GET) debe retornar 401 si no hay token', async () => {
    const response = await request(app.getHttpServer()).get('/auth/me');
    expect(response.status).toBe(401);
  });

  // ── CASO 3: Login por correo ──────────────────────────────────────────────
  it('/auth/login (POST) con correo', async () => {
    mockSupabase.single.mockResolvedValue({ data: mockUser, error: null });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ correo: 'e2e@trifobet.com', contrasena: 'password' });
    expect(res.status).toBe(200);
  });

  // ── CASO 4: Login por nombreUsuario ───────────────────────────────────────
  it('/auth/login (POST) con nombreUsuario', async () => {
    mockSupabase.single.mockResolvedValue({ data: mockUser, error: null });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ nombreUsuario: 'e2eUser', contrasena: 'password' });
    expect(res.status).toBe(200);
  });

  // ── CASO 5: Token inválido ──────────────────────────────────────────────
  it('/auth/me (GET) debe retornar 401 si el token es inválido', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(response.status).toBe(401);
  });
});
