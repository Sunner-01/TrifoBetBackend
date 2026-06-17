import { IsNotEmpty, IsEnum, IsNumber, IsArray, ValidateNested, Min, Max, ArrayMinSize, ArrayMaxSize, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoApuesta {
    SIMPLE = 'simple',
    COMBINADA = 'combinada',
    SISTEMA = 'sistema',
}

export class SeleccionDto {
    @IsNotEmpty({ message: 'El ID del evento es obligatorio' })
    @IsNumber({}, { message: 'El ID del evento debe ser un número' })
    eventoId: number;

    @IsNotEmpty({ message: 'El mercado es obligatorio' })
    mercado: string; // Ej: "main.1X2", "goals.total.2.5"

    @IsNotEmpty({ message: 'La selección es obligatoria' })
    seleccion: string; // Ej: "1", "X", "2", "over", "under"

    @IsNotEmpty({ message: 'La cuota es obligatoria' })
    @IsNumber({}, { message: 'La cuota debe ser un número' })
    @Min(1.01, { message: 'La cuota debe ser mayor a 1.00' })
    @Max(500, { message: 'La cuota no puede superar 500' })
    cuota: number;

    @IsOptional()
    @IsString()
    @MaxLength(200, { message: 'El nombre del evento no puede superar los 200 caracteres' })
    eventoNombre?: string;

    @IsOptional()
    @IsString()
    @MaxLength(200, { message: 'La descripción no puede superar los 200 caracteres' })
    seleccionDisplay?: string;
}

export class CrearApuestaDto {
    @IsNotEmpty({ message: 'El tipo de apuesta es obligatorio' })
    @IsEnum(TipoApuesta, { message: 'El tipo debe ser "simple", "combinada" o "sistema"' })
    tipo: TipoApuesta;

    @IsNotEmpty({ message: 'El monto es obligatorio' })
    @IsNumber({}, { message: 'El monto debe ser un número' })
    @Min(2, { message: 'El monto mínimo es 2 BOB' })
    @Max(10000, { message: 'El monto máximo por apuesta es 10,000 BOB' })
    monto: number;

    @IsArray({ message: 'Las selecciones deben ser un arreglo' })
    @ArrayMinSize(1, { message: 'Debe incluir al menos una selección' })
    @ArrayMaxSize(20, { message: 'El cupón no puede tener más de 20 selecciones' })
    @ValidateNested({ each: true })
    @Type(() => SeleccionDto)
    selecciones: SeleccionDto[];
}
