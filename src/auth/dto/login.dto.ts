// src/auth/dto/login.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  nombreUsuario?: string;

  @IsOptional()
  @IsString()
  correo?: string;

  @IsString()
  contrasena: string;
}
