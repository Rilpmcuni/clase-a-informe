import { notFound } from "next/navigation";
import { VistaClase } from "@/components/vista-clase";
import { detalle, existeAnalisis } from "@/lib/analisis";
import { validarId } from "@/lib/raiz";

export const dynamic = "force-dynamic";

export default async function ClasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!validarId(id) || !existeAnalisis(id)) notFound();
  return <VistaClase detalle={detalle(id)} />;
}
