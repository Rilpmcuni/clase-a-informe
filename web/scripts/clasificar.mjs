// Clasifica análisis existentes: materia y profesor vía IA (glm-5.3-flash).
// Uso: node scripts/clasificar.mjs <id>   (desde web/)
// Escribe "materia" y "profesor" dentro de informe.json sin tocar lo demás.
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(process.cwd(), "..");
const BASE_ANALISIS = path.join(RAIZ, ".data", "analisis");

const leer = (ruta) => {
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf8"));
  } catch {
    return null;
  }
};

async function main() {
  const config = leer(path.join(RAIZ, ".data", "config.json"));
  if (!config?.apiKey) throw new Error("no hay API key en .data/config.json");
  const baseUrl = (config.baseUrl || "https://api.z.ai/api/coding/paas/v4").replace(/\/$/, "");

  const ids = process.argv[2]
    ? [process.argv[2]]
    : fs.readdirSync(BASE_ANALISIS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);

  for (const id of ids) {
    const dir = path.join(BASE_ANALISIS, id);
    const informe = leer(path.join(dir, "informe.json"));
    if (!informe) {
      console.log(`${id}: sin informe, se salta`);
      continue;
    }
    if (informe.materia && informe.profesor) {
      console.log(`${id}: ya clasificado (${informe.materia} · ${informe.profesor})`);
      continue;
    }
    const voz = leer(path.join(dir, "transcripcion.json")) ?? [];
    const muestraVoz = voz.slice(0, 40).map((s) => s.texto).join(" ").slice(0, 5000);
    const prompt = `A partir de este material de una clase grabada, identifica la asignatura y el nombre del profesor si se menciona.
Responde EXCLUSIVAMENTE con un JSON válido: {"materia": "asignatura (ej: Matemática, Historia, Economía) o null", "profesor": "nombre o null"}

Resumen de la clase: ${informe.resumen_ejecutivo}

Primeros minutos de la voz del profesor: ${muestraVoz}`;

    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modeloTexto || "glm-5.3-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });
    if (!r.ok) {
      console.error(`${id}: error HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      continue;
    }
    const j = await r.json();
    const texto = j.choices?.[0]?.message?.content ?? "";
    const m = texto.match(/\{[\s\S]*\}/);
    if (!m) {
      console.error(`${id}: respuesta sin JSON: ${texto.slice(0, 150)}`);
      continue;
    }
    const { materia, profesor } = JSON.parse(m[0]);
    informe.materia = materia || null;
    informe.profesor = profesor || null;
    fs.writeFileSync(path.join(dir, "informe.json"), JSON.stringify(informe, null, 2));
    console.log(`${id}: ${informe.materia ?? "—"} · ${informe.profesor ?? "—"}`);
  }
}

main().catch((e) => {
  console.error("CLASIFICAR_ERROR " + (e?.message || e));
  process.exit(1);
});
