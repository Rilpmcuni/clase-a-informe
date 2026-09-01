"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Brain,
  CheckCircle2,
  CircleDashed,
  Eye,
  FileText,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Scissors,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EstadoJob } from "@/lib/jobs";

const FASES = [
  { clave: "stt", nombre: "Transcripción de voz", icono: Mic,
    descripcion: "faster-whisper convierte la narración a texto con minutos" },
  { clave: "escenas", nombre: "Diapositivas", icono: Scissors,
    descripcion: "detección de cambios de pantalla y eliminación de repetidos" },
  { clave: "vision", nombre: "Lectura con IA", icono: Eye,
    descripcion: "un modelo de visión lee cada diapositiva única" },
  { clave: "informe", nombre: "Informe de estudio", icono: FileText,
    descripcion: "síntesis final: temas, conceptos, preguntas y examen" },
] as const;

const ICONO_ESTADO: Record<string, typeof CheckCircle2> = {
  pendiente: CircleDashed,
  corriendo: Loader2,
  listo: CheckCircle2,
  omitido: CheckCircle2,
  error: TriangleAlert,
};

const COLOR_ESTADO: Record<string, string> = {
  pendiente: "text-muted-foreground",
  corriendo: "text-primary animate-pulse",
  listo: "text-emerald-600 dark:text-emerald-400",
  omitido: "text-muted-foreground",
  error: "text-destructive",
};

export function VistaProceso({ id }: { id: string }) {
  const [estado, setEstado] = useState<EstadoJob | null>(null);
  const [noHay, setNoHay] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const consola = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/analizar/${id}`);
        if (r.status === 404) {
          if (vivo) setNoHay(true);
          return;
        }
        const j = (await r.json()) as EstadoJob;
        if (vivo) setEstado(j);
        if (j.estado === "corriendo") setTimeout(tick, 1000);
      } catch {
        if (vivo) setTimeout(tick, 2000);
      }
    };
    void tick();
    return () => {
      vivo = false;
    };
  }, [id]);

  useEffect(() => {
    consola.current?.scrollTo({ top: consola.current.scrollHeight });
  }, [estado?.logs?.length]);

  const iniciar = async () => {
    setIniciando(true);
    try {
      const r = await fetch("/api/analizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error || "No se pudo iniciar el análisis");
        return;
      }
      setEstado(j.estado);
      setNoHay(false);
    } finally {
      setIniciando(false);
    }
  };

  if (noHay) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <p className="text-muted-foreground">
          No hay ningún proceso para esta clase. Inicia el análisis:
        </p>
        <Button onClick={iniciar} disabled={iniciando} className="mt-4">
          {iniciando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Iniciar análisis
        </Button>
      </div>
    );
  }

  const listo = estado?.estado === "listo";
  const conError = estado?.estado === "error";
  const corriendo = estado?.estado === "corriendo";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {listo ? "¡Análisis completado!" : conError ? "El análisis terminó con errores" : "Procesando tu clase…"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {corriendo
              ? "Puedes cerrar la página: el proceso sigue en el servidor y el resultado queda guardado."
              : listo
                ? "Todo el material quedó guardado y listo para estudiar."
                : "Revisa el registro de abajo para ver qué pasó."}
          </p>
        </div>
        <Brain className="h-10 w-10 text-primary/20" />
      </div>

      <div className="space-y-3">
        {FASES.map((fase, i) => {
          const f = estado?.fases[fase.clave];
          const est = f?.estado ?? "pendiente";
          const Icono = ICONO_ESTADO[est] ?? CircleDashed;
          return (
            <div key={fase.clave} className="flex gap-4 rounded-xl border bg-card p-4">
              <div className="flex flex-col items-center">
                <Icono className={cn("h-5 w-5", COLOR_ESTADO[est], est === "corriendo" && "animate-spin")} />
                {i < FASES.length - 1 && <div className="mt-2 w-px flex-1 bg-border" />}
              </div>
              <div className="flex-1 pb-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{fase.nombre}</p>
                  {est === "omitido" && <Badge variant="secondary">ya estaba hecho</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {f?.detalle || fase.descripcion}
                </p>
                {est === "corriendo" && typeof f?.pct === "number" && (
                  <Progress value={f.pct} className="mt-2 h-1.5" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {estado?.logs?.length ? (
        <div
          ref={consola}
          className="mt-6 h-40 overflow-y-auto rounded-xl border bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-300"
        >
          {estado.logs.map((l, i) => (
            <p key={i} className={l.startsWith("[err]") ? "text-red-400" : ""}>
              {l}
            </p>
          ))}
        </div>
      ) : null}

      {listo && (
        <div className="mt-8 text-center">
          <Button asChild size="lg">
            <Link href={`/clase/${id}`}>
              <Play className="mr-2 h-4 w-4" /> Abrir la clase
            </Link>
          </Button>
        </div>
      )}
      {conError && (
        <div className="mt-8 text-center">
          <Button onClick={iniciar} disabled={iniciando} variant="destructive">
            <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}
