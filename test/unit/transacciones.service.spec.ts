/**
 * test/unit/transacciones.service.spec.ts
 *
 * PRUEBAS UNITARIAS — TransaccionesService
 * 5 casos: validación de límites de depósito/retiro, método de pago inválido,
 * retiro sin verificación, retiro con saldo insuficiente.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

import { TransaccionesService } from '../../src/transacciones/transacciones.service';
import { DepositoDto } from '../../src/transacciones/dto/deposito.dto';
import { RetiroDto } from '../../src/transacciones/dto/retiro.dto';
import { createMockSupabaseClient } from '../helpers/supabase.mock';

jest.mock('@supabase/supabase-js');

// ── DTOs de prueba ─────────────────────────────────────────────────────────
const depositoValido: DepositoDto = {
  monto: 100,
  entidadFinancieraId: 1,
  metodoPagoId: 1,
  numeroOperacion: 'OP-001',
  datosPago: {},
};

const retiroValido: RetiroDto = {
  monto: 50,
  entidadFinancieraId: 1,
  metodoPagoId: 1,
  datosPago: { cuenta: '1234567890', titular: 'Test User' },
};

describe('TransaccionesService — Pruebas Unitarias', () => {
  let service: TransaccionesService;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(async () => {
    mockSupabase = createMockSupabaseClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransaccionesService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-value') },
        },
      ],
    }).compile();

    service = module.get<TransaccionesService>(TransaccionesService);
    (service as any).supabase = mockSupabase;
  });

  afterEach(() => jest.clearAllMocks());

  // ── CASO 13: depósito — monto menor al mínimo (default 10 BOB) ────────────
  it('crearDeposito() debe lanzar BadRequestException si monto < mínimo (10 BOB)', async () => {
    // Sin config en BD → defaults: min=10, max=5000
    mockSupabase._setThenResult(null, null);

    await expect(
      service.crearDeposito(1, { ...depositoValido, monto: 5 }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.crearDeposito(1, { ...depositoValido, monto: 5 }),
    ).rejects.toThrow('mínimo de depósito');
  });

  // ── CASO 14: depósito — monto mayor al máximo (default 5000 BOB) ──────────
  it('crearDeposito() debe lanzar BadRequestException si monto > máximo (5000 BOB)', async () => {
    mockSupabase._setThenResult(null, null);

    await expect(
      service.crearDeposito(1, { ...depositoValido, monto: 9999 }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.crearDeposito(1, { ...depositoValido, monto: 9999 }),
    ).rejects.toThrow('máximo de depósito');
  });

  // ── CASO 15: depósito — método de pago inválido ───────────────────────────
  it('crearDeposito() debe lanzar BadRequestException si método de pago es inválido', async () => {
    // validarLimitesDeposito: config = null → defaults OK para monto=100
    mockSupabase._setThenResult(null, null);
    // validarMetodoPago: single devuelve error (método no válido)
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'No rows returned' },
    });

    await expect(service.crearDeposito(1, depositoValido)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.crearDeposito(1, depositoValido)).rejects.toThrow(
      'Método de pago no válido',
    );
  });

  // ── CASO 16: retiro — usuario no verificado ───────────────────────────────
  it('crearRetiro() debe lanzar ForbiddenException si el usuario no está verificado', async () => {
    mockSupabase.single.mockResolvedValue({
      data: { verificado: false, saldo: 200 },
      error: null,
    });

    await expect(service.crearRetiro(1, retiroValido)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.crearRetiro(1, retiroValido)).rejects.toThrow(
      'verificar tu cuenta',
    );
  });

  // ── CASO 17: retiro — saldo insuficiente ──────────────────────────────────
  it('crearRetiro() debe lanzar BadRequestException si saldo insuficiente', async () => {
    mockSupabase.single.mockResolvedValue({
      data: { verificado: true, saldo: 10 }, // saldo 10 < monto 50
      error: null,
    });

    await expect(service.crearRetiro(1, retiroValido)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.crearRetiro(1, retiroValido)).rejects.toThrow(
      'Saldo insuficiente',
    );
  });
});
