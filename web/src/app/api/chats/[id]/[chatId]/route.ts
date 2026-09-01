import { borrarChat, guardarChat, leerChat } from "@/lib/chats";

export const dynamic = "force-dynamic";

/** Lee una conversación guardada. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; chatId: string }> },
) {
  const { id, chatId } = await params;
  try {
    const chat = leerChat(id, chatId);
    if (!chat) return Response.json({ error: "no existe" }, { status: 404 });
    return Response.json({ chat });
  } catch {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }
}

/** Crea o actualiza una conversación con el historial completo de mensajes. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; chatId: string }> },
) {
  const { id, chatId } = await params;
  const cuerpo = (await req.json().catch(() => null)) as
    | { messages?: unknown[]; titulo?: string }
    | null;
  if (!cuerpo?.messages) {
    return Response.json({ error: "faltan messages" }, { status: 400 });
  }
  try {
    guardarChat(id, chatId, { messages: cuerpo.messages, titulo: cuerpo.titulo });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "error guardando" },
      { status: 400 },
    );
  }
}

/** Elimina una conversación. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; chatId: string }> },
) {
  const { id, chatId } = await params;
  try {
    borrarChat(id, chatId);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }
}
