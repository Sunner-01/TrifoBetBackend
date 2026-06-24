// src/transacciones/dto/retiro.dto.ts
import { IsNotEmpty, IsNumber, IsObject, Min } from 'class-validator';

export class RetiroDto {
  @IsNotEmpty({ message: 'El monto es obligatorio' })
  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  monto: number;

  @IsNotEmpty({ message: 'La entidad financiera es obligatoria' })
  @IsNumber()
  entidadFinancieraId: number;

  @IsNotEmpty({ message: 'El método de pago es obligatorio' })
  @IsNumber()
  metodoPagoId: number;

  @IsNotEmpty({ message: 'Los datos de pago son obligatorios' })
  @IsObject()
  datosPago: Record<string, any>; // Número de cuenta, nombre, etc.
}
