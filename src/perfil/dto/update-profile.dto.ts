// src/perfil/dto/update-profile.dto.ts
import {
  IsOptional,
  IsString,
  IsEmail,
  IsDateString,
  Length,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  apellido1?: string;

  @IsOptional()
  @IsString()
  apellido2?: string;

  @IsOptional()
  @IsString()
  ci?: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsEmail()
  correo?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  paisCodigo?: string;
}
