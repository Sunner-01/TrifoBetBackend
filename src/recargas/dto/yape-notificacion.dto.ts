// src/recargas/dto/yape-notificacion.dto.ts
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class YapeNotificacionDto {
  @IsNotEmpty()
  @IsString()
  textoRaw: string; // Texto completo de la notificación de Yape

  @IsOptional()
  @IsString()
  fechaHora?: string; // ISO string si la app puede capturarla
}
