"use client";

import { useEffect, useState } from "react";
import { Brain, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function MemoriaPage() {
  const [contenido, setContenido] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/memoria");
      const j = await r.json();
      setContenido(j.contenido ?? "");
      setCargando(false);
    })();
  }, []);

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await fetch("/api/memoria", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido }),
      });
      if (r.ok) toast.success("Memoria guardada");
      else toast.error("No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Brain className="h-5 w-5 text-primary" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">Memoria del asistente</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            La app aprende sola: cada vez que terminas de analizar una clase, deja una nota aquí.
            El chat de cada clase lee esta memoria para contestarte con contexto de todo tu historial.
            También puedes escribir a mano lo que quieras que recuerde (formato libre, markdown).
          </p>
        </div>
      </div>

      {cargando ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <Textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            className="min-h-[55vh] font-mono text-sm"
            placeholder="# Memoria del asistente…"
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Guardado en <code className="rounded bg-muted px-1">.data/memoria/MEMORIA.md</code>
            </p>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar memoria
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
