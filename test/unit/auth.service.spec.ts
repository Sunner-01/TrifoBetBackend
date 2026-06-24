/**
 * test/unit/auth.service.spec.ts
 *
 * PRUEBAS UNITARIAS — AuthService
 * 6 casos de prueba que cubren: register, login y validateToken.
 * Supabase y bcrypt se mockean completamente; sin conexión de red.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';

import { AuthService } from '../../src/auth/auth.service';
import { RegisterDto } from '../../src/auth/dto/register.dto';
import { createMockSupabaseClient } from '../helpers/supabase.mock';

// ── Hoist mocks antes que cualquier import real ────────────────────────────
jest.mock('@supabase/supabase-js');
jest.mock('bcrypt');

// ── Datos de prueba reutilizables ──────────────────────────────────────────
const mockUser = {
  id: 1,
  nombre_usuario: 'testuser',
  correo: 'test@trifobet.com',
  contrasena_hash: '$2b$10$hashedpassword',
  nombre: 'Test',
  apellido1: 'User',
  apellido2: null,
  saldo: 100,
  verificado: true,
  pais_codigo: 'BO',
  created_at: '2024-01-01T00:00:00Z',
};

const registerDto: RegisterDto = {
  nombre: 'Test',
  apellido1: 'User',
  ci: '12345678',
  fechaNacimiento: '1990-01-01',
  nombreUsuario: 'testuser',
  correo: 'test@trifobet.com',
  contrasena: 'password123',
  paisCodigo: 'BO',
};

// ── Suite de pruebas ───────────────────────────────────────────────────────
describe('AuthService — Pruebas Unitarias', () => {
  let service: AuthService;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let mockJwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    // createClient devuelve nuestro mock controlado
    mockSupabase = createMockSupabaseClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock.jwt.token'),
      verify: jest.fn().mockReturnValue({ sub: 1, username: 'testuser' }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-value') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    // Reemplazamos supabase del servicio con nuestro mock controlado
    (service as any).supabase = mockSupabase;
  });

  afterEach(() => jest.clearAllMocks());

  // ── CASO 1: register — usuario ya existe ────────────────────────────────
  it('register() debe lanzar BadRequestException si el usuario ya existe', async () => {
    // El primer .single() devuelve un usuario existente
    mockSupabase.single.mockResolvedValue({ data: { id: 99 }, error: null });

    await expect(service.register(registerDto)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.register(registerDto)).rejects.toThrow(
      'El nombre de usuario o email ya está en uso',
    );
  });

  // ── CASO 2: register — éxito ─────────────────────────────────────────────
  it('register() debe crear usuario y retornar token JWT', async () => {
    // No existe → crea exitosamente
    mockSupabase.single
      .mockResolvedValueOnce({ data: null, error: { message: 'No rows' } })
      .mockResolvedValueOnce({ data: mockUser, error: null });

    (bcrypt.hash as jest.Mock).mockResolvedValueOnce('$hashed$');

    const result = await service.register(registerDto);

    expect(result).toHaveProperty('token', 'mock.jwt.token');
    expect(result).toHaveProperty('message', 'Usuario registrado exitosamente');
    expect(result.user).toMatchObject({
      nombreUsuario: mockUser.nombre_usuario,
      correo: mockUser.correo,
    });
  });

  // ── CASO 3: login — usuario no encontrado ────────────────────────────────
  it('login() debe lanzar UnauthorizedException si el usuario no existe', async () => {
    // Ambas búsquedas (por username y correo) fallan
    mockSupabase.single
      .mockResolvedValueOnce({ data: null, error: { message: 'No rows' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'No rows' } });

    await expect(service.login('noexiste', 'pass123')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // ── CASO 4: login — contraseña incorrecta ────────────────────────────────
  it('login() debe lanzar UnauthorizedException si la contraseña es incorrecta', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    await expect(service.login('testuser', 'wrongpassword')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // ── CASO 5: login — éxito ────────────────────────────────────────────────
  it('login() debe retornar access_token y datos del usuario en login exitoso', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: mockUser, error: null });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

    const result = await service.login('testuser', 'password123');

    expect(result).toHaveProperty('access_token', 'mock.jwt.token');
    expect(result.usuario).toMatchObject({
      id_usuario: mockUser.id,
      nombre_usuario: mockUser.nombre_usuario,
      correo: mockUser.correo,
      saldo: mockUser.saldo,
    });
  });

  // ── CASO 6: validateToken — token inválido ──────────────────────────────
  it('validateToken() debe lanzar UnauthorizedException con un token inválido', async () => {
    (mockJwtService.verify as jest.Mock).mockImplementationOnce(() => {
      throw new Error('jwt malformed');
    });

    await expect(service.validateToken('token.invalido')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
