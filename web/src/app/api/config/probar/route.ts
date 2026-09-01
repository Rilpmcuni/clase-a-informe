import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { cargarConfig } from "@/lib/config";

export async function POST() {
  const cfg = cargarConfig();
  if (!cfg.apiKey) {
    return NextResponse.json({ ok: false, error: "Falta la API key en Ajustes." }, { status: 400 });
  }
  try {
    const proveedor = createOpenAICompatible({
      name: "zai",
      baseURL: cfg.baseUrl,
      apiKey: cfg.apiKey,
    });
    const r = await generateText({
      model: proveedor.chatModel(cfg.modeloTexto),
      prompt: "Responde exactamente: OK",
    });
    return NextResponse.json({ ok: true, respuesta: r.text.trim().slice(0, 60), modelo: cfg.modeloTexto });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "error desconocido" },
      { status: 502 },
    );
  }
}
