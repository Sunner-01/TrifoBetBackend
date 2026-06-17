// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
    private supabase;

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {
        this.supabase = createClient(
            this.configService.get<string>('SUPABASE_URL')!,
            this.configService.get<string>('SUPABASE_ANON_KEY')!,
        );
    }

    /**
     * Registra un nuevo usuario en el sistema
     */
    async register(registerDto: RegisterDto) {
        const { nombreUsuario, correo, contrasena, nombre, apellido1, apellido2, ci, fechaNacimiento, telefono, paisCodigo } = registerDto;

        // Verificar si el usuario ya existe
        const { data: existingUser } = await this.supabase
            .from('usuario')
            .select('id')
            .or(`nombre_usuario.eq.${nombreUsuario},correo.eq.${correo}`)
            .single();

        if (existingUser) {
            throw new BadRequestException('El nombre de usuario o email ya está en uso');
        }

        // Encriptar la contraseña
        const hashedPassword = await bcrypt.hash(contrasena, 10);

        // Crear nuevo usuario en Supabase
        const { data: newUser, error } = await this.supabase
            .from('usuario')
            .insert({
                nombre_usuario: nombreUsuario,
                correo,
                contrasena_hash: hashedPassword,
                nombre,
                apellido1,
                apellido2,
                ci,
                fecha_nacimiento: fechaNacimiento,
                telefono,
                pais_codigo: paisCodigo || 'BO',
                foto_perfil_url: this.configService.get<string>('DEFAULT_PROFILE_PHOTO_URL'),
            })
            .select()
            .single();

        if (error || !newUser) {
            throw new BadRequestException('Error al crear el usuario');
        }

        // Generar token JWT
        const payload = { sub: newUser.id, nombreUsuario: newUser.nombre_usuario };
        const token = this.jwtService.sign(payload);

        return {
            message: 'Usuario registrado exitosamente',
            token,
            user: {
                id: newUser.id,
                nombreUsuario: newUser.nombre_usuario,
                correo: newUser.correo,
                nombre: newUser.nombre,
                apellido1: newUser.apellido1,
                apellido2: newUser.apellido2,
            },
        };
    }

    /**
     * Inicia sesión de un usuario
     * Acepta correo o nombreUsuario como identificador
     */
    async login(identifier: string, contrasena: string) {
        // DEBUG: Ver qué recibimos
        console.log('\n=== LOGIN REQUEST ===');
        console.log('Identifier recibido:', identifier);
        console.log('Contraseña recibida:', contrasena);
        console.log('Tipo de identifier:', typeof identifier);
        console.log('Tipo de contraseña:', typeof contrasena);
        console.log('Longitud de contraseña:', contrasena?.length);

        // Buscar usuario por nombreUsuario o correo
        // Intentar primero por nombre_usuario
        let { data: user, error } = await this.supabase
            .from('usuario')
            .select('*')
            .eq('nombre_usuario', identifier)
            .single();

        // Si no se encuentra, intentar por correo
        if (error || !user) {
            console.log('No encontrado por nombre_usuario, intentando por correo...');
            const result = await this.supabase
                .from('usuario')
                .select('*')
                .eq('correo', identifier)
                .single();

            user = result.data;
            error = result.error;
        }

        if (error || !user) {
            console.log('❌ Usuario NO encontrado. Error:', error?.message);
            throw new UnauthorizedException('Credenciales inválidas');
        }

        console.log('✅ Usuario encontrado:', user.nombre_usuario);
        console.log('Hash almacenado (primeros 20):', user.contrasena_hash?.substring(0, 20));

        // Verificar si la cuenta está suspendida
        if (user.habilitado === false) {
            console.log('❌ Intento de login de usuario suspendido:', user.nombre_usuario);
            throw new UnauthorizedException('Tu cuenta ha sido suspendida. Por favor, contacta a soporte.');
        }

        // Verificar contraseña
        const isPasswordValid = await bcrypt.compare(contrasena, user.contrasena_hash);

        console.log('Resultado de bcrypt.compare:', isPasswordValid);

        if (!isPasswordValid) {
            console.log('❌ Contraseña incorrecta');
            throw new UnauthorizedException('Credenciales inválidas');
        }

        console.log('✅ Login exitoso para:', user.nombre_usuario);

        // Generar token JWT
        const payload = { sub: user.id, username: user.nombre_usuario };
        const access_token = this.jwtService.sign(payload);

        // IMPORTANTE: Estructura EXACTA según INFORME_LOGIN_BACKEND.md
        const response = {
            access_token,
            usuario: {
                id_usuario: user.id,
                nombre: user.nombre || user.nombre_usuario,
                apellido1: user.apellido1 || '',
                apellido2: user.apellido2 || '',
                ci: user.ci || '',
                fecha_nacimiento: user.fecha_nacimiento || '',
                nombre_usuario: user.nombre_usuario,
                correo: user.correo,
                telefono: user.telefono || '',
                saldo: Number(user.saldo) || 0.00,
                pais_codigo: user.pais_codigo || user.pais || 'BO',
                foto_perfil_url: user.foto_perfil_url || null,
                verificado: user.verificado || false,
                rol_id: user.rol_id || 2, // 2 es el rol por defecto (jugador)
                fecha_registro: user.created_at || new Date().toISOString(),
            },
        };

        console.log('\n=== RESPUESTA ===');
        console.log(JSON.stringify(response, null, 2));

        return response;
    }

    /**
     * Valida un token JWT y devuelve el usuario
     */
    async validateToken(token: string) {
        try {
            const payload = this.jwtService.verify(token);
            const { data: user, error } = await this.supabase
                .from('usuario')
                .select('*')
                .eq('id', payload.sub)
                .single();

            if (error || !user) {
                throw new UnauthorizedException('Usuario no encontrado');
            }

            return user;
        } catch (error) {
            throw new UnauthorizedException('Token inválido');
        }
    }

    /**
     * Obtiene un usuario por ID
     */
    async getUserById(id: number) {
        const { data: user, error } = await this.supabase
            .from('usuario')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !user) {
            throw new UnauthorizedException('Usuario no encontrado');
        }

        return user;
    }

    /**
     * Obtiene un usuario por nombreUsuario
     */
    async getUserByUsername(nombreUsuario: string) {
        const { data: user, error } = await this.supabase
            .from('usuario')
            .select('*')
            .eq('nombre_usuario', nombreUsuario)
            .single();

        if (error || !user) {
            throw new UnauthorizedException('Usuario no encontrado');
        }

        return user;
    }
}
