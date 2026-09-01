import fs from "node:fs";
import path from "node:path";
import { DIR_MEMORIA, asegurarCarpetas } from "./raiz";

export const RUTA_MEMORIA = path.join(DIR_MEMORIA, "MEMORIA.md");

const ENCABEZADO = `# Memoria del asistente

Lo que la app aprende de tus clases y de ti. El chat lo lee para dar respuestas con contexto.
`;

export function leerMemoria(): string {
  asegurarCarpetas();
  try {
    return fs.readFileSync(RUTA_MEMORIA, "utf8");
  } catch {
    fs.writeFileSync(RUTA_MEMORIA, ENCABEZADO);
    return ENCABEZADO;
  }
}

export function guardarMemoria(contenido: string): void {
  asegurarCarpetas();
  fs.mkdirSync(DIR_MEMORIA, { recursive: true });
  fs.writeFileSync(RUTA_MEMORIA, contenido);
}

/** Anota automático al terminar un análisis. No lanza errores si falla. */
export function anotarMemoria(linea: string): void {
  try {
    const actual = leerMemoria();
    if (!actual.includes(linea)) {
      guardarMemoria(actual.trimEnd() + "\n\n- " + linea + "\n");
    }
  } catch {
    // la memoria es opcional; nunca debe tumbar el pipeline
  }
}
