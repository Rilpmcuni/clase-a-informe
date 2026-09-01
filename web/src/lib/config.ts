import fs from "node:fs";
import path from "node:path";
import { DATA, asegurarCarpetas } from "./raiz";
import { EsquemaConfig, type ConfigApp } from "./esquema-config";

export { EsquemaConfig, type ConfigApp } from "./esquema-config";

export const RUTA_CONFIG = path.join(DATA, "config.json");

function desdeEnv(): ConfigApp {
  const rutaEnv = path.join(DATA, "..", ".env");
  const valores: Record<string, string> = {};
  try {
    const texto = fs.readFileSync(rutaEnv, "utf8");
    for (const linea of texto.split("\n")) {
      const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) valores[m[1]] = m[2];
    }
  } catch {
    // sin .env: usar defaults
  }
  return EsquemaConfig.parse({
    apiKey: valores.ZAI_API_KEY ?? "",
    baseUrl: valores.ZAI_BASE_URL || undefined,
    modeloVision: valores.MODELO_VISION || undefined,
    modeloTexto: valores.MODELO_TEXTO || undefined,
  });
}

export function cargarConfig(): ConfigApp {
  asegurarCarpetas();
  try {
    const bruto = JSON.parse(fs.readFileSync(RUTA_CONFIG, "utf8"));
    return EsquemaConfig.parse(bruto);
  } catch {
    const fallback = desdeEnv();
    try {
      fs.writeFileSync(RUTA_CONFIG, JSON.stringify(fallback, null, 2));
    } catch {
      // seguir con config en memoria
    }
    return fallback;
  }
}

export function guardarConfig(parcial: Partial<ConfigApp>): ConfigApp {
  const actual = cargarConfig();
  const nuevo = EsquemaConfig.parse({ ...actual, ...parcial });
  asegurarCarpetas();
  fs.writeFileSync(RUTA_CONFIG, JSON.stringify(nuevo, null, 2));
  return nuevo;
}

/** Variables de entorno para el motor Python. */
export function envParaMotor(cfg: ConfigApp): Record<string, string> {
  return {
    ZAI_API_KEY: cfg.apiKey,
    ZAI_BASE_URL: cfg.baseUrl,
    MODELO_VISION: cfg.modeloVision,
    MODELO_TEXTO: cfg.modeloTexto,
  };
}
