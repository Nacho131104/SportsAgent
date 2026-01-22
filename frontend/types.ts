
export type ContenidoWikipedia = {
  Texto: string;
  error?: string;
};

export type ResultadoWikipedia = {
  [entidad: string]: ContenidoWikipedia;
};

export type ElementoResultado = {
  title: string;
  url: string;
  content: string;
  snippet: string;
};

export type ResultadoBusqueda = {
  status: string; 
  data: {
    query: string;
    answer?: string;
    result?: ElementoResultado;
    results?: ElementoResultado[]; // Soportar múltiples resultados en array
  };
};

export type Fuente = {
  tipo: 'noticias' | 'wiki';
  titulo?: string;
  contenido: string;
  enlace?: string;
};

export type Mensaje = {
  id: string;
  rol: 'usuario' | 'asistente';
  contenido: string;
  fuentes?: Fuente[];
};

export type SesionChat = {
  id: string;
  titulo: string;
  mensajes: Mensaje[];
  registros: EntradaRegistroPensamiento[];
  fechaActualizacion: number;
};

export enum EstadoAgente {
  INACTIVO = 'idle',
  PENSANDO = 'thinking',
  OBTENIENDO_DATOS = 'fetching_data',
  SINTETIZANDO = 'synthesizing',
  ERROR = 'error'
}

export type EntradaRegistroPensamiento = {
  id: string;
  timestamp: string;
  modulo: 'ORQUESTADOR' | 'BACKEND' | 'SINTETIZADOR';
  mensaje: string;
  estado: 'info' | 'exito' | 'advertencia' | 'error';
};

export type ResultadoOrquestacion = {
  esDeporte: boolean;
  puntoFinal: 'wikipedia' | 'busqueda' | 'ninguno';
  consultaOptimizada: string;
  razonamiento: string;
};