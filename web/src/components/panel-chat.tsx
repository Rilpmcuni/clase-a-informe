"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Camera,
  ChevronDown,
  History,
  Loader2,
  MessageSquarePlus,
  Send,
  Square,
  Trash2,
  TriangleAlert,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdjuntosChat } from "@/lib/store";
import { fechaLegible, mmss } from "@/lib/tiempo";
import { cn } from "@/lib/utils";

// Estilos de markdown para las respuestas del asistente (GFM: tablas, listas, código…)
const clasesMarkdown = [
  "space-y-2 text-sm leading-relaxed [&>*:first-child]:mt-0",
  "[&_h1]:text-base [&_h1]:font-bold",
  "[&_h2]:text-[15px] [&_h2]:font-bold",
  "[&_h3]:font-semibold [&_h4]:font-semibold",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-0.5 [&_li]:marker:text-muted-foreground",
  "[&_code]:rounded [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-foreground/10 [&_pre]:p-3 [&_pre]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
  "[&_th]:border [&_th]:border-border [&_th]:bg-background/60 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:italic",
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline",
  "[&_hr]:my-3 [&_hr]:border-border",
].join(" ");

function Markdown({ texto }: { texto: string }) {
  return (
    <div className={clasesMarkdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{texto}</ReactMarkdown>
    </div>
  );
}

// Texto plano con **negritas** para los mensajes del usuario
function TextoSimple({ texto }: { texto: string }) {
  return (
    <div className="space-y-1.5 whitespace-pre-wrap text-sm leading-relaxed">
      {texto.split("\n").map((linea, i) => (
        <p key={i} className={linea.startsWith("- ") ? "pl-3 -indent-3" : ""}>
          {linea.split(/(\*\*[^*]+\*\*)/g).map((parte, j) =>
            parte.startsWith("**") && parte.endsWith("**") ? (
              <strong key={j}>{parte.slice(2, -2)}</strong>
            ) : (
              parte
            ),
          )}
        </p>
      ))}
    </div>
  );
}

interface MetaChat {
  id: string;
  titulo: string;
  creado: string;
  actualizado: string;
  nMensajes: number;
}

/** Panel completo: gestiona el historial y delega la conversación activa. */
export function PanelChat({ idClase }: { idClase: string }) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [iniciales, setIniciales] = useState<UIMessage[] | null>(null);
  const [lista, setLista] = useState<MetaChat[]>([]);

  const refrescarLista = useCallback(async () => {
    try {
      const r = await fetch(`/api/chats/${idClase}`);
      const j = await r.json();
      setLista(j.chats ?? []);
    } catch {
      // sin historial disponible: seguir igual
    }
  }, [idClase]);

  const abrir = useCallback(
    async (cid: string) => {
      let mensajes: UIMessage[] = [];
      try {
        const r = await fetch(`/api/chats/${idClase}/${cid}`);
        if (r.ok) {
          const j = await r.json();
          mensajes = j.chat?.messages ?? [];
        }
      } catch {
        // conversación ilegible: abrir vacía
      }
      setIniciales(mensajes);
      setChatId(cid);
    },
    [idClase],
  );

  const nueva = useCallback(() => {
    setIniciales([]);
    setChatId(crypto.randomUUID());
  }, []);

  // al montar: recuperar la última conversación o empezar una nueva
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/chats/${idClase}`);
        const j = await r.json();
        const chats: MetaChat[] = j.chats ?? [];
        if (!vivo) return;
        setLista(chats);
        if (chats.length > 0) await abrir(chats[0].id);
        else nueva();
      } catch {
        if (vivo) nueva();
      }
    })();
    return () => {
      vivo = false;
    };
  }, [idClase, abrir, nueva]);

  if (!chatId || iniciales === null) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando conversación…
      </div>
    );
  }

  return (
    <Conversacion
      key={chatId}
      idClase={idClase}
      chatId={chatId}
      iniciales={iniciales}
      lista={lista}
      refrescarLista={refrescarLista}
      abrir={abrir}
      nueva={nueva}
    />
  );
}

function Conversacion({
  idClase,
  chatId,
  iniciales,
  lista,
  refrescarLista,
  abrir,
  nueva,
}: {
  idClase: string;
  chatId: string;
  iniciales: UIMessage[];
  lista: MetaChat[];
  refrescarLista: () => Promise<void>;
  abrir: (cid: string) => Promise<void>;
  nueva: () => void;
}) {
  const { seleccion, captura, minutoCaptura, limpiarAdjuntos } = useAdjuntosChat();
  const [texto, setTexto] = useState("");
  const abajo = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { idClase, chatId } }),
    [idClase, chatId],
  );
  const { messages, sendMessage, status, stop, error } = useChat({
    transport,
    messages: iniciales,
  });

  const ocupado = status === "submitted" || status === "streaming";
  const metaActual = lista.find((c) => c.id === chatId);

  useEffect(() => {
    abajo.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, status]);

  // autoguardado: persiste el historial en cuanto cambian los mensajes
  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(async () => {
      try {
        await fetch(`/api/chats/${idClase}/${chatId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
        });
        if (status === "ready") await refrescarLista();
      } catch {
        // sin conexión local imposible, pero no interrumpir el chat
      }
    }, 900);
    return () => clearTimeout(t);
  }, [messages, status, idClase, chatId, refrescarLista]);

  const enviar = (textoExtra = "") => {
    const final = (textoExtra || texto).trim();
    if (!final && !captura) return;
    let contenido = final;
    if (seleccion) {
      contenido = `Sobre este fragmento de la transcripción:\n«${seleccion}»\n\n${final}`;
    }
    sendMessage({
      text: contenido || "¿Qué puedes decirme de esta imagen?",
      files: captura
        ? [{ type: "file" as const, mediaType: "image/jpeg", url: captura }]
        : undefined,
    });
    setTexto("");
    limpiarAdjuntos();
  };

  const pedirSeleccion = () => {
    window.dispatchEvent(new CustomEvent("seleccionar-fotograma"));
    toast.info("Arrastra sobre el video para seleccionar el área", {
      description: "Se capturará y quedará adjunta aquí. Esc para cancelar.",
    });
  };

  const borrarActual = async () => {
    await fetch(`/api/chats/${idClase}/${chatId}`, { method: "DELETE" });
    toast.success("Conversación eliminada");
    await refrescarLista();
    nueva();
  };

  return (
    <div className="flex h-full flex-col">
      {/* barra de historial */}
      <div className="flex shrink-0 items-center gap-1.5 border-b px-2.5 py-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 max-w-[75%] gap-1.5 px-2 text-xs">
              <History className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{metaActual?.titulo ?? "Nueva conversación"}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            <DropdownMenuItem onClick={nueva}>
              <MessageSquarePlus className="mr-2 h-4 w-4" /> Nueva conversación
            </DropdownMenuItem>
            {lista.length > 0 && <DropdownMenuSeparator />}
            {lista.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => c.id !== chatId && abrir(c.id)}
                className={cn("gap-2", c.id === chatId && "bg-accent")}
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{c.titulo}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {fechaLegible(c.actualizado)} · {c.nMensajes} msj
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
          title="Eliminar esta conversación"
          onClick={borrarActual}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Bot className="h-10 w-10 text-primary/30" />
            <p className="text-sm text-muted-foreground">
              Pregunta lo que quieras sobre esta clase.
              <br />
              Conoce el informe, la transcripción y tu memoria de estudio.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {[
                "Explícame el tema 1 como si tuviera 10 años",
                "Hazme un quiz de 5 preguntas",
                "¿Qué es lo más importante para el examen?",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-2.5", m.role === "user" && "justify-end")}>
            {m.role === "assistant" && (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </span>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5",
                m.role === "user"
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-muted",
              )}
            >
              {m.parts.map((parte, i) => {
                if (parte.type === "text") {
                  return m.role === "user" ? (
                    <TextoSimple key={i} texto={parte.text} />
                  ) : (
                    <Markdown key={i} texto={parte.text} />
                  );
                }
                if (parte.type === "file" && parte.mediaType?.startsWith("image/")) {
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={parte.url}
                      alt="adjunto"
                      className="mt-1 max-h-44 rounded-lg border"
                    />
                  );
                }
                return null;
              })}
            </div>
            {m.role === "user" && (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <User className="h-4 w-4" />
              </span>
            )}
          </div>
        ))}
        {ocupado && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {error.message.includes("API key")
                ? "Falta tu API key: configúrala en Ajustes."
                : "Error del proveedor: " + error.message.slice(0, 200)}
            </span>
          </div>
        )}
        <div ref={abajo} />
      </div>

      <div className="border-t p-3">
        {(seleccion || captura) && (
          <div className="mb-2 flex items-center gap-2.5 rounded-lg border bg-accent/30 px-2.5 py-1.5 text-xs">
            {captura ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={captura}
                  alt="fotograma adjunto"
                  className="h-10 w-16 shrink-0 rounded border bg-black object-cover"
                />
                <span className="shrink-0 font-mono text-accent-foreground">
                  {mmss(minutoCaptura)}
                </span>
              </>
            ) : null}
            {seleccion ? (
              <span className="truncate text-accent-foreground">«{seleccion.slice(0, 60)}…»</span>
            ) : null}
            <button
              onClick={limpiarAdjuntos}
              className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
            >
              quitar
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Button
            size="icon"
            variant="outline"
            title="Seleccionar un área del video y adjuntarla al chat"
            onClick={pedirSeleccion}
          >
            <Camera className="h-4 w-4" />
          </Button>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder="Escribe tu pregunta… (Enter envía)"
            className="min-h-10 resize-none"
            rows={1}
          />
          {ocupado ? (
            <Button size="icon" variant="destructive" onClick={stop} title="Detener">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={() => enviar()} disabled={!texto.trim() && !captura}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
