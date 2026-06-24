// src/auth/dto/register.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  nombre: string;

  @IsNotEmpty({ message: 'El primer apellido es obligatorio' })
  @IsString()
  apellido1: string;

  @IsOptional()
  @IsString()
  apellido2?: string;

  @IsNotEmpty({ message: 'El CI es obligatorio' })
  @IsString()
  ci: string;

  @IsNotEmpty({ message: 'La fecha de nacimiento es obligatoria' })
  @IsString()
  fechaNacimiento: string;

  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio' })
  @Length(4, 20)
  @IsString()
  nombreUsuario: string;

  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'Correo inválido' })
  correo: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @Length(6, 50)
  contrasena: string;

  // NUEVO: País seleccionado desde Flutter
  @IsOptional()
  @IsString()
  paisCodigo?: string; // Ej: 'BO', 'AR', 'PE'... Si no viene → 'BO' por defecto
}
