"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { EsquemaConfig } from "@/lib/esquema-config";

type ValoresEntrada = z.input<typeof EsquemaConfig>;
type Valores = z.output<typeof EsquemaConfig>;

export default function AjustesPage() {
  const [probando, setProbando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [tieneKey, setTieneKey] = useState(false);

  const formulario = useForm<ValoresEntrada, unknown, Valores>({
    resolver: zodResolver(EsquemaConfig),
  });

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/config");
      const cfg = await r.json();
      setTieneKey(Boolean(cfg.tieneApiKey));
      formulario.reset({ ...cfg, apiKey: "" } as ValoresEntrada);
      setCargando(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alEnviar = async (valores: Valores) => {
    const r = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valores),
    });
    if (r.ok) {
      setTieneKey(true);
      toast.success("Ajustes guardados");
      formulario.reset({ ...valores, apiKey: "" });
    } else {
      const j = await r.json();
      toast.error(j.error || "No se pudo guardar");
    }
  };

  const probar = async () => {
    setProbando(true);
    try {
      const r = await fetch("/api/config/probar", { method: "POST" });
      const j = await r.json();
      if (j.ok) toast.success("Conexión OK", { description: `El modelo ${j.modelo} respondió: ${j.respuesta}` });
      else toast.error("Falló la conexión", { description: j.error });
    } finally {
      setProbando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const error = formulario.formState.errors;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-2xl font-bold">Ajustes</h1>
      <p className="mb-6 mt-1 text-muted-foreground">
        Tu configuración vive en <code className="rounded bg-muted px-1">.data/config.json</code>{" "}
        (nunca se sube al git).
      </p>

      <form onSubmit={formulario.handleSubmit(alEnviar)} className="space-y-6">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-display font-semibold">Proveedor de IA (z.ai)</h2>
          <div className="space-y-1.5">
            <Label htmlFor="apiKey">
              API key {tieneKey ? <span className="text-emerald-600">(configurada, deja vacío para conservar)</span> : null}
            </Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={tieneKey ? "••••••••••••" : "Pega tu API key de z.ai"}
              {...formulario.register("apiKey")}
            />
            {error.apiKey ? <p className="text-xs text-destructive">{error.apiKey.message}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input id="baseUrl" {...formulario.register("baseUrl")} />
            <p className="text-xs text-muted-foreground">
              Keys del GLM Coding Plan: https://api.z.ai/api/coding/paas/v4 · API por consumo: https://api.z.ai/api/paas/v4
            </p>
            {error.baseUrl ? <p className="text-xs text-destructive">{error.baseUrl.message}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="modeloVision">Modelo de visión</Label>
              <Input id="modeloVision" {...formulario.register("modeloVision")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="modeloTexto">Modelo de texto</Label>
              <Input id="modeloTexto" {...formulario.register("modeloTexto")} />
            </div>
          </div>
          <Button type="button" variant="outline" onClick={probar} disabled={probando}>
            {probando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
            Probar conexión
          </Button>
        </section>

        <Separator />

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-display font-semibold">Motor de análisis</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Modelo whisper (voz a texto)</Label>
              <Select
                value={formulario.watch("whisperModelo")}
                onValueChange={(v) => formulario.setValue("whisperModelo", v as Valores["whisperModelo"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tiny">tiny · rapidísimo, meh</SelectItem>
                  <SelectItem value="base">base · rápido</SelectItem>
                  <SelectItem value="small">small · recomendado</SelectItem>
                  <SelectItem value="medium">medium · mejor</SelectItem>
                  <SelectItem value="large-v3">large-v3 · el mejor, lento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Idioma</Label>
              <Select
                value={formulario.watch("idioma")}
                onValueChange={(v) => formulario.setValue("idioma", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="en">Inglés</SelectItem>
                  <SelectItem value="auto">Detectar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="umbral">Umbral de corte de escenas (default 27)</Label>
              <Input id="umbral" type="number" step="0.5" {...formulario.register("umbral")} />
              <p className="text-xs text-muted-foreground">Bájalo si se escapan cambios de diapositiva.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="muestreoSeg">Muestreo para pizarra (segundos, 0 = off)</Label>
              <Input id="muestreoSeg" type="number" {...formulario.register("muestreoSeg")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paralelo">Llamadas de visión en paralelo</Label>
              <Input id="paralelo" type="number" {...formulario.register("paralelo")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hashDistancia">Distancia de deduplicación de frames</Label>
              <Input id="hashDistancia" type="number" {...formulario.register("hashDistancia")} />
            </div>
          </div>
        </section>

        <Button type="submit" className="w-full" disabled={formulario.formState.isSubmitting}>
          {formulario.formState.isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Guardar ajustes
        </Button>
      </form>
    </div>
  );
}
