import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { DIR_VIDEOS, asegurarCarpetas, nombreSeguro } from "@/lib/raiz";
import { crearAnalisis } from "@/lib/analisis";

const EXTENSIONES = new Set([".mp4", ".mkv", ".webm", ".mov", ".avi"]);

function probeVideo(ruta: string): Promise<{ duracion?: number; ancho?: number; alto?: number }> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height:format=duration",
      "-of", "json",
      ruta,
    ]);
    let salida = "";
    proc.stdout.on("data", (t: Buffer) => (salida += t.toString()));
    proc.on("error", () => resolve({}));
    proc.on("close", () => {
      try {
        const datos = JSON.parse(salida);
        resolve({
          duracion: datos.format?.duration ? Math.round(Number(datos.format.duration)) : undefined,
          ancho: datos.streams?.[0]?.width,
          alto: datos.streams?.[0]?.height,
        });
      } catch {
        resolve({});
      }
    });
  });
}

export async function POST(req: Request) {
  asegurarCarpetas();
  const formulario = await req.formData().catch(() => null);
  const archivo = formulario?.get("video");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return NextResponse.json({ error: "No se recibió ningún video" }, { status: 400 });
  }
  const ext = path.extname(archivo.name).toLowerCase();
  if (!EXTENSIONES.has(ext)) {
    return NextResponse.json(
      { error: `Formato no soportado (${ext || "desconocido"}). Usa mp4, mkv, webm o mov.` },
      { status: 400 },
    );
  }
  if (archivo.size > 4 * 1024 * 1024 * 1024) {
    return NextResponse.json({ error: "Video demasiado grande (máx 4 GB)" }, { status: 400 });
  }

  const id = `${nombreSeguro(archivo.name)}-${Date.now().toString(36)}`;
  const nombreVideo = id + (ext === ".avi" ? ".avi" : ext);
  const ruta = path.join(DIR_VIDEOS, nombreVideo);
  fs.writeFileSync(ruta, Buffer.from(await archivo.arrayBuffer()));

  const probe = await probeVideo(ruta);
  crearAnalisis(id, {
    video: nombreVideo,
    creado: new Date().toISOString(),
    ...probe,
  });
  return NextResponse.json({ id });
}
