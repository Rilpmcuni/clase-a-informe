/** Tipos compartidos entre el motor (JSON) y la interfaz. */

export interface Segmento {
  inicio: number;
  fin: number;
  texto: string;
}

export interface FrameUnico {
  archivo: string;
  tiempo: number;
  veces: number;
  tiempos: number[];
}

export interface DescripcionFrame {
  archivo: string;
  tipo?: string;
  titulo?: string;
  texto_visible?: string;
  bullets?: string[];
  formulas?: string[];
  diagrama?: string;
  relevancia?: string;
  error?: string;
}

export interface Concepto {
  termino: string;
  definicion: string;
}

export interface PreguntaRespuesta {
  pregunta: string;
  respuesta: string;
}

export interface TemaInforme {
  tema: string;
  duracion?: string;
  resumen: string;
  conceptos?: Concepto[];
  preguntas?: PreguntaRespuesta[];
  datos_curiosos?: string[];
  frames?: string[];
}

export interface Informe {
  titulo: string;
  materia?: string | null;
  profesor?: string | null;
  resumen_ejecutivo: string;
  temas: TemaInforme[];
  examen?: PreguntaRespuesta[];
  glosario?: Concepto[];
}

export interface MetaAnalisis {
  video: string;
  creado: string;
  duracion?: number;
  ancho?: number;
  alto?: number;
}

export interface ResumenAnalisis {
  id: string;
  titulo: string;
  creado: string;
  duracion?: number;
  nTemas: number;
  nSegmentos: number;
  nDiapositivas: number;
  tieneInforme: boolean;
  tienePdf: boolean;
  estado: "corriendo" | "listo" | "incompleto" | "error";
  /** archivo de frame elegido como carátula de la tarjeta (null si aún no hay) */
  portada?: string | null;
  /** clasificación de la clase hecha por la IA */
  materia?: string | null;
  profesor?: string | null;
}
