import { convertToModelMessages, streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { cargarConfig } from "@/lib/config";
import { contextoParaChat, existeAnalisis } from "@/lib/analisis";
import { contextoChatsAnteriores } from "@/lib/chats";
import { leerMemoria } from "@/lib/memoria";
import { validarId } from "@/lib/raiz";

const SISTEMA_BASE = `Eres el asistente de estudio de "Clase a Informe". Ayudas a un estudiante a entender las clases que grabó y analizó: resuelves dudas sobre los temas, preparas resúmenes, quizzes y explicaciones alternativas.
Reglas: responde en español, claro y didáctico; usa markdown ligero (negritas, listas cortas); si te preguntan algo fuera de la clase, ayudas igual pero aclarando que no viene del video; sé conciso.`;

export const maxDuration = 300;

export async function POST(req: Request) {
  const cuerpo = (await req.json().catch(() => null)) as
    | { messages?: unknown[]; idClase?: string; chatId?: string }
    | null;
  if (!cuerpo?.messages) {
    return new Response("faltan messages", { status: 400 });
  }
  const cfg = cargarConfig();
  if (!cfg.apiKey) {
    return new Response("Falta la API key. Configúrala en Ajustes.", { status: 400 });
  }

  let contexto = "";
  let chatsPrevios = "";
  if (cuerpo.idClase && validarId(cuerpo.idClase) && existeAnalisis(cuerpo.idClase)) {
    contexto = "\n\nContexto de la clase actual (generado por el análisis):\n" +
      contextoParaChat(cuerpo.idClase);
    const extracto = contextoChatsAnteriores(cuerpo.idClase, cuerpo.chatId);
    if (extracto) {
      chatsPrevios =
        "\n\nConversaciones anteriores del estudiante en esta clase (para continuidad; " +
        "puedes referirte a lo que ya se habló):\n" + extracto;
    }
  }
  const memoria = leerMemoria();
  const memoriaRecortada = memoria.length > 4000 ? memoria.slice(0, 4000) + "…" : memoria;

  const proveedor = createOpenAICompatible({
    name: "zai",
    baseURL: cfg.baseUrl,
    apiKey: cfg.apiKey,
  });

  try {
    const resultado = streamText({
      model: proveedor.chatModel(cfg.modeloTexto),
      system: SISTEMA_BASE + (contexto || "\n(No hay clase cargada: chat general)") +
        chatsPrevios +
        "\n\nMemoria acumulada del estudiante (tus notas automáticas y lo que ha decidido recordar):\n" +
        memoriaRecortada,
      messages: await convertToModelMessages(cuerpo.messages as never),
    });
    return resultado.toUIMessageStreamResponse();
  } catch (e) {
    return new Response(
      "Error del proveedor: " + (e instanceof Error ? e.message.slice(0, 300) : "desconocido"),
      { status: 502 },
    );
  }
}
