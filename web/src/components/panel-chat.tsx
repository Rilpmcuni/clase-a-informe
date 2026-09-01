"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Camera, Loader2, Send, Square, TriangleAlert, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAdjuntosChat } from "@/lib/store";
import { mmss } from "@/lib/tiempo";
import { cn } from "@/lib/utils";

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

export function PanelChat({ idClase }: { idClase: string }) {
  const { seleccion, captura, minutoCaptura, setSeleccion, limpiarAdjuntos } = useAdjuntosChat();
  const [texto, setTexto] = useState("");
  const abajo = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { idClase } }),
    [idClase],
  );
  const { messages, sendMessage, status, stop, error } = useChat({ transport });

  const ocupado = status === "submitted" || status === "streaming";

  useEffect(() => {
    abajo.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, status]);

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
    setSeleccion("");
    limpiarAdjuntos();
  };

  return (
    <div className="flex h-full flex-col">
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
                  return (
                    <div key={i} className={m.role === "user" ? "[&_strong]:font-semibold" : ""}>
                      <TextoSimple texto={parte.text} />
                    </div>
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
          <div className="mb-2 flex items-center gap-2 rounded-lg border bg-accent/30 px-2.5 py-1.5 text-xs">
            {captura ? (
              <Badge variant="secondary" className="gap-1">
                <Camera className="h-3 w-3" /> fotograma {mmss(minutoCaptura)}
              </Badge>
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
            title="Capturar fotograma actual del video"
            onClick={() => {
              const evento = new CustomEvent("capturar-fotograma");
              window.dispatchEvent(evento);
              toast.success("Fotograma capturado", { description: "Se adjuntará al mensaje" });
            }}
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
