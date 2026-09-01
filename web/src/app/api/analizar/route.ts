import path from "node:path";
import { NextResponse } from "next/server";
import { cargarConfig } from "@/lib/config";
import { iniciarJob } from "@/lib/jobs";
import { DIR_ANALISIS, RAIZ, asegurarCarpetas } from "@/lib/raiz";
import { existeAnalisis, rutaVideo } from "@/lib/analisis";

export async function POST(req: Request) {
  const { id, rehacer } = (await req.json().catch(() => ({}))) as { id?: string; rehacer?: boolean };
  if (!id || !existeAnalisis(id)) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  const video = rutaVideo(id);
  if (!video) {
    return NextResponse.json({ error: "El video de este análisis no está en .data/videos" }, { status: 404 });
  }
  const cfg = cargarConfig();
  if (!cfg.apiKey) {
    return NextResponse.json(
      { error: "Falta la API key. Configúrala en Ajustes antes de analizar." },
      { status: 400 },
    );
  }
  asegurarCarpetas();
  const salida = path.join(DIR_ANALISIS, id);
  const estado = iniciarJob(
    id,
    path.join(RAIZ, ".data", "videos", path.basename(video)),
    salida,
    cfg,
    Boolean(rehacer),
  );
  return NextResponse.json({ ok: true, estado });
}
