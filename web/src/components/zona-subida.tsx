"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ZonaSubida({ compacto = false }: { compacto?: boolean }) {
  const [encima, setEncima] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [pct, setPct] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const subir = useCallback(
    (archivo: File) => {
      setSubiendo(true);
      setPct(0);
      const datos = new FormData();
      datos.append("video", archivo);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/subir");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        setSubiendo(false);
        try {
          const resp = JSON.parse(xhr.responseText);
          if (xhr.status === 200 && resp.id) {
            toast.success("Video cargado", { description: "Iniciando análisis…" });
            router.push(`/proceso/${resp.id}`);
            void fetch("/api/analizar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: resp.id }),
            });
          } else {
            toast.error(resp.error || "No se pudo subir el video");
          }
        } catch {
          toast.error("Respuesta inválida del servidor");
        }
      };
      xhr.onerror = () => {
        setSubiendo(false);
        toast.error("Error de red al subir");
      };
      xhr.send(datos);
    },
    [router],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        const archivo = e.dataTransfer.files?.[0];
        if (archivo) subir(archivo);
      }}
      onClick={() => !subiendo && entrada.current?.click()}
      className={cn(
        "cursor-pointer rounded-xl border-2 border-dashed text-center transition-all",
        compacto ? "p-6" : "p-12",
        encima
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
      )}
    >
      <input
        ref={entrada}
        type="file"
        accept="video/mp4,video/x-matroska,video/webm,video/quicktime,video/x-msvideo,.mp4,.mkv,.webm,.mov,.avi"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) subir(archivo);
          e.target.value = "";
        }}
      />
      {subiendo ? (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Subiendo video… {pct}%</p>
          <Progress value={pct} />
        </div>
      ) : (
        <>
          <UploadCloud
            className={cn("mx-auto mb-3 text-primary", compacto ? "h-8 w-8" : "h-12 w-12")}
          />
          <p className={cn("font-semibold", compacto ? "text-sm" : "text-lg")}>
            Arrastra tu clase aquí
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            o haz clic para elegir el archivo · mp4, mkv, webm, mov
          </p>
        </>
      )}
    </div>
  );
}
