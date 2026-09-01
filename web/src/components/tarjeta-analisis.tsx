"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MoreVertical,
  RefreshCw,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { ResumenAnalisis } from "@/lib/tipos";
import { fechaLegible, mmss } from "@/lib/tiempo";
import { cn } from "@/lib/utils";

const ETIQUETA_ESTADO: Record<ResumenAnalisis["estado"], { texto: string; clase: string }> = {
  listo: { texto: "Listo", clase: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300" },
  corriendo: { texto: "Procesando", clase: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300" },
  incompleto: { texto: "Incompleto", clase: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300" },
  error: { texto: "Error", clase: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300" },
};

export function TarjetaAnalisis({ a }: { a: ResumenAnalisis }) {
  const [ocupado, setOcupado] = useState(false);
  const router = useRouter();
  const estado = ETIQUETA_ESTADO[a.estado];

  const generarPdf = async () => {
    setOcupado(true);
    try {
      const r = await fetch(`/api/pdf/${a.id}`, { method: "POST" });
      const j = await r.json();
      if (j.ok) {
        window.location.href = `/api/pdf/${a.id}`;
        toast.success("PDF generado");
      } else {
        toast.error("No se pudo generar el PDF", { description: j.error });
      }
    } finally {
      setOcupado(false);
    }
  };

  const reanalizar = async () => {
    setOcupado(true);
    try {
      const r = await fetch("/api/analizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, rehacer: true }),
      });
      const j = await r.json();
      if (r.ok) {
        router.push(`/proceso/${a.id}`);
      } else {
        toast.error(j.error || "No se pudo iniciar");
      }
    } finally {
      setOcupado(false);
    }
  };

  const borrar = async () => {
    setOcupado(true);
    try {
      const r = await fetch(`/api/analisis/${a.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conVideo: true }),
      });
      if (r.ok) {
        toast.success("Análisis eliminado");
        router.refresh();
      } else {
        toast.error("No se pudo eliminar");
      }
    } finally {
      setOcupado(false);
    }
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
      {/* carátula de la clase */}
      <div className="relative">
        <Link
          href={`/clase/${a.id}`}
          aria-label={`Abrir ${a.titulo}`}
          className="block aspect-video overflow-hidden bg-muted"
        >
          {a.portada ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/frame/${a.id}/${encodeURIComponent(a.portada)}`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div
              className={cn(
                "flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/25 text-primary/50",
                a.estado === "corriendo" && "animate-pulse",
              )}
            >
              <Video className="h-8 w-8" />
              <span className="text-xs font-medium text-muted-foreground">
                {a.estado === "corriendo" ? "Analizando…" : "Sin vista previa"}
              </span>
            </div>
          )}
        </Link>

        <Badge
          className={cn(
            "absolute left-2.5 top-2.5 border-transparent shadow-sm",
            estado.clase,
          )}
          variant="secondary"
        >
          {a.estado === "corriendo" && (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          )}
          {estado.texto}
        </Badge>

        {a.duracion ? (
          <span className="absolute bottom-2.5 right-2.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
            {mmss(a.duracion)}
          </span>
        ) : null}

        <div className="absolute right-2 top-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 bg-background/70 opacity-0 backdrop-blur transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                disabled={ocupado}
                aria-label="Más opciones"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={reanalizar}>
                <RefreshCw className="mr-2 h-4 w-4" /> Re-analizar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={borrar} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* cuerpo */}
      <div className="flex flex-1 flex-col p-4">
        <Link href={`/clase/${a.id}`}>
          <h3 className="font-display line-clamp-2 min-h-[2.75em] font-semibold leading-snug group-hover:text-primary">
            {a.titulo}
          </h3>
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">
          {fechaLegible(a.creado)} · {a.nTemas} temas · {a.nDiapositivas} diapositivas
        </p>
        <div className="mt-3 flex gap-2 pt-1">
          <Button asChild size="sm" className="flex-1">
            <Link href={`/clase/${a.id}`}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={ocupado || !a.tieneInforme}
            onClick={generarPdf}
            title={a.tienePdf ? "Descargar PDF" : "Generar PDF"}
          >
            {ocupado ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : a.tienePdf ? (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <FileText className="mr-1.5 h-3.5 w-3.5" />
            )}
            PDF
          </Button>
        </div>
      </div>
    </article>
  );
}
