import { NextResponse } from "next/server";
import { obtenerJob } from "@/lib/jobs";
import { validarId } from "@/lib/raiz";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!validarId(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const estado = obtenerJob(id);
  if (!estado) return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
  return NextResponse.json(estado);
}
