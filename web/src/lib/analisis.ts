import fs from "node:fs";
import path from "node:path";
import { DIR_ANALISIS, DIR_VIDEOS, asegurarCarpetas, validarId } from "./raiz";
import { obtenerJob } from "./jobs";
import type {
  DescripcionFrame,
  FrameUnico,
  Informe,
  MetaAnalisis,
  ResumenAnalisis,
  Segmento,
} from "./tipos";

function leerJson<T>(ruta: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf8")) as T;
  } catch {
    return null;
  }
}

function carpetaAnalisis(id: string): string {
  if (!validarId(id)) throw new Error("id inválido");
  return path.join(DIR_ANALISIS, id);
}

export function existeAnalisis(id: string): boolean {
  return fs.existsSync(carpetaAnalisis(id));
}

export function rutaVideo(id: string): string | null {
  const meta = leerJson<MetaAnalisis>(path.join(carpetaAnalisis(id), "meta.json"));
  if (!meta) return null;
  const ruta = path.join(DIR_VIDEOS, meta.video);
  return fs.existsSync(ruta) ? ruta : null;
}

export function crearAnalisis(id: string, meta: MetaAnalisis): void {
  const carpeta = carpetaAnalisis(id);
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(path.join(carpeta, "meta.json"), JSON.stringify(meta, null, 2));
}

export function carpetaDe(id: string): string {
  return carpetaAnalisis(id);
}

export function listar(): ResumenAnalisis[] {
  asegurarCarpetas();
  const salida: ResumenAnalisis[] = [];
  for (const entrada of fs.readdirSync(DIR_ANALISIS, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue;
    const id = entrada.name;
    const carpeta = path.join(DIR_ANALISIS, id);
    const meta = leerJson<MetaAnalisis>(path.join(carpeta, "meta.json"));
    const informe = leerJson<Informe>(path.join(carpeta, "informe.json"));
    const transcripcion = leerJson<Segmento[]>(path.join(carpeta, "transcripcion.json"));
    const frames = leerJson<FrameUnico[]>(path.join(carpeta, "frames_unicos.json"));
    const descripciones = leerJson<DescripcionFrame[]>(path.join(carpeta, "descripciones.json"));
    const job = obtenerJob(id);
    const estado: ResumenAnalisis["estado"] = job
      ? job.estado === "listo"
        ? "listo"
        : job.estado === "error"
          ? "error"
          : "corriendo"
      : informe
        ? "listo"
        : "incompleto";
    // carátula: primera diapositiva de relevancia alta; si no hay, el primer frame
    const relevPor = new Map((descripciones ?? []).map((d) => [d.archivo, d.relevancia]));
    const framePortada =
      frames?.find((f) => relevPor.get(f.archivo) === "alta")?.archivo ??
      frames?.[0]?.archivo ??
      null;
    salida.push({
      id,
      titulo: informe?.titulo ?? meta?.video ?? id,
      creado: meta?.creado ?? new Date().toISOString(),
      duracion: meta?.duracion,
      nTemas: informe?.temas?.length ?? 0,
      nSegmentos: transcripcion?.length ?? 0,
      nDiapositivas: frames?.length ?? 0,
      tieneInforme: Boolean(informe),
      tienePdf: fs.existsSync(path.join(carpeta, "informe.pdf")),
      estado,
      portada: framePortada,
    });
  }
  return salida.sort((a, b) => b.creado.localeCompare(a.creado));
}

export interface DetalleAnalisis {
  id: string;
  meta: MetaAnalisis | null;
  informe: Informe | null;
  transcripcion: Segmento[];
  frames: FrameUnico[];
  descripciones: DescripcionFrame[];
}

export function detalle(id: string): DetalleAnalisis {
  const carpeta = carpetaAnalisis(id);
  return {
    id,
    meta: leerJson<MetaAnalisis>(path.join(carpeta, "meta.json")),
    informe: leerJson<Informe>(path.join(carpeta, "informe.json")),
    transcripcion: leerJson<Segmento[]>(path.join(carpeta, "transcripcion.json")) ?? [],
    frames: leerJson<FrameUnico[]>(path.join(carpeta, "frames_unicos.json")) ?? [],
    descripciones: leerJson<DescripcionFrame[]>(path.join(carpeta, "descripciones.json")) ?? [],
  };
}

export function borrarAnalisis(id: string, conVideo: boolean): void {
  const meta = leerJson<MetaAnalisis>(path.join(carpetaAnalisis(id), "meta.json"));
  fs.rmSync(carpetaAnalisis(id), { recursive: true, force: true });
  const jobJson = path.join(process.cwd(), "..", ".data", "jobs", id + ".json");
  fs.rmSync(jobJson, { force: true });
  if (conVideo && meta?.video) {
    fs.rmSync(path.join(DIR_VIDEOS, meta.video), { force: true });
  }
}

/** Contexto compacto del análisis para el chat. */
export function contextoParaChat(id: string, maxCaracteres = 9000): string {
  const d = detalle(id);
  if (!d.informe) return "";
  const partes: string[] = [
    `Título de la clase: ${d.informe.titulo}`,
    "",
    "Resumen ejecutivo: " + d.informe.resumen_ejecutivo,
    "",
    "Temas:",
  ];
  for (const t of d.informe.temas ?? []) {
    partes.push(`- ${t.tema}${t.duracion ? ` (${t.duracion})` : ""}: ${t.resumen}`);
    for (const c of t.conceptos ?? []) {
      partes.push(`  · ${c.termino}: ${c.definicion}`);
    }
  }
  if (d.informe.glosario?.length) {
    partes.push("", "Glosario:");
    for (const g of d.informe.glosario) partes.push(`- ${g.termino}: ${g.definicion}`);
  }
  let texto = partes.join("\n");
  if (texto.length > maxCaracteres) texto = texto.slice(0, maxCaracteres) + "…";
  return texto;
}
