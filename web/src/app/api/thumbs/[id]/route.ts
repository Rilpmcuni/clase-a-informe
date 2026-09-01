import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { existeAnalisis, carpetaDe } from "@/lib/analisis";
import { validarId } from "@/lib/raiz";

/** VTT de thumbnails para el preview de la barra de progreso del reproductor.
 *  Cada cue apunta al frame único más cercano hacia atrás. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!validarId(id) || !existeAnalisis(id)) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  const carpeta = carpetaDe(id);
  let frames: { archivo: string; tiempos?: number[]; tiempo?: number }[] = [];
  try {
    frames = JSON.parse(fs.readFileSync(path.join(carpeta, "frames_unicos.json"), "utf8"));
  } catch {
    return new Response("WEBVTT\n\n", { headers: { "Content-Type": "text/vtt" } });
  }

  const momentos = frames
    .map((f) => f.tiempos?.[0] ?? f.tiempo ?? 0)
    .sort((a, b) => a - b);

  let duracion = 0;
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(carpeta, "meta.json"), "utf8"));
    duracion = meta.duracion ?? 0;
  } catch {
    // sin meta: la última cue dura 2 minutos
  }

  const ts = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
  };

  const lineas = ["WEBVTT", ""];
  momentos.forEach((inicio, i) => {
    const fin = i + 1 < momentos.length ? momentos[i + 1] : duracion || inicio + 120;
    const archivo = encodeURIComponent(
      frames.find((f) => (f.tiempos?.[0] ?? f.tiempo ?? 0) === inicio)!.archivo,
    );
    lineas.push(`${ts(inicio)} --> ${ts(fin)}`, `/api/frame/${id}/${archivo}`, "");
  });

  return new Response(lineas.join("\n"), {
    headers: { "Content-Type": "text/vtt", "Cache-Control": "no-store" },
  });
}
