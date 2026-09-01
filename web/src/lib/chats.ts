import fs from "node:fs";
import path from "node:path";
import { DIR_ANALISIS, asegurarCarpetas, validarId } from "./raiz";

/** Conversación de chat persistida por clase (mensajes en formato UIMessage del AI SDK). */
export interface Conversacion {
  id: string;
  titulo: string;
  creado: string;
  actualizado: string;
  messages: unknown[];
}

export interface MetaConversacion {
  id: string;
  titulo: string;
  creado: string;
  actualizado: string;
  nMensajes: number;
}

const ID_CHAT = /^[a-zA-Z0-9_-]{6,64}$/;

function carpetaChats(idClase: string): string {
  if (!validarId(idClase)) throw new Error("id de clase inválido");
  return path.join(DIR_ANALISIS, idClase, "chats");
}

function rutaChat(idClase: string, chatId: string): string {
  if (!ID_CHAT.test(chatId)) throw new Error("id de conversación inválido");
  return path.join(carpetaChats(idClase), chatId + ".json");
}

export function listarChats(idClase: string): MetaConversacion[] {
  const carpeta = carpetaChats(idClase);
  if (!fs.existsSync(carpeta)) return [];
  const salida: MetaConversacion[] = [];
  for (const entrada of fs.readdirSync(carpeta)) {
    if (!entrada.endsWith(".json")) continue;
    try {
      const c = JSON.parse(fs.readFileSync(path.join(carpeta, entrada), "utf8")) as Conversacion;
      salida.push({
        id: c.id,
        titulo: c.titulo || "Conversación",
        creado: c.creado,
        actualizado: c.actualizado,
        nMensajes: c.messages?.length ?? 0,
      });
    } catch {
      // archivo corrupto: ignorar
    }
  }
  return salida.sort((a, b) => b.actualizado.localeCompare(a.actualizado));
}

export function leerChat(idClase: string, chatId: string): Conversacion | null {
  try {
    return JSON.parse(fs.readFileSync(rutaChat(idClase, chatId), "utf8")) as Conversacion;
  } catch {
    return null;
  }
}

export function guardarChat(
  idClase: string,
  chatId: string,
  datos: { messages: unknown[]; titulo?: string },
): void {
  const ruta = rutaChat(idClase, chatId);
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const previa = leerChat(idClase, chatId);
  const ahora = new Date().toISOString();
  const mensajes = datos.messages ?? [];
  const titulo =
    datos.titulo ||
    previa?.titulo ||
    primerTexto(mensajes).slice(0, 70) ||
    "Conversación";
  const conversacion: Conversacion = {
    id: chatId,
    titulo,
    creado: previa?.creado ?? ahora,
    actualizado: ahora,
    messages: mensajes,
  };
  fs.writeFileSync(ruta, JSON.stringify(conversacion));
}

export function borrarChat(idClase: string, chatId: string): void {
  fs.rmSync(rutaChat(idClase, chatId), { force: true });
}

function primerTexto(messages: unknown[]): string {
  for (const m of messages as Array<{ role?: string; parts?: Array<{ type?: string; text?: string }> }>) {
    if (m.role !== "user") continue;
    const texto = (m.parts ?? [])
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join(" ")
      .trim();
    if (texto) return texto;
  }
  return "";
}

function textoDe(m: { parts?: Array<{ type?: string; text?: string }> }): string {
  return (m.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => (p.text ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/** Extracto de conversaciones anteriores (excluyendo la actual) para dar continuidad a la IA. */
export function contextoChatsAnteriores(
  idClase: string,
  exceptoChatId: string | undefined,
  maxCaracteres = 3500,
): string {
  const previas = listarChats(idClase)
    .filter((c) => c.id !== exceptoChatId && c.nMensajes > 0)
    .slice(0, 3);
  if (previas.length === 0) return "";
  const bloques: string[] = [];
  for (const meta of previas.reverse()) {
    const chat = leerChat(idClase, meta.id);
    if (!chat) continue;
    const lineas: string[] = [`--- Conversación "${chat.titulo}" ---`];
    for (const m of chat.messages as Array<{ role?: string; parts?: Array<{ type?: string; text?: string }> }>) {
      const texto = textoDe(m);
      if (!texto) continue;
      lineas.push(`${m.role === "user" ? "Estudiante" : "Asistente"}: ${texto.slice(0, 400)}`);
    }
    if (lineas.length > 1) bloques.push(lineas.slice(-8).join("\n"));
  }
  const todo = bloques.join("\n\n");
  return todo.length > maxCaracteres ? todo.slice(0, maxCaracteres) + "…" : todo;
}
