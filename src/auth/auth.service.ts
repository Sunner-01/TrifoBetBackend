// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { UsuariosService } from './usuarios.service';
import { PasswordService } from './password.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usuariosService: UsuariosService,
    private readonly passwordService: PasswordService,
  ) {}

  //Registra un nuevo usuario en el sistema.
  
  async register(registerDto: RegisterDto) {
    const userExists = await this.usuariosService.checkUserExists(
      registerDto.nombreUsuario,
      registerDto.correo,
      registerDto.ci,
      registerDto.telefono
    );

    if (userExists) {
      throw new BadRequestException('El nombre de usuario, email, carnet de identidad o teléfono ya están registrados en otra cuenta');
    }

    const hashedPassword = await this.passwordService.hashPassword(registerDto.contrasena);
    const newUser = await this.usuariosService.createUser(registerDto, hashedPassword);

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

   //Inicia sesión de un usuario.

  async login(identifier: string, contrasena: string) {
    this.logger.debug(`Intento de login para: ${identifier}`);

    const { user, error } = await this.usuariosService.findByIdentifier(identifier);

    if (error || !user) {
      this.logger.warn(`Login fallido — identifier no encontrado: ${identifier}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.habilitado === false) {
      this.logger.warn(`Intento de login de usuario suspendido: ${user.nombre_usuario}`);
      throw new UnauthorizedException('Tu cuenta ha sido suspendida. Por favor, contacta a soporte.');
    }

    const isPasswordValid = await this.passwordService.comparePassword(contrasena, user.contrasena_hash);

    if (!isPasswordValid) {
      this.logger.warn(`Contraseña incorrecta para: ${user.nombre_usuario}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    this.logger.log(`Login exitoso: ${user.nombre_usuario}`);

    const payload = { sub: user.id, username: user.nombre_usuario };
    const access_token = this.jwtService.sign(payload);

    return {
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
        saldo: Number(user.saldo) || 0.0,
        pais_codigo: user.pais_codigo || user.pais || 'BO',
        foto_perfil_url: user.foto_perfil_url || null,
        verificado: user.verificado || false,
        rol_id: user.rol_id || 2,
        fecha_registro: user.created_at || new Date().toISOString(),
      },
    };
  }
   //Valida un token JWT y devuelve el usuario asociado.
  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return await this.usuariosService.findById(payload.sub);
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }

  async getUserById(id: number) {
    return this.usuariosService.findById(id);
  }

  async getUserByUsername(nombreUsuario: string) {
    return this.usuariosService.findByUsername(nombreUsuario);
  }
}
