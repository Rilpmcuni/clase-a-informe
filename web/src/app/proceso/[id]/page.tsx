import { VistaProceso } from "@/components/vista-proceso";

export default async function ProcesoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VistaProceso id={id} />;
}
