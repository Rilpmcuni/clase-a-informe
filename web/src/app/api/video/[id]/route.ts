import fs from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { rutaVideo, existeAnalisis } from "@/lib/analisis";
import { validarId } from "@/lib/raiz";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!validarId(id) || !existeAnalisis(id)) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  const ruta = rutaVideo(id);
  if (!ruta) return NextResponse.json({ error: "Video no disponible" }, { status: 404 });

  const stat = fs.statSync(ruta);
  const tamaño = stat.size;
  const rango = req.headers.get("range");

  if (rango) {
    const m = rango.match(/bytes=(\d*)-(\d*)/);
    let inicio = m?.[1] ? parseInt(m[1], 10) : 0;
    let fin = m?.[2] ? parseInt(m[2], 10) : tamaño - 1;
    if (isNaN(inicio) || inicio >= tamaño) inicio = 0;
    if (isNaN(fin) || fin >= tamaño) fin = tamaño - 1;
    const trozo = fs.createReadStream(ruta, { start: inicio, end: fin });
    return new Response(Readable.toWeb(trozo) as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(fin - inicio + 1),
        "Content-Range": `bytes ${inicio}-${fin}/${tamaño}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  const completo = fs.createReadStream(ruta);
  return new Response(Readable.toWeb(completo) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(tamaño),
      "Accept-Ranges": "bytes",
    },
  });
}
