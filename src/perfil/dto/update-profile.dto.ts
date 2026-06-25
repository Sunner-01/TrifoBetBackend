// src/perfil/dto/update-profile.dto.ts
import {
  IsOptional,
  IsString,
  IsEmail,
  IsDateString,
  Length,
  Matches,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(3, 50, { message: 'El nombre debe tener entre 3 y 50 caracteres' })
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, { message: 'El nombre solo puede contener letras' })
  nombre?: string;

  @IsOptional()
  @IsString()
  @Length(3, 50, { message: 'El apellido debe tener entre 3 y 50 caracteres' })
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, { message: 'El apellido solo puede contener letras' })
  apellido1?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/, { message: 'El segundo apellido solo puede contener letras' })
  apellido2?: string;

  @IsOptional()
  @IsString()
  @Length(5, 15, { message: 'El documento (CI) debe tener entre 5 y 15 dígitos' })
  @Matches(/^[0-9]+$/, { message: 'El documento (CI) solo debe contener números' })
  ci?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe tener un formato válido' })
  fechaNacimiento?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo debe tener un formato válido' })
  correo?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[67][0-9]{7}$/, { message: 'El teléfono debe empezar con 6 o 7 y tener exactamente 8 dígitos' })
  telefono?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  paisCodigo?: string;
}
