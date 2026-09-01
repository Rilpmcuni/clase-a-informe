"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Crop,
  Download,
  FileText,
  ListVideo,
  Loader2,
  MessageCircle,
  ScrollText,
  Sparkles,
  X,
} from "lucide-react";
import {
  MediaPlayer,
  MediaProvider,
  Track,
  type MediaPlayerInstance,
} from "@vidstack/react";
import { DefaultVideoLayout, defaultLayoutIcons } from "@vidstack/react/player/layouts/default";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useReproductor, useAdjuntosChat } from "@/lib/store";
import { mmss, parseDuracion, fechaLegible } from "@/lib/tiempo";
import type { DetalleAnalisis } from "@/lib/analisis";
import { PanelChat } from "@/components/panel-chat";

function usarPantallaGrande() {
  const [grande, setGrande] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const cambio = () => setGrande(mq.matches);
    cambio();
    mq.addEventListener("change", cambio);
    return () => mq.removeEventListener("change", cambio);
  }, []);
  return grande;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function VistaClase({ detalle }: { detalle: DetalleAnalisis }) {
  const { id, informe, transcripcion, frames, descripciones, meta } = detalle;
  const playerRef = useRef<MediaPlayerInstance>(null);
  const cajaVideoRef = useRef<HTMLDivElement>(null);
  const listaTransRef = useRef<HTMLDivElement>(null);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const grande = usarPantallaGrande();

  // --- selección de área sobre el video ---
  const [selModo, setSelModo] = useState(false);
  const [selRect, setSelRect] = useState<Rect | null>(null);
  const arrastreInicio = useRef<{ x: number; y: number } | null>(null);

  const seekPendiente = useReproductor((s) => s.seekPendiente);
  const pedirSeek = useReproductor((s) => s.pedirSeek);
  const consumirSeek = useReproductor((s) => s.consumirSeek);
  const setSeleccion = useAdjuntosChat((s) => s.setSeleccion);
  const setCaptura = useAdjuntosChat((s) => s.setCaptura);
  const captura = useAdjuntosChat((s) => s.captura);
  const minutoCaptura = useAdjuntosChat((s) => s.minutoCaptura);
  const limpiarAdjuntos = useAdjuntosChat((s) => s.limpiarAdjuntos);

  // aplicar seeks que pida cualquier parte de la UI
  useEffect(() => {
    const p = playerRef.current;
    if (!p || seekPendiente == null) return;
    p.currentTime = Math.min(seekPendiente, p.state.duration || seekPendiente);
    consumirSeek();
    void p.play().catch(() => {});
  }, [seekPendiente, consumirSeek]);

  const descIndice = useMemo(() => {
    const m = new Map<string, (typeof descripciones)[number]>();
    for (const d of descripciones) m.set(d.archivo, d);
    return m;
  }, [descripciones]);

  // selector primitivo: solo re-renderiza cuando cambia el segmento activo,
  // no en cada timeupdate del video
  const indiceActivo = useReproductor((s) => {
    let idx = -1;
    for (let i = 0; i < transcripcion.length; i++) {
      if (transcripcion[i].inicio <= s.tiempo + 0.05) idx = i;
      else break;
    }
    return idx;
  });

  // auto-scroll de la transcripción al segmento activo
  useEffect(() => {
    if (indiceActivo < 0 || !listaTransRef.current) return;
    const el = listaTransRef.current.querySelector(`[data-seg="${indiceActivo}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [indiceActivo]);

  // --- captura de fotogramas (área o completo) ---
  const videoNativo = (): HTMLVideoElement | null => {
    const el = playerRef.current?.el as HTMLElement | null | undefined;
    if (!el) return null;
    return (el.shadowRoot?.querySelector("video") ?? el.querySelector("video")) as HTMLVideoElement | null;
  };

  const capturar = useCallback(
    (zona: Rect | null) => {
      const v = videoNativo();
      const caja = cajaVideoRef.current?.getBoundingClientRect();
      if (!v || !caja || !v.videoWidth) return;

      // rect de la imagen real dentro del elemento (letterboxing)
      const escala = Math.min(caja.width / v.videoWidth, caja.height / v.videoHeight);
      const anchoVis = v.videoWidth * escala;
      const altoVis = v.videoHeight * escala;
      const offX = (caja.width - anchoVis) / 2;
      const offY = (caja.height - altoVis) / 2;

      let sx = 0;
      let sy = 0;
      let sw = v.videoWidth;
      let sh = v.videoHeight;
      if (zona) {
        const x0 = Math.max(zona.x - offX, 0) / escala;
        const y0 = Math.max(zona.y - offY, 0) / escala;
        const x1 = Math.min(zona.x + zona.w - offX, anchoVis) / escala;
        const y1 = Math.min(zona.y + zona.h - offY, altoVis) / escala;
        sw = x1 - x0;
        sh = y1 - y0;
        if (sw < 20 || sh < 20) return;
        sx = x0;
        sy = y0;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      canvas.getContext("2d")?.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setCaptura(dataUrl, playerRef.current?.currentTime ?? 0);
    },
    [setCaptura],
  );

  const alSeleccionar = () => {
    const sel = window.getSelection()?.toString().trim() ?? "";
    if (sel.length > 15) setSeleccion(sel.slice(0, 600));
  };

  const generarPdf = async () => {
    setDescargandoPdf(true);
    try {
      const r = await fetch(`/api/pdf/${id}`, { method: "POST" });
      const j = await r.json();
      if (j.ok) window.location.href = `/api/pdf/${id}`;
      else toast.error("No se pudo generar el PDF", { description: j.error });
    } finally {
      setDescargandoPdf(false);
    }
  };

  // eventos de arrastre del overlay de selección
  const posEnCaja = (e: React.MouseEvent) => {
    const caja = cajaVideoRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - caja.left, 0), caja.width),
      y: Math.min(Math.max(e.clientY - caja.top, 0), caja.height),
    };
  };

  const overlayMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    arrastreInicio.current = posEnCaja(e);
    setSelRect(null);
  };
  const overlayMouseMove = (e: React.MouseEvent) => {
    const inicio = arrastreInicio.current;
    if (!inicio) return;
    const p = posEnCaja(e);
    setSelRect({
      x: Math.min(inicio.x, p.x),
      y: Math.min(inicio.y, p.y),
      w: Math.abs(p.x - inicio.x),
      h: Math.abs(p.y - inicio.y),
    });
  };
  const overlayMouseUp = () => {
    const inicio = arrastreInicio.current;
    arrastreInicio.current = null;
    if (!inicio || !selRect || selRect.w < 12 || selRect.h < 12) {
      setSelRect(null);
      return;
    }
    capturar(selRect);
    setSelRect(null);
    setSelModo(false);
    toast.success("Área capturada y adjuntada al chat", {
      description: "Puedes quitarla o enviarla con tu pregunta.",
    });
  };

  // cancelar selección con Escape
  useEffect(() => {
    if (!selModo) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelModo(false);
        setSelRect(null);
        arrastreInicio.current = null;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selModo]);

  // el botón de cámara del chat pide entrar en modo selección
  useEffect(() => {
    const handler = () => {
      setSelModo(true);
      toast.info("Arrastra sobre el video para seleccionar el área");
    };
    window.addEventListener("seleccionar-fotograma", handler);
    return () => window.removeEventListener("seleccionar-fotograma", handler);
  }, []);

  const barraTemas = (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {informe?.temas?.map((t, i) => {
        const seg = parseDuracion(t.duracion);
        return (
          <button
            key={i}
            onClick={() => seg != null && pedirSeek(seg)}
            className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <span className="mr-1 text-primary">{String(i + 1).padStart(2, "0")}</span>
            {t.tema.length > 44 ? t.tema.slice(0, 44) + "…" : t.tema}
          </button>
        );
      })}
    </div>
  );

  const reproductor = (
    <div>
      <div ref={cajaVideoRef} className="relative overflow-hidden rounded-xl border bg-black shadow-md">
        <div style={{ aspectRatio: `${meta?.ancho ?? 1920} / ${meta?.alto ?? 1080}` }}>
          <MediaPlayer
            ref={playerRef}
            src={`/api/video/${id}`}
            streamType="on-demand"
            viewType="video"
            title={informe?.titulo ?? id}
            className="h-full w-full"
            onTimeUpdate={(detalleEv) => useReproductor.getState().setTiempo(detalleEv.currentTime)}
          >
            <MediaProvider>
              <Track
                src={`/api/subtitulos/${id}`}
                kind="subtitles"
                label="Español"
                lang="es"
                default
              />
              <DefaultVideoLayout icons={defaultLayoutIcons} thumbnails={`/api/thumbs/${id}`} />
            </MediaProvider>
          </MediaPlayer>
        </div>

        {selModo && (
          <div
            className="absolute inset-0 z-30 cursor-crosshair bg-black/50"
            onMouseDown={overlayMouseDown}
            onMouseMove={overlayMouseMove}
            onMouseUp={overlayMouseUp}
            onMouseLeave={overlayMouseUp}
          >
            {selRect && (
              <div
                className="absolute border-2 border-dashed border-white"
                style={{
                  left: selRect.x,
                  top: selRect.y,
                  width: selRect.w,
                  height: selRect.h,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                }}
              >
                <span className="absolute -top-6 left-0 rounded bg-background/90 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                  {Math.round(selRect.w)}×{Math.round(selRect.h)} · suelta para capturar
                </span>
              </div>
            )}
            {!selRect && (
              <p className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow">
                Arrastra para seleccionar el área · Esc para cancelar
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          variant={selModo ? "default" : "outline"}
          size="sm"
          onClick={() => setSelModo((v) => !v)}
        >
          {selModo ? <X className="mr-1.5 h-3.5 w-3.5" /> : <Crop className="mr-1.5 h-3.5 w-3.5" />}
          {selModo ? "Cancelar selección" : "Seleccionar área del video"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          title="Adjuntar el fotograma completo al chat"
          onClick={() => {
            capturar(null);
            toast.success("Fotograma completo adjuntado al chat");
          }}
        >
          <Camera className="mr-1.5 h-3.5 w-3.5" /> Fotograma completo
        </Button>

        {captura && (
          <span className="ml-auto flex items-center gap-2 rounded-lg border bg-accent/30 p-1.5 pr-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={captura} alt="fotograma capturado" className="h-12 rounded border bg-black object-contain" />
            <span className="text-[11px] leading-tight text-accent-foreground">
              capturado
              <br />
              <span className="font-mono font-semibold">{mmss(minutoCaptura)}</span>
            </span>
            <button
              onClick={limpiarAdjuntos}
              title="Quitar captura"
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}

        {meta?.duracion && !captura ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {mmss(meta.duracion)} · {meta.ancho}×{meta.alto}
          </span>
        ) : null}
      </div>
      {informe?.temas?.length ? barraTemas : null}
    </div>
  );

  const pestanas = (
    <Tabs defaultValue="informe" className="flex h-full min-h-0 flex-col gap-0">
      <TabsList className="mx-3 mt-3 grid w-auto grid-cols-4 shrink-0">
        <TabsTrigger value="informe" className="gap-1.5"><FileText className="h-3.5 w-3.5" /><span className="hidden md:inline">Informe</span></TabsTrigger>
        <TabsTrigger value="transcripcion" className="gap-1.5"><ScrollText className="h-3.5 w-3.5" /><span className="hidden md:inline">Voz</span></TabsTrigger>
        <TabsTrigger value="diapositivas" className="gap-1.5"><ListVideo className="h-3.5 w-3.5" /><span className="hidden md:inline">Slides</span></TabsTrigger>
        <TabsTrigger value="chat" className="gap-1.5"><MessageCircle className="h-3.5 w-3.5" />Chat</TabsTrigger>
      </TabsList>

      <TabsContent value="informe" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4">
        {informe ? (
          <InformeRender informe={informe} id={id} frames={frames} descIndice={descIndice} pedirSeek={pedirSeek} />
        ) : (
          <p className="text-sm text-muted-foreground">Aún no hay informe para esta clase.</p>
        )}
      </TabsContent>

      <TabsContent value="transcripcion" className="mt-0 min-h-0 flex-1 overflow-hidden">
        <div
          ref={listaTransRef}
          onMouseUp={alSeleccionar}
          className="h-full space-y-1 overflow-y-auto p-3"
        >
          {transcripcion.map((seg, i) => (
            <button
              key={i}
              data-seg={i}
              onClick={() => pedirSeek(seg.inicio)}
              className={cn(
                "flex w-full gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                i === indiceActivo
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span className={cn("mt-0.5 font-mono text-xs", i === indiceActivo ? "text-primary font-bold" : "text-muted-foreground/70")}>
                {mmss(seg.inicio)}
              </span>
              <span className={i === indiceActivo ? "font-medium" : ""}>{seg.texto}</span>
            </button>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="diapositivas" className="mt-0 min-h-0 flex-1 overflow-y-auto p-4">
        <GridDiapositivas id={id} frames={frames} descripciones={descripciones} pedirSeek={pedirSeek} />
      </TabsContent>

      <TabsContent value="chat" className="mt-0 min-h-0 flex-1 overflow-hidden">
        <PanelChat idClase={id} />
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="mx-auto flex max-w-[1700px] flex-col gap-4 px-4 lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 pb-1 pt-5 lg:pt-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-xl font-bold sm:text-2xl">
            {informe?.titulo ?? id}
          </h1>
          <p className="text-xs text-muted-foreground">
            {meta?.creado ? fechaLegible(meta.creado) : ""} · Haz clic en cualquier minuto para saltar
            al video · Selecciona texto de la voz para preguntarle a la IA
          </p>
        </div>
        <Button onClick={generarPdf} disabled={descargandoPdf || !informe}>
          {descargandoPdf ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Descargar informe PDF
        </Button>
        <Button asChild variant="outline">
          <Link href="/">← Clases</Link>
        </Button>
      </div>

      {grande ? (
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1 rounded-xl border bg-card"
        >
          <ResizablePanel defaultSize="56" minSize="32">
            <div className="flex h-full flex-col overflow-y-auto p-4">
              <div className="my-auto">{reproductor}</div>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="44" minSize="26">
            {pestanas}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex flex-col gap-4">
          {reproductor}
          <div className="rounded-xl border bg-card">
            <div className="min-h-[70vh]">{pestanas}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function InformeRender({
  informe,
  id,
  frames,
  descIndice,
  pedirSeek,
}: {
  informe: NonNullable<DetalleAnalisis["informe"]>;
  id: string;
  frames: DetalleAnalisis["frames"];
  descIndice: Map<string, DetalleAnalisis["descripciones"][number]>;
  pedirSeek: (t: number) => void;
}) {
  return (
    <article className="prose-sm space-y-6">
      <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <h2 className="font-display mb-1.5 flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Resumen ejecutivo
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{informe.resumen_ejecutivo}</p>
      </section>

      {informe.temas?.map((t, i) => (
        <section key={i} className="space-y-3">
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-2xl font-bold text-primary/40">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="font-display font-semibold leading-tight">{t.tema}</h2>
              {t.duracion ? (
                <Badge variant="outline" className="mt-1 font-mono text-[10px]">{t.duracion}</Badge>
              ) : null}
            </div>
          </div>
          <p className="text-sm leading-relaxed">{t.resumen}</p>

          {t.frames?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {t.frames.map((archivo) => (
                <FrameConTexto key={archivo} archivo={archivo} />
              ))}
            </div>
          ) : null}

          {t.conceptos?.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {t.conceptos.map((c, j) => (
                <div key={j} className="rounded-lg border bg-card p-3">
                  <p className="text-sm font-semibold text-primary">{c.termino}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.definicion}</p>
                </div>
              ))}
            </div>
          ) : null}

          {t.preguntas?.length ? (
            <Accordion type="single" collapsible className="rounded-lg border px-4">
              <p className="pt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Preguntas y respuestas de la clase
              </p>
              {t.preguntas.map((p, j) => (
                <AccordionItem key={j} value={`pq-${i}-${j}`}>
                  <AccordionTrigger className="text-left text-sm font-medium">{p.pregunta}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{p.respuesta}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : null}

          {t.datos_curiosos?.length ? (
            <div className="rounded-lg border border-accent/60 bg-accent/20 p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-accent-foreground">Datos curiosos</p>
              <ul className="list-disc space-y-1 pl-4 text-sm text-accent-foreground">
                {t.datos_curiosos.map((d, j) => (
                  <li key={j}>{d}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ))}

      {informe.examen?.length ? (
        <section className="space-y-2 pb-4">
          <h2 className="font-display font-semibold">Posibles preguntas de examen</h2>
          <Accordion type="single" collapsible className="rounded-lg border px-4">
            {informe.examen.map((p, i) => (
              <AccordionItem key={i} value={`ex-${i}`}>
                <AccordionTrigger className="text-left text-sm font-medium">
                  <span className="mr-2 text-primary">{String(i + 1).padStart(2, "0")}</span>
                  {p.pregunta}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{p.respuesta}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ) : null}

      {informe.glosario?.length ? (
        <section className="space-y-2 pb-4">
          <h2 className="font-display font-semibold">Glosario</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {informe.glosario.map((g, i) => (
              <div key={i} className="rounded-lg border p-3">
                <p className="text-sm font-semibold">{g.termino}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{g.definicion}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );

  function FrameConTexto({ archivo }: { archivo: string }) {
    const desc = descIndice.get(archivo);
    const frame = frames.find((f) => f.archivo === archivo);
    const minuto = mmss(frame?.tiempos?.[0] ?? frame?.tiempo ?? 0);
    return (
      <button
        onClick={() => frame && pedirSeek(frame.tiempos?.[0] ?? frame.tiempo)}
        className="group overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/frame/${id}/${encodeURIComponent(archivo)}`}
          alt={desc?.titulo || archivo}
          className="max-h-44 w-full bg-muted object-contain"
        />
        <div className="border-t p-2">
          <p className="text-xs font-semibold group-hover:text-primary">{desc?.titulo || archivo}</p>
          {desc?.texto_visible ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{desc.texto_visible}</p>
          ) : null}
          <p className="mt-1 font-mono text-[10px] text-primary">minuto {minuto}</p>
        </div>
      </button>
    );
  }
}

function GridDiapositivas({
  id,
  frames,
  descripciones,
  pedirSeek,
}: {
  id: string;
  frames: DetalleAnalisis["frames"];
  descripciones: DetalleAnalisis["descripciones"];
  pedirSeek: (t: number) => void;
}) {
  const [soloRelevantes, setSoloRelevantes] = useState(true);
  const descPor = useMemo(() => {
    const m = new Map<string, (typeof descripciones)[number]>();
    for (const d of descripciones) m.set(d.archivo, d);
    return m;
  }, [descripciones]);

  const visibles = frames.filter((f) => {
    if (!soloRelevantes) return true;
    const r = descPor.get(f.archivo)?.relevancia;
    return r === "alta" || r === "media";
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {visibles.length} de {frames.length} capturas
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Solo diapositivas relevantes (ocultar UI de videoconferencia)</span>
          <Switch checked={soloRelevantes} onCheckedChange={setSoloRelevantes} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {visibles.map((f) => {
          const d = descPor.get(f.archivo);
          const t = f.tiempos?.[0] ?? f.tiempo ?? 0;
          return (
            <button
              key={f.archivo}
              onClick={() => pedirSeek(t)}
              className="group overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md"
              title={`Saltar a ${mmss(t)}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/frame/${id}/${encodeURIComponent(f.archivo)}`}
                alt={d?.titulo || f.archivo}
                className="aspect-video w-full bg-muted object-cover"
              />
              <div className="border-t bg-card p-2">
                <p className="truncate text-xs font-medium group-hover:text-primary">
                  {d?.titulo || f.archivo}
                </p>
                <p className="mt-0.5 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>{mmss(t)}</span>
                  {d?.relevancia === "alta" && <span className="text-primary">★ relevante</span>}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
