// src/transacciones/dto/deposito.dto.ts
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsObject,
  Min,
} from 'class-validator';

export class DepositoDto {
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

  @IsOptional()
  @IsString()
  numeroOperacion?: string;

  @IsOptional()
  @IsObject()
  datosPago?: Record<string, any>;
}
