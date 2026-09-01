import Link from "next/link";
import { BookOpenCheck, Sparkles, Video } from "lucide-react";
import { ZonaSubida } from "@/components/zona-subida";
import { TarjetaAnalisis } from "@/components/tarjeta-analisis";
import { listar } from "@/lib/analisis";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const analisis = listar();

  return (
    <div>
      <section className="fondo-cuaderno border-b">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="mb-6 max-w-2xl">
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent-foreground">
              <Sparkles className="h-3.5 w-3.5" /> De video de clase a material de estudio
            </p>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              Suelta tu clase.
              <br />
              Recíbela{" "}
              <span className="text-primary">lista para estudiar</span>.
            </h1>
            <p className="mt-3 text-muted-foreground">
              Transcripción con minutos, diapositivas detectadas automáticamente, informe con
              preguntas de examen, flashcards y un tutor de IA que vio toda la clase.
            </p>
          </div>
          <div className="max-w-xl">
            <ZonaSubida />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-4 flex items-center gap-2">
          <BookOpenCheck className="h-4 w-4 text-primary" />
          <h2 className="font-display font-semibold">Tus clases ({analisis.length})</h2>
        </div>
        {analisis.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            <Video className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p>Todavía no hay clases. Sube tu primer video arriba.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {analisis.map((a) => (
              <TarjetaAnalisis key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        <p>
          Clase a Informe · motor local (faster-whisper + PySceneDetect) + IA z.ai ·{" "}
          <Link href="/ajustes" className="underline hover:text-primary">
            configura tu API key
          </Link>
        </p>
      </footer>
    </div>
  );
}
