import fs from "node:fs";
import path from "node:path";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { cargarConfig } from "./config";
import type { DescripcionFrame, FrameUnico, Informe, Segmento } from "./tipos";

export interface Clasificacion {
  materia: string | null;
  profesor: string | null;
}

const PROMPT = `Se entrega material de una clase grabada: un resumen, un extracto de la voz del profesor y algunas capturas de pantalla del video.
Determina la asignatura (materia) y el nombre del profesor.
En las capturas puede verse una videoconferencia: el nombre del docente suele aparecer en la barra de participantes o bajo su ventana de video, a menudo con la etiqueta "Profesor", "Presenter" o similar; cópialo tal cual aparece en pantalla. Si el profesor no se nombra ni en la voz ni en pantalla, usa null.
Responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional:
{"materia": "asignatura (ej: Matemática, Historia, Economía) o null", "profesor": "nombre o null"}

RESUMEN DE LA CLASE:
{resumen}

EXTRACTO DE LA VOZ (primeros minutos):
{voz}`;

function leerJson<T>(ruta: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Clasifica un análisis (materia + profesor) con la IA, mirando también las
 * capturas: en clases por videoconferencia el nombre del docente aparece en
 * pantalla. Escribe el resultado dentro de informe.json.
 */
export async function clasificarAnalisis(dir: string, forzar = false): Promise<Clasificacion | null> {
  const informe = leerJson<Informe>(path.join(dir, "informe.json"));
  if (!informe) return null;
  if (!forzar && informe.materia && informe.profesor) {
    return { materia: informe.materia, profesor: informe.profesor };
  }
  const cfg = cargarConfig();
  if (!cfg.apiKey) return null;

  const voz = (leerJson<Segmento[]>(path.join(dir, "transcripcion.json")) ?? [])
    .slice(0, 40)
    .map((s) => s.texto)
    .join(" ")
    .slice(0, 4000);

  // hasta 3 capturas representativas (relevancia alta primero)
  const frames = leerJson<FrameUnico[]>(path.join(dir, "frames_unicos.json")) ?? [];
  const relevPor = new Map(
    (leerJson<DescripcionFrame[]>(path.join(dir, "descripciones.json")) ?? []).map(
      (d) => [d.archivo, d.relevancia],
    ),
  );
  const elegidos = [
    ...frames.filter((f) => relevPor.get(f.archivo) === "alta").map((f) => f.archivo),
    ...frames.map((f) => f.archivo),
  ]
    .filter((archivo, i, todos) => todos.indexOf(archivo) === i)
    .slice(0, 3);

  const imagenes: Array<{ type: "image"; image: string }> = [];
  for (const archivo of elegidos) {
    const ruta = path.join(dir, "frames", path.basename(archivo));
    try {
      const b64 = fs.readFileSync(ruta).toString("base64");
      imagenes.push({ type: "image", image: `data:image/jpeg;base64,${b64}` });
    } catch {
      // frame ilegible: continuar con el resto
    }
  }

  const proveedor = createOpenAICompatible({
    name: "zai",
    baseURL: cfg.baseUrl,
    apiKey: cfg.apiKey,
  });

  const r = await generateText({
    model: proveedor.chatModel(cfg.modeloTexto),
    maxOutputTokens: 400,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: PROMPT.replace("{resumen}", informe.resumen_ejecutivo ?? "").replace(
              "{voz}",
              voz || "(sin transcripción)",
            ),
          },
          ...imagenes,
        ],
      },
    ],
  });

  const m = r.text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let cruda: { materia?: string | null; profesor?: string | null };
  try {
    cruda = JSON.parse(m[0]);
  } catch {
    return null;
  }
  const clasificacion: Clasificacion = {
    materia: cruda.materia || null,
    profesor: cruda.profesor || null,
  };

  informe.materia = clasificacion.materia;
  informe.profesor = clasificacion.profesor;
  fs.writeFileSync(path.join(dir, "informe.json"), JSON.stringify(informe, null, 2));
  return clasificacion;
}
