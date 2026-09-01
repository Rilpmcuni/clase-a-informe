import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { existeAnalisis } from "@/lib/analisis";
import { validarId } from "@/lib/raiz";

function rutaPdf(id: string): string {
  return path.join(process.cwd(), "..", ".data", "analisis", id, "informe.pdf");
}

/** POST: genera el PDF con Puppeteer (builder en web/scripts/informe_pdf.mjs). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!validarId(id) || !existeAnalisis(id)) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  return new Promise<Response>((resolve) => {
    const proc = spawn(process.execPath, ["scripts/informe_pdf.mjs", id], {
      cwd: process.cwd(),
    });
    let err = "";
    proc.stdout.on("data", (t: Buffer) => err += t.toString());
    proc.stderr.on("data", (t: Buffer) => err += t.toString());
    proc.on("error", (e) =>
      resolve(NextResponse.json({ ok: false, error: e.message }, { status: 500 })),
    );
    proc.on("close", (codigo) => {
      if (codigo === 0 && fs.existsSync(rutaPdf(id))) {
        resolve(NextResponse.json({ ok: true, ruta: "/api/pdf/" + id }));
      } else {
        resolve(
          NextResponse.json(
            { ok: false, error: (err || "fallo desconocido").slice(-600) },
            { status: 500 },
          ),
        );
      }
    });
  });
}

/** GET: descarga el PDF ya generado. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!validarId(id) || !existeAnalisis(id)) {
    return NextResponse.json({ error: "Análisis no encontrado" }, { status: 404 });
  }
  const ruta = rutaPdf(id);
  if (!fs.existsSync(ruta)) {
    return NextResponse.json(
      { error: "El PDF aún no existe: genéralo primero (POST /api/pdf/" + id + ")" },
      { status: 404 },
    );
  }
  return new Response(fs.readFileSync(ruta), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="informe-${id}.pdf"`,
    },
  });
}
