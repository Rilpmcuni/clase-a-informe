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

const ETIQUETA_ESTADO: Record<ResumenAnalisis["estado"], { texto: string; clase: string }> = {
  listo: { texto: "Listo", clase: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  corriendo: { texto: "Procesando", clase: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  incompleto: { texto: "Incompleto", clase: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300" },
  error: { texto: "Error", clase: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
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
    <div className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-2">
        <Badge className={estado.clase + " border-transparent"} variant="secondary">
          {estado.texto}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={ocupado}>
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
      <Link href={`/clase/${a.id}`} className="mb-2 flex-1">
        <h3 className="font-display font-semibold leading-snug line-clamp-2 group-hover:text-primary">
          {a.titulo}
        </h3>
      </Link>
      <p className="mb-3 text-xs text-muted-foreground">
        {fechaLegible(a.creado)} · {a.duracion ? mmss(a.duracion) : "—"} · {a.nDiapositivas} diapositivas ·{" "}
        {a.nSegmentos} frases
      </p>
      <div className="flex gap-2">
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
  );
}
