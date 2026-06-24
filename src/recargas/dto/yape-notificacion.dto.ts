// src/recargas/dto/yape-notificacion.dto.ts
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class YapeNotificacionDto {
  @IsNotEmpty()
  @IsString()
  textoRaw: string; // Texto completo de la notificación de Yape

  @IsOptional()
  @IsString()
  fechaHora?: string; // ISO string si la app puede capturarla

  @IsOptional()
  @IsString()
  title?: string; // Título original de la notificación

  @IsOptional()
  @IsString()
  content?: string; // Contenido original de la notificación

  @IsOptional()
  @IsString()
  packageName?: string; // Nombre del paquete de la app que generó la notificación
}
