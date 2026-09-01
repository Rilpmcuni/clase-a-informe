import { ZonaSubida } from "@/components/zona-subida";

export default function Nueva() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold">Nueva clase</h1>
      <p className="mb-6 mt-1 text-muted-foreground">
        Sube el video de la clase. El motor hace el resto: voz → texto, detección de diapositivas,
        lectura con IA y el informe final.
      </p>
      <ZonaSubida />
      <p className="mt-4 text-xs text-muted-foreground">
        Todo se guarda localmente en la carpeta .data del proyecto. Nada sale a internet salvo las
        llamadas de IA a tu proveedor configurado.
      </p>
    </div>
  );
}
