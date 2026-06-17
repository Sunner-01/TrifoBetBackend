// src/transacciones/transacciones.service.ts
import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DepositoDto } from './dto/deposito.dto';
import { RetiroDto } from './dto/retiro.dto';

@Injectable()
export class TransaccionesService {
    private supabase: SupabaseClient;
    private readonly logger = new Logger(TransaccionesService.name);

    constructor(private configService: ConfigService) {
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
        const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY')!;
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    // ==================== CREAR DEPÓSITO ====================
    async crearDeposito(userId: number, dto: DepositoDto) {
        // Validar límites de depósito
        await this.validarLimitesDeposito(dto.monto);

        // Validar que el método de pago pertenece a la entidad financiera
        await this.validarMetodoPago(dto.metodoPagoId, dto.entidadFinancieraId);

        // Crear la transacción con estado 'aprobado' automáticamente
        const { data, error } = await this.supabase
            .from('transaccion')
            .insert({
                usuario_id: userId,
                tipo: 'deposito',
                monto: dto.monto,
                entidad_financiera_id: dto.entidadFinancieraId,
                metodo_pago_id: dto.metodoPagoId,
                numero_operacion: dto.numeroOperacion || null,
                datos_pago: dto.datosPago || {},
                estado: 'aprobado',
                fecha_creacion: new Date().toISOString(),
                fecha_procesado: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            this.logger.error(`Error al crear depósito: ${error.message}`);
            throw new BadRequestException('Error al procesar el depósito');
        }

        // Actualizar el saldo del usuario sumando el monto del depósito
        const { data: usuarioData, error: fetchError } = await this.supabase
            .from('usuario')
            .select('saldo')
            .eq('id', userId)
            .single();

        if (fetchError || !usuarioData) {
            this.logger.error(`Error al obtener saldo del usuario: ${fetchError?.message}`);
            throw new BadRequestException('Error al obtener información del usuario');
        }

        const nuevoSaldo = parseFloat(usuarioData.saldo) + dto.monto;

        const { error: updateError } = await this.supabase
            .from('usuario')
            .update({ saldo: nuevoSaldo })
            .eq('id', userId);

        if (updateError) {
            this.logger.error(`Error al actualizar saldo: ${updateError.message}`);
            throw new BadRequestException('Error al actualizar el saldo');
        }

        this.logger.log(`Depósito aprobado automáticamente: ID ${data.id} - Usuario ${userId} - Monto ${dto.monto}`);

        return {
            mensaje: 'Depósito procesado exitosamente. Tu saldo ha sido actualizado.',
            transaccion: this.formatearTransaccion(data),
        };
    }

    // ==================== CREAR RETIRO ====================
    async crearRetiro(userId: number, dto: RetiroDto) {
        // 1. Verificar que el usuario está verificado
        const { data: usuario } = await this.supabase
            .from('usuario')
            .select('verificado, saldo')
            .eq('id', userId)
            .single();

        if (!usuario) {
            throw new NotFoundException('Usuario no encontrado');
        }

        if (!usuario.verificado) {
            throw new ForbiddenException(
                'Debes verificar tu cuenta para realizar retiros. Por favor, completa el proceso de verificación.'
            );
        }

        // 2. Validar límites de retiro
        await this.validarLimitesRetiro(dto.monto);

        // 3. Verificar saldo suficiente
        if (usuario.saldo < dto.monto) {
            throw new BadRequestException(
                `Saldo insuficiente. Saldo disponible: ${usuario.saldo.toFixed(2)} BOB`
            );
        }

        // 4. Validar método de pago
        await this.validarMetodoPago(dto.metodoPagoId, dto.entidadFinancieraId);

        // 5. Crear la transacción de retiro con estado 'aprobado' automáticamente
        const { data, error } = await this.supabase
            .from('transaccion')
            .insert({
                usuario_id: userId,
                tipo: 'retiro',
                monto: dto.monto,
                entidad_financiera_id: dto.entidadFinancieraId,
                metodo_pago_id: dto.metodoPagoId,
                datos_pago: dto.datosPago,
                estado: 'aprobado',
                fecha_creacion: new Date().toISOString(),
                fecha_procesado: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            this.logger.error(`Error al crear retiro: ${error.message}`);
            throw new BadRequestException('Error al procesar el retiro');
        }

        // 6. Descontar el monto del saldo del usuario
        const nuevoSaldo = parseFloat(usuario.saldo) - dto.monto;

        const { error: updateError } = await this.supabase
            .from('usuario')
            .update({ saldo: nuevoSaldo })
            .eq('id', userId);

        if (updateError) {
            this.logger.error(`Error al actualizar saldo: ${updateError.message}`);
            throw new BadRequestException('Error al actualizar el saldo');
        }

        this.logger.log(`Retiro aprobado automáticamente: ID ${data.id} - Usuario ${userId} - Monto ${dto.monto}`);

        return {
            mensaje: 'Retiro procesado exitosamente. Tu saldo ha sido actualizado.',
            transaccion: this.formatearTransaccion(data),
        };
    }

    // ==================== OBTENER HISTORIAL ====================
    async obtenerHistorial(userId: number, tipo?: string, estado?: string, limit = 20, offset = 0) {
        let query = this.supabase
            .from('transaccion')
            .select(`
        *,
        entidad_financiera:entidad_financiera_id(nombre, tipo, codigo),
        metodo_pago:metodo_pago_id(nombre, tipo)
      `)
            .eq('usuario_id', userId)
            .order('fecha_creacion', { ascending: false })
            .range(offset, offset + limit - 1);

        if (tipo) {
            query = query.eq('tipo', tipo);
        }

        if (estado) {
            query = query.eq('estado', estado);
        }

        const { data, error, count } = await query;

        if (error) {
            this.logger.error(`Error al obtener historial: ${error.message}`);
            throw new BadRequestException('Error al obtener historial');
        }

        return {
            transacciones: data?.map(t => this.formatearTransaccion(t)) || [],
            total: count || data?.length || 0,
            pagina: Math.floor(offset / limit) + 1,
            porPagina: limit,
        };
    }

    // ==================== OBTENER MÉTODOS DE PAGO ====================
    async obtenerMetodosPago() {
        const { data, error } = await this.supabase
            .from('metodo_pago')
            .select(`
        *,
        entidad_financiera:entidad_financiera_id!inner(*)
      `)
            .eq('habilitado', true)
            .eq('entidad_financiera.habilitado', true);

        if (error) {
            this.logger.error(`Error al obtener métodos de pago: ${error.message}`);
            throw new BadRequestException('Error al obtener métodos de pago');
        }

        return data || [];
    }

    // ==================== HISTORIAL ADMINISTRATIVO ====================
    async obtenerHistorialAdmin(tipo?: string, estado?: string, searchTerm?: string, limit = 50, offset = 0) {
        let query = this.supabase
            .from('transaccion')
            .select(`
                *,
                usuario:usuario_id(nombre, apellido1, correo, nombre_usuario),
                entidad_financiera:entidad_financiera_id(nombre, tipo, codigo),
                metodo_pago:metodo_pago_id(nombre, tipo),
                cuenta_retiro:cuenta_retiro_id(*)
            `, { count: 'exact' })
            .order('fecha_creacion', { ascending: false })
            .range(offset, offset + limit - 1);

        if (tipo && tipo !== 'todos') {
            query = query.eq('tipo', tipo);
        }

        if (estado && estado !== 'todos') {
            query = query.eq('estado', estado);
        }

        // Si hay busqueda (searchTerm), no lo aplicamos en count directo por limitaciones de supabase sin RPC,
        // pero podemos filtrar por ID si es numérico
        if (searchTerm) {
            const isNumber = !isNaN(Number(searchTerm));
            if (isNumber) {
                query = query.eq('id', Number(searchTerm));
            }
        }

        const { data, error, count } = await query;

        if (error) {
            this.logger.error(`Error al obtener historial admin: ${error.message}`);
            throw new BadRequestException('Error al obtener historial admin');
        }

        return {
            transacciones: data?.map(t => this.formatearTransaccion(t)) || [],
            total: count || 0,
            pagina: Math.floor(offset / limit) + 1,
            porPagina: limit,
        };
    }

    // ==================== OBTENER ENTIDADES FINANCIERAS ====================
    async obtenerEntidadesFinancieras(paisCodigo?: string) {
        let query = this.supabase
            .from('entidad_financiera')
            .select('*')
            .eq('habilitado', true)
            .order('nombre');

        if (paisCodigo) {
            query = query.eq('pais_codigo', paisCodigo);
        }

        const { data, error } = await query;

        if (error) {
            this.logger.error(`Error al obtener entidades financieras: ${error.message}`);
            throw new BadRequestException('Error al obtener entidades financieras');
        }

        return data || [];
    }

    // ==================== VALIDACIONES PRIVADAS ====================
    private async validarLimitesDeposito(monto: number) {
        const { data } = await this.supabase
            .from('config_transacciones')
            .select('clave, valor')
            .in('clave', ['deposito_minimo', 'deposito_maximo']);

        const config = data?.reduce((acc, item: any) => {
            acc[item.clave] = parseFloat(item.valor);
            return acc;
        }, {} as Record<string, number>) || {};

        const min = config.deposito_minimo || 10;
        const max = config.deposito_maximo || 5000;

        if (monto < min) {
            throw new BadRequestException(`El monto mínimo de depósito es ${min} BOB`);
        }

        if (monto > max) {
            throw new BadRequestException(`El monto máximo de depósito es ${max} BOB`);
        }
    }

    private async validarLimitesRetiro(monto: number) {
        const { data } = await this.supabase
            .from('config_transacciones')
            .select('clave, valor')
            .in('clave', ['retiro_minimo', 'retiro_maximo']);

        const config = data?.reduce((acc, item: any) => {
            acc[item.clave] = parseFloat(item.valor);
            return acc;
        }, {} as Record<string, number>) || {};

        const min = config.retiro_minimo || 20;
        const max = config.retiro_maximo || 2000;

        if (monto < min) {
            throw new BadRequestException(`El monto mínimo de retiro es ${min} BOB`);
        }

        if (monto > max) {
            throw new BadRequestException(`El monto máximo de retiro es ${max} BOB`);
        }
    }

    private async validarMetodoPago(metodoPagoId: number, entidadFinancieraId: number) {
        const { data, error } = await this.supabase
            .from('metodo_pago')
            .select('*')
            .eq('id', metodoPagoId)
            .eq('entidad_financiera_id', entidadFinancieraId)
            .eq('habilitado', true)
            .single();

        if (error || !data) {
            throw new BadRequestException('Método de pago no válido para esta entidad financiera');
        }
    }

    private formatearTransaccion(transaccion: any) {
        return {
            id: transaccion.id,
            tipo: transaccion.tipo,
            monto: parseFloat(transaccion.monto),
            estado: transaccion.estado,
            numeroOperacion: transaccion.numero_operacion,
            datosPago: transaccion.datos_pago,
            fechaCreacion: transaccion.fecha_creacion,
            fecha_creacion: transaccion.fecha_creacion, // para retrocompatibilidad
            fechaProcesado: transaccion.fecha_procesado,
            fecha_procesado: transaccion.fecha_procesado, // para retrocompatibilidad
            entidadFinanciera: transaccion.entidad_financiera,
            metodoPago: transaccion.metodo_pago,
            usuario: transaccion.usuario, // Agregar el usuario
            cuenta_retiro: transaccion.cuenta_retiro, // Agregar la cuenta de retiro si existe
            descripcion: transaccion.descripcion // Agregar descripcion
        };
    }
}
