import { NextResponse } from "next/server";
import { leerMemoria, guardarMemoria } from "@/lib/memoria";

export async function GET() {
  return NextResponse.json({ contenido: leerMemoria() });
}

export async function PUT(req: Request) {
  const { contenido } = (await req.json().catch(() => ({}))) as { contenido?: string };
  if (typeof contenido !== "string" || contenido.length > 200_000) {
    return NextResponse.json({ error: "Contenido inválido" }, { status: 400 });
  }
  guardarMemoria(contenido);
  return NextResponse.json({ ok: true });
}
