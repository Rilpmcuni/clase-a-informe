import { NextResponse } from "next/server";
import { cargarConfig, guardarConfig, EsquemaConfig } from "@/lib/config";

export async function GET() {
  const cfg = cargarConfig();
  return NextResponse.json({
    ...cfg,
    apiKey: cfg.apiKey ? "configurado" : "",
    tieneApiKey: Boolean(cfg.apiKey),
  });
}

export async function PUT(req: Request) {
  const cuerpo = await req.json().catch(() => null);
  const parsed = EsquemaConfig.safeParse(cuerpo);
  if (!parsed.success) {
    return NextResponse.json({ error: "Configuración inválida", detalle: parsed.error.flatten() }, { status: 400 });
  }
  const actual = cargarConfig();
  // si llega vacío u "configurado", conservar la key guardada
  const nuevo = { ...parsed.data };
  if (!nuevo.apiKey || nuevo.apiKey === "configurado") nuevo.apiKey = actual.apiKey;
  const guardado = guardarConfig(nuevo);
  return NextResponse.json({ ok: true, ...guardado, apiKey: guardado.apiKey ? "configurado" : "" });
}
