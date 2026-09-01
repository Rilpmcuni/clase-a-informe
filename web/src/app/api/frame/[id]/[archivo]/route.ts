import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { DIR_ANALISIS, validarId } from "@/lib/raiz";
import { existeAnalisis } from "@/lib/analisis";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; archivo: string }> },
) {
  const { id, archivo } = await params;
  if (!validarId(id) || !existeAnalisis(id)) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  const limpio = path.basename(decodeURIComponent(archivo));
  if (!/^[a-zA-Z0-9._-]+\.jpg$/.test(limpio)) {
    return NextResponse.json({ error: "archivo inválido" }, { status: 400 });
  }
  const ruta = path.join(DIR_ANALISIS, id, "frames", limpio);
  if (!fs.existsSync(ruta)) {
    return NextResponse.json({ error: "frame no encontrado" }, { status: 404 });
  }
  return new Response(fs.readFileSync(ruta), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
