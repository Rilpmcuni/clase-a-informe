import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { RAIZ, DIR_JOBS, rutaMotor, rutaPython, asegurarCarpetas, validarId } from "./raiz";
import { envParaMotor, type ConfigApp } from "./config";
import { anotarMemoria } from "./memoria";

export type EstadoFase = "pendiente" | "corriendo" | "listo" | "omitido" | "error";

export interface EstadoJob {
  id: string;
  estado: "corriendo" | "listo" | "error";
  fases: Record<string, { estado: EstadoFase; pct: number; detalle: string }>;
  logs: string[];
  iniciado: string;
  terminado?: string;
  codigo?: number | null;
}

const ORDEN_FASES = ["stt", "escenas", "vision", "informe"] as const;
const MAX_LOGS = 300;

const jobs = new Map<string, { estado: EstadoJob; proceso?: ReturnType<typeof spawn> }>();

function nuevoEstado(id: string): EstadoJob {
  const fases: EstadoJob["fases"] = {};
  for (const f of ORDEN_FASES) fases[f] = { estado: "pendiente", pct: 0, detalle: "" };
  return { id, estado: "corriendo", fases, logs: [], iniciado: new Date().toISOString() };
}

function persistir(estado: EstadoJob) {
  try {
    asegurarCarpetas();
    fs.writeFileSync(path.join(DIR_JOBS, estado.id + ".json"), JSON.stringify(estado, null, 2));
  } catch {
    // persistencia best-effort
  }
}

export function iniciarJob(
  id: string,
  videoAbs: string,
  salidaAbs: string,
  cfg: ConfigApp,
  rehacer = false,
): EstadoJob {
  if (!validarId(id)) throw new Error("id inválido");
  const existente = jobs.get(id);
  if (existente && existente.estado.estado === "corriendo") return existente.estado;

  const estado = nuevoEstado(id);
  jobs.set(id, { estado });

  const argumentos = [
    rutaMotor(),
    videoAbs,
    "--salida",
    salidaAbs,
    "--progreso",
    "--idioma",
    cfg.idioma,
    "--whisper-modelo",
    cfg.whisperModelo,
    "--umbral",
    String(cfg.umbral),
    "--muestreo-seg",
    String(cfg.muestreoSeg),
    "--paralelo",
    String(cfg.paralelo),
    "--hash-distancia",
    String(cfg.hashDistancia),
  ];
  if (rehacer) argumentos.push("--rehacer");

  const proceso = spawn(rutaPython(), argumentos, {
    cwd: RAIZ,
    env: { ...process.env, ...envParaMotor(cfg) },
  });
  jobs.set(id, { estado, proceso });

  const procesarLinea = (linea: string) => {
    const texto = linea.trim();
    if (!texto) return;
    if (texto.startsWith("{")) {
      try {
        const ev = JSON.parse(texto) as { fase: string; evento: string; pct?: number; detalle?: string };
        const fase = estado.fases[ev.fase];
        if (fase) {
          if (ev.evento === "inicio") {
            fase.estado = "corriendo";
            fase.pct = ev.pct ?? 0;
          } else if (ev.evento === "progreso") {
            fase.estado = "corriendo";
            fase.pct = ev.pct ?? fase.pct;
            fase.detalle = ev.detalle ?? "";
          } else if (ev.evento === "fin") {
            fase.estado = "listo";
            fase.pct = 100;
            fase.detalle = ev.detalle ?? "";
          } else if (ev.evento === "omitido") {
            fase.estado = "omitido";
            fase.pct = 100;
            fase.detalle = ev.detalle ?? "ya estaba hecho";
          }
          persistir(estado);
        }
        return;
      } catch {
        // línea JSON rota: caer al log
      }
    }
    estado.logs.push(texto.slice(0, 300));
    if (estado.logs.length > MAX_LOGS) estado.logs.splice(0, estado.logs.length - MAX_LOGS);
    if (texto.startsWith("ERROR:")) {
      estado.estado = "error";
      estado.terminado = new Date().toISOString();
    }
    persistir(estado);
  };

  let buffer = "";
  proceso.stdout.on("data", (trozo: Buffer) => {
    buffer += trozo.toString();
    const lineas = buffer.split("\n");
    buffer = lineas.pop() ?? "";
    for (const linea of lineas) procesarLinea(linea);
  });
  proceso.stderr.on("data", (trozo: Buffer) => {
    for (const linea of trozo.toString().split("\n")) {
      if (linea.trim()) estado.logs.push("[err] " + linea.trim().slice(0, 280));
    }
    if (estado.logs.length > MAX_LOGS) estado.logs.splice(0, estado.logs.length - MAX_LOGS);
  });
  proceso.on("close", (codigo) => {
    estado.codigo = codigo;
    estado.terminado = new Date().toISOString();
    estado.estado = codigo === 0 && estado.estado !== "error" ? "listo" : "error";
    persistir(estado);
    const activos = Object.values(estado.fases).filter((f) => f.estado === "corriendo");
    for (const f of activos) f.estado = codigo === 0 ? "listo" : "error";
    // auto-aprendizaje: anotar en la memoria del asistente
    try {
      const informe = JSON.parse(
        fs.readFileSync(path.join(salidaAbs, "informe.json"), "utf8"),
      ) as { titulo?: string; temas?: unknown[] };
      anotarMemoria(
        `Clase analizada "${informe.titulo ?? id}" (${estado.terminado?.slice(0, 10)}): ` +
          `${informe.temas?.length ?? 0} temas identificados.`,
      );
    } catch {
      // sin informe no hay nota
    }
    // clasificación (materia + profesor) mirando voz y capturas; no bloquea el fin del job
    void import("./clasificar")
      .then(({ clasificarAnalisis }) => clasificarAnalisis(salidaAbs))
      .catch(() => {});
    persistir(estado);
  });
  proceso.on("error", (err) => {
    estado.estado = "error";
    estado.logs.push("[err] no se pudo lanzar el motor: " + err.message);
    persistir(estado);
  });

  persistir(estado);
  return estado;
}

export function obtenerJob(id: string): EstadoJob | null {
  const enMemoria = jobs.get(id)?.estado;
  if (enMemoria) return enMemoria;
  try {
    const ruta = path.join(DIR_JOBS, id + ".json");
    if (!fs.existsSync(ruta)) return null;
    return JSON.parse(fs.readFileSync(ruta, "utf8")) as EstadoJob;
  } catch {
    return null;
  }
}

export function jobCorriendo(id: string): boolean {
  return jobs.get(id)?.estado.estado === "corriendo";
}
