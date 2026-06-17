// src/recargas/dto/crear-solicitud.dto.ts
import { IsNotEmpty, IsNumber, IsBoolean, Min } from 'class-validator';

export class CrearSolicitudDto {
  @IsNotEmpty({ message: 'El monto es obligatorio' })
  @IsNumber()
  @Min(1, { message: 'El monto mínimo de recarga es 1' })
  monto: number;

  @IsBoolean({ message: 'Debes confirmar que eres el titular de la cuenta' })
  @IsNotEmpty()
  aceptaTitular: boolean;
}
