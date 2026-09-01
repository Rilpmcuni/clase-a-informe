import { z } from "zod";

/** Esquema compartido cliente/servidor (sin imports de node). */
export const EsquemaConfig = z.object({
  apiKey: z.string().trim().default(""),
  baseUrl: z
    .string()
    .trim()
    .url()
    .default("https://api.z.ai/api/coding/paas/v4"),
  modeloVision: z.string().trim().default("glm-5.3-flash"),
  modeloTexto: z.string().trim().default("glm-5.3-flash"),
  idioma: z.string().trim().default("es"),
  whisperModelo: z.enum(["tiny", "base", "small", "medium", "large-v3"]).default("small"),
  umbral: z.coerce.number().min(5).max(80).default(27),
  muestreoSeg: z.coerce.number().int().min(0).max(3600).default(180),
  paralelo: z.coerce.number().int().min(1).max(8).default(4),
  hashDistancia: z.coerce.number().int().min(0).max(30).default(6),
});

export type ConfigApp = z.infer<typeof EsquemaConfig>;
