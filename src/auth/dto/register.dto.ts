// src/auth/dto/register.dto.ts
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { IsAdult } from '../../common/validators/is-adult.validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @IsString()
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, { message: 'El nombre solo puede contener letras' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  nombre: string;

  @IsNotEmpty({ message: 'El primer apellido es obligatorio' })
  @IsString()
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, { message: 'El apellido solo puede contener letras' })
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres' })
  apellido1: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/, { message: 'El apellido solo puede contener letras' })
  apellido2?: string;

  @IsNotEmpty({ message: 'El CI es obligatorio' })
  @IsString()
  @Matches(/^[0-9]+$/, { message: 'El CI solo puede contener números, sin letras ni espacios' })
  @MinLength(5, { message: 'El CI es muy corto' })
  ci: string;

  @IsNotEmpty({ message: 'La fecha de nacimiento es obligatoria' })
  @IsString()
  @IsAdult()
  fechaNacimiento: string;

  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio' })
  @Length(4, 20, { message: 'El usuario debe tener entre 4 y 20 caracteres' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+$/, { message: 'El usuario solo puede contener letras, números, puntos o guiones' })
  nombreUsuario: string;

  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'Correo inválido' })
  correo: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+591[67][0-9]{7}$/, { message: 'El teléfono debe empezar con 6 o 7 y tener 8 dígitos' })
  telefono?: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @Length(6, 50, { message: 'La contraseña debe tener entre 6 y 50 caracteres' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, { message: 'La contraseña debe tener al menos 1 mayúscula, 1 minúscula y 1 número' })
  contrasena: string;

  // NUEVO: País seleccionado desde Flutter
  @IsOptional()
  @IsString()
  paisCodigo?: string; // Ej: 'BO', 'AR', 'PE'... Si no viene → 'BO' por defecto
}
