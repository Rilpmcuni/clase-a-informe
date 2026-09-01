"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Download,
  FileText,
  ListVideo,
  Loader2,
  MessageCircle,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

export function VistaClase({ detalle }: { detalle: DetalleAnalisis }) {
  const { id, informe, transcripcion, frames, descripciones, meta } = detalle;
  const videoRef = useRef<HTMLVideoElement>(null);
  const listaTransRef = useRef<HTMLDivElement>(null);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const grande = usarPantallaGrande();

  const tiempo = useReproductor((s) => s.tiempo);
  const seekPendiente = useReproductor((s) => s.seekPendiente);
  const pedirSeek = useReproductor((s) => s.pedirSeek);
  const consumirSeek = useReproductor((s) => s.consumirSeek);
  const setSeleccion = useAdjuntosChat((s) => s.setSeleccion);
  const setCaptura = useAdjuntosChat((s) => s.setCaptura);

  // aplicar seeks que pida cualquier parte de la UI
  useEffect(() => {
    const v = videoRef.current;
    if (!v || seekPendiente == null) return;
    v.currentTime = Math.min(seekPendiente, v.duration || seekPendiente);
    consumirSeek();
    void v.play().catch(() => {});
  }, [seekPendiente, consumirSeek]);

  const descIndice = useMemo(() => {
    const m = new Map<string, (typeof descripciones)[number]>();
    for (const d of descripciones) m.set(d.archivo, d);
    return m;
  }, [descripciones]);

  const indiceActivo = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < transcripcion.length; i++) {
      if (transcripcion[i].inicio <= tiempo + 0.05) idx = i;
      else break;
    }
    return idx;
  }, [transcripcion, tiempo]);

  // auto-scroll de la transcripción al segmento activo
  useEffect(() => {
    if (indiceActivo < 0 || !listaTransRef.current) return;
    const el = listaTransRef.current.querySelector(`[data-seg="${indiceActivo}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [indiceActivo]);

  const capturarFotograma = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCaptura(dataUrl, v.currentTime);
  }, [setCaptura]);

  // el botón de captura del chat dispara este evento global
  useEffect(() => {
    const handler = () => capturarFotograma();
    window.addEventListener("capturar-fotograma", handler);
    return () => window.removeEventListener("capturar-fotograma", handler);
  }, [capturarFotograma]);

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
      <div className="relative overflow-hidden rounded-xl border bg-black shadow-md">
        <video
          ref={videoRef}
          src={`/api/video/${id}`}
          controls
          playsInline
          className="aspect-video w-full"
          onTimeUpdate={(e) => useReproductor.getState().setTiempo(e.currentTarget.currentTime)}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={capturarFotograma}>
          <Camera className="mr-1.5 h-3.5 w-3.5" /> Capturar fotograma para el chat
        </Button>
        {meta?.duracion ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {mmss(meta.duracion)} · {meta.ancho}×{meta.alto}
          </span>
        ) : null}
      </div>
      {informe?.temas?.length ? barraTemas : null}
    </div>
  );

  const pestanas = (
    <Tabs defaultValue="informe" className="flex h-full flex-col gap-0">
      <TabsList className="mx-3 mt-3 grid w-auto grid-cols-4">
        <TabsTrigger value="informe" className="gap-1.5"><FileText className="h-3.5 w-3.5" /><span className="hidden md:inline">Informe</span></TabsTrigger>
        <TabsTrigger value="transcripcion" className="gap-1.5"><ScrollText className="h-3.5 w-3.5" /><span className="hidden md:inline">Voz</span></TabsTrigger>
        <TabsTrigger value="diapositivas" className="gap-1.5"><ListVideo className="h-3.5 w-3.5" /><span className="hidden md:inline">Slides</span></TabsTrigger>
        <TabsTrigger value="chat" className="gap-1.5"><MessageCircle className="h-3.5 w-3.5" />Chat</TabsTrigger>
      </TabsList>

      <TabsContent value="informe" className="mt-0 flex-1 overflow-y-auto p-4">
        {informe ? (
          <InformeRender informe={informe} id={id} frames={frames} descIndice={descIndice} pedirSeek={pedirSeek} />
        ) : (
          <p className="text-sm text-muted-foreground">Aún no hay informe para esta clase.</p>
        )}
      </TabsContent>

      <TabsContent value="transcripcion" className="mt-0 flex-1 overflow-hidden">
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

      <TabsContent value="diapositivas" className="mt-0 flex-1 overflow-y-auto p-4">
        <GridDiapositivas id={id} frames={frames} descripciones={descripciones} pedirSeek={pedirSeek} />
      </TabsContent>

      <TabsContent value="chat" className="mt-0 flex-1 overflow-hidden">
        <PanelChat idClase={id} />
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="mx-auto max-w-[1700px] px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
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
          className="min-h-[calc(100vh-160px)] rounded-xl border bg-card"
        >
          <ResizablePanel defaultSize="56" minSize="32">
            <div className="h-full overflow-y-auto p-4">
              {reproductor}
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
                <div key={j} className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-sm font-semibold text-primary">{c.termino}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.definicion}</p>
                </div>
              ))}
            </div>
          ) : null}

          {t.preguntas?.length ? (
            <Accordion type="single" collapsible className="rounded-lg border px-4">
              <AccordionItem value="qa" className="border-0">
                <AccordionTrigger className="text-sm font-semibold">
                  Preguntas y respuestas de la clase ({t.preguntas.length})
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {t.preguntas.map((p, j) => (
                    <div key={j} className="border-l-2 border-primary/40 pl-3">
                      <p className="text-sm font-semibold">{p.pregunta}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{p.respuesta}</p>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}

          {t.datos_curiosos?.length ? (
            <ul className="space-y-1 rounded-lg border border-accent/40 bg-accent/20 p-3">
              {t.datos_curiosos.map((c, j) => (
                <li key={j} className="flex gap-2 text-sm text-accent-foreground">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {c}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      {informe.examen?.length ? (
        <section className="space-y-2">
          <h2 className="font-display font-semibold">Posibles preguntas de examen</h2>
          <Accordion type="single" collapsible>
            {informe.examen.map((p, i) => (
              <AccordionItem key={i} value={`ex-${i}`}>
                <AccordionTrigger className="text-left text-sm">
                  <span className="mr-2 text-primary">{i + 1}.</span> {p.pregunta}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {p.respuesta}
                </AccordionContent>
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
  const [soloRelevantes, setSoloRelevantes] = useState(false);
  const relevancia = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of descripciones) m.set(d.archivo, d.relevancia ?? "");
    return m;
  }, [descripciones]);
  const titulos = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of descripciones) m.set(d.archivo, d.titulo ?? d.archivo);
    return m;
  }, [descripciones]);

  const lista = soloRelevantes
    ? frames.filter((f) => ["alta", "media"].includes(relevancia.get(f.archivo) ?? ""))
    : frames;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Switch id="solo-relevantes" checked={soloRelevantes} onCheckedChange={setSoloRelevantes} />
        <Label htmlFor="solo-relevantes" className="text-sm">
          Solo diapositivas relevantes (ocultar UI de videoconferencia)
        </Label>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {lista.map((f) => (
          <button
            key={f.archivo}
            onClick={() => pedirSeek(f.tiempos?.[0] ?? f.tiempo)}
            className="group overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/frame/${id}/${encodeURIComponent(f.archivo)}`}
              alt={titulos.get(f.archivo) || f.archivo}
              className="aspect-video w-full bg-muted object-contain"
            />
            <div className="border-t p-2">
              <p className="truncate text-xs font-medium group-hover:text-primary">
                {titulos.get(f.archivo)}
              </p>
              <p className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                {mmss(f.tiempos?.[0] ?? f.tiempo)}
                {f.veces > 1 ? <span>· ×{f.veces}</span> : null}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
