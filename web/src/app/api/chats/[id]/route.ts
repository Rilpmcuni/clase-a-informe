import { listarChats } from "@/lib/chats";

export const dynamic = "force-dynamic";

/** Lista de conversaciones guardadas de una clase. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    return Response.json({ chats: listarChats(id) });
  } catch {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }
}
