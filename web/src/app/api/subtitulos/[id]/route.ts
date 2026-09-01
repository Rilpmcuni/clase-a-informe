import { NextResponse } from "next/server";
import { detalle, existeAnalisis } from "@/lib/analisis";
import { validarId } from "@/lib/raiz";

function vtt(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  const ms = Math.round((segundos - Math.floor(segundos)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!validarId(id) || !existeAnalisis(id)) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  const { transcripcion } = detalle(id);
  const lineas = ["WEBVTT", ""];
  transcripcion.forEach((seg, i) => {
    lineas.push(String(i + 1));
    lineas.push(`${vtt(seg.inicio)} --> ${vtt(seg.fin)}`);
    lineas.push(seg.texto);
    lineas.push("");
  });
  return new Response(lineas.join("\n"), {
    headers: { "Content-Type": "text/vtt; charset=utf-8" },
  });
}
