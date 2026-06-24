export interface ItemApuestaResponse {
  id: number;
  eventoId: number;
  eventoNombre: string;
  mercado: string;
  seleccion: string;
  seleccionDisplay: string;
  cuota: number;
  resultado: boolean | null; // true = ganó, false = perdió, null = pendiente
}

export interface ApuestaResponse {
  id: number;
  usuarioId: number;
  tipo: 'simple' | 'combinada';
  monto: number;
  cuotaTotal: number;
  gananciaPotencial: number;
  estado: 'pendiente' | 'ganada' | 'perdida' | 'cancelada';
  fechaCreacion: string;
  fechaProcesado: string | null;
  selecciones: ItemApuestaResponse[];
}

export interface HistorialApuestasResponse {
  apuestas: ApuestaResponse[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface EstadisticasApuestasResponse {
  totalApuestas: number;
  apuestasGanadas: number;
  apuestasPerdidas: number;
  apuestasPendientes: number;
  totalApostado: number;
  totalGanado: number;
  tasaExito: number; // Porcentaje de apuestas ganadas
  beneficioNeto: number; // Ganado - Apostado
}
