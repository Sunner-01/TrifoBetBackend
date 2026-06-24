// src/common/utils/pagination.util.ts

// Interface estandarizada para las respuestas paginadas del sistema.

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Utilidad para centralizar la lógica de paginación 

export class PaginationUtil {
  
// Calcula el offset necesario para las consultas SQL basándose en página y límite.
   
  static getOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

//Formatea la respuesta en un objeto estandarizado PaginatedResponse.
  
  static formatResponse<T>(
    data: T[],
    totalCount: number,
    page: number,
    limit: number,
  ): PaginatedResponse<T> {
    return {
      data: data || [],
      total: totalCount || 0,
      page,
      limit,
      totalPages: Math.ceil((totalCount || 0) / limit),
    };
  }
}
