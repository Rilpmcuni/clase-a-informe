import { NextResponse } from "next/server";
import { borrarAnalisis, detalle, existeAnalisis } from "@/lib/analisis";
import { validarId } from "@/lib/raiz";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!validarId(id) || !existeAnalisis(id)) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  return NextResponse.json(detalle(id));
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!validarId(id) || !existeAnalisis(id)) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  const { conVideo } = (await req.json().catch(() => ({}))) as { conVideo?: boolean };
  borrarAnalisis(id, Boolean(conVideo));
  return NextResponse.json({ ok: true });
}
