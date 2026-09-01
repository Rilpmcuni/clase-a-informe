import fs from "node:fs";
import path from "node:path";

/** Raíz del repo (la app web corre con cwd = web/) */
export const RAIZ = path.resolve(process.cwd(), "..");
export const DATA = path.join(RAIZ, ".data");
export const DIR_VIDEOS = path.join(DATA, "videos");
export const DIR_ANALISIS = path.join(DATA, "analisis");
export const DIR_JOBS = path.join(DATA, "jobs");
export const DIR_MEMORIA = path.join(DATA, "memoria");

export function asegurarCarpetas() {
  for (const d of [DATA, DIR_VIDEOS, DIR_ANALISIS, DIR_JOBS, DIR_MEMORIA]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

/** Python del venv del motor, según plataforma. */
export function rutaPython(): string {
  const esWin = process.platform === "win32";
  return path.join(RAIZ, ".venv", esWin ? "Scripts\\python.exe" : "bin", esWin ? "python.exe" : "python");
}

export function rutaMotor(): string {
  return path.join(RAIZ, "analiza.py");
}

export function validarId(id: string): boolean {
  return /^[a-zA-Z0-9._-]{1,80}$/.test(id) && !id.includes("..");
}

export function nombreSeguro(nombre: string): string {
  const base = path.basename(nombre).normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const sinExt = base.replace(/\.[^.]+$/, "");
  const limpio = sinExt.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return (limpio || "clase").slice(0, 60);
}
