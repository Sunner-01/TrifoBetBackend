// src/auth/usuarios.service.ts
import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class UsuariosService {
  private supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  async checkUserExists(nombreUsuario: string, correo: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('usuario')
      .select('id')
      .or(`nombre_usuario.eq.${nombreUsuario},correo.eq.${correo}`)
      .single();

    return !!data;
  }

  async createUser(registerDto: RegisterDto, hashedPassword: string) {
    const { data: newUser, error } = await this.supabase
      .from('usuario')
      .insert({
        nombre_usuario: registerDto.nombreUsuario,
        correo: registerDto.correo,
        contrasena_hash: hashedPassword,
        nombre: registerDto.nombre,
        apellido1: registerDto.apellido1,
        apellido2: registerDto.apellido2,
        ci: registerDto.ci,
        fecha_nacimiento: registerDto.fechaNacimiento,
        telefono: registerDto.telefono,
        pais_codigo: registerDto.paisCodigo || 'BO',
        foto_perfil_url: this.configService.get<string>('DEFAULT_PROFILE_PHOTO_URL'),
      })
      .select()
      .single();

    if (error || !newUser) {
      throw new BadRequestException('Error al crear el usuario');
    }

    return newUser;
  }

  async findByIdentifier(identifier: string) {
    let { data: user, error } = await this.supabase
      .from('usuario')
      .select('*')
      .eq('nombre_usuario', identifier)
      .single();

    if (error || !user) {
      const result = await this.supabase
        .from('usuario')
        .select('*')
        .eq('correo', identifier)
        .single();
      
      user = result.data;
      error = result.error;
    }

    return { user, error };
  }

  async findById(id: number) {
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

  async findByUsername(nombreUsuario: string) {
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
