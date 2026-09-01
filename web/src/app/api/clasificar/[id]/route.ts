import { carpetaDe } from "@/lib/analisis";
import { clasificarAnalisis } from "@/lib/clasificar";

export const maxDuration = 120;

/** Clasifica un análisis (materia + profesor) con la IA, leyendo también las capturas. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cuerpo = (await req.json().catch(() => null)) as { forzar?: boolean } | null;
  try {
    const resultado = await clasificarAnalisis(carpetaDe(id), Boolean(cuerpo?.forzar));
    if (!resultado) {
      return Response.json({ error: "sin informe o sin API key" }, { status: 400 });
    }
    return Response.json({ ok: true, ...resultado });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message.slice(0, 300) : "error clasificando" },
      { status: 502 },
    );
  }
}
