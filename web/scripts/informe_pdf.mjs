// Builder de PDF: informe de estudio con estilo editorial propio.
// Uso: node scripts/informe_pdf.mjs <id>   (desde web/, con .data en el repo)
// Inspirado en el enfoque HTML+CSS → Puppeteer de reforza-cotizacion-html,
// pero con identidad visual propia para material educativo.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const RAIZ = path.resolve(process.cwd(), "..");
const DIR = (id) => path.join(RAIZ, ".data", "analisis", id);

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const mmss = (seg) => {
  const s = Math.floor(seg || 0);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

function figura(id, archivo, titulo, texto, minuto) {
  if (!archivo) return "";
  const ruta = path.join(DIR(id), "frames", path.basename(archivo));
  if (!fs.existsSync(ruta)) return "";
  // Chrome no resuelve rutas de archivo peladas como src: hace falta file://
  const src = pathToFileURL(ruta).href;
  const textoCorto = texto ? texto.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  const caption = textoCorto
    ? `<figcaption><strong>${esc(titulo || "Diapositiva")}</strong> · minuto ${minuto}<span class="cap-texto">${esc(textoCorto)}</span></figcaption>`
    : `<figcaption><strong>${esc(titulo || "Diapositiva")}</strong> · minuto ${minuto}</figcaption>`;
  return `<figure><img src="${src}" alt="${esc(titulo || archivo)}" />${caption}</figure>`;
}

function bloqueQA(p) {
  return `<div class="qa"><p class="q">${esc(p.pregunta)}</p><p class="r">${esc(p.respuesta)}</p></div>`;
}

function conceptos(conceptos_) {
  if (!conceptos_?.length) return "";
  return `<div class="conceptos">${conceptos_
    .map((c) => `<div class="concepto"><p class="termino">${esc(c.termino)}</p><p>${esc(c.definicion)}</p></div>`)
    .join("")}</div>`;
}

function curiosos(lista) {
  if (!lista?.length) return "";
  return `<div class="curiosos"><p class="subtitillo">Datos curiosos</p><ul>${lista
    .map((c) => `<li>${esc(c)}</li>`)
    .join("")}</ul></div>`;
}

function portada(informe, meta) {
  const fecha = new Date(meta?.creado || Date.now()).toLocaleDateString("es", {
    day: "numeric", month: "long", year: "numeric",
  });
  const dur = meta?.duracion ? mmss(meta.duracion) : "-";
  const chips = [
    `Duración ${dur}`,
    `${informe.temas?.length ?? 0} temas`,
    `${informe.glosario?.length ?? 0} términos`,
  ]
    .map((c) => `<span class="chip">${esc(c)}</span>`)
    .join("");
  const temas = (informe.temas ?? [])
    .map((t, i) => `<li><span class="n">${String(i + 1).padStart(2, "0")}</span>${esc(t.tema)}</li>`)
    .join("");
  return `
  <section class="portada">
    <div class="banda"></div>
    <p class="kicker">Informe de estudio · Clase a Informe</p>
    <h1>${esc(informe.titulo || "Clase")}</h1>
    <div class="regla"></div>
    <div class="chips">${chips}<span class="chip">${fecha}</span></div>
    <ol class="temas-portada">${temas}</ol>
    <p class="pie-portada">Generado automáticamente a partir del video de clase:
      transcripción de voz, diapositivas detectadas y síntesis con IA.</p>
  </section>`;
}

function paginaTema(num, t, id, tiempos, descripciones, yaVistos) {
  const descPor = new Map(descripciones.map((d) => [d.archivo, d]));
  const figuras = (t.frames ?? [])
    .map((archivo) => {
      const d = descPor.get(archivo) || {};
      // solo diapositivas de alta relevancia, y cada una una sola vez en todo el PDF
      if (d.relevancia && d.relevancia !== "alta") return "";
      if (yaVistos.has(archivo)) return "";
      yaVistos.add(archivo);
      const ts = tiempos.get(archivo) ?? [0];
      return figura(id, archivo, d.titulo, d.texto_visible, mmss(ts[0]));
    })
    .join("");
  const preguntas = (t.preguntas ?? []).map(bloqueQA).join("");
  return `
  <section class="tema">
    <header>
      <p class="numero">${String(num).padStart(2, "0")}</p>
      <h2>${esc(t.tema)}</h2>
      ${t.duracion ? `<span class="duracion">${esc(t.duracion)}</span>` : ""}
    </header>
    <p class="resumen">${esc(t.resumen)}</p>
    ${figuras}
    ${conceptos(t.conceptos)}
    ${preguntas ? `<p class="subtitillo">Preguntas y respuestas de la clase</p>${preguntas}` : ""}
    ${curiosos(t.datos_curiosos)}
  </section>`;
}

function css() {
  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; }
  body {
    font-family: "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: #26303e; font-size: 10.5pt; line-height: 1.55;
  }
  h1, h2, h3, .numero, .kicker { font-family: Georgia, "Times New Roman", serif; }

  .portada { page-break-after: always; display: flex; flex-direction: column; min-height: 250mm; }
  .banda { height: 14mm; background: linear-gradient(90deg, #3730a3, #6366f1 55%, #d97706); border-radius: 0 0 4mm 4mm; margin: -14mm -4mm 12mm; }
  .kicker { text-transform: uppercase; letter-spacing: 0.28em; font-size: 8pt; color: #d97706; font-weight: 700; margin-bottom: 8mm; }
  .portada h1 { font-size: 27pt; line-height: 1.18; color: #1e1b4b; font-weight: 700; max-width: 160mm; }
  .regla { width: 32mm; height: 1.6mm; background: #d97706; border-radius: 1mm; margin: 7mm 0 6mm; }
  .chips { display: flex; gap: 3mm; flex-wrap: wrap; }
  .chip { border: 0.4mm solid #e2e0f5; background: #f5f4ff; color: #3730a3; border-radius: 999px; padding: 1.2mm 4mm; font-size: 8.5pt; font-weight: 600; }
  .temas-portada { list-style: none; margin-top: 14mm; }
  .temas-portada li { display: flex; gap: 4mm; align-items: baseline; padding: 3.2mm 0; border-bottom: 0.25mm solid #eceaf8; font-size: 11.5pt; color: #37315a; }
  .temas-portada .n { font-family: Georgia, serif; font-weight: 700; color: #c2410c; font-size: 9pt; }
  .pie-portada { margin-top: auto; padding-top: 8mm; border-top: 0.25mm solid #e5e7eb; color: #6b7280; font-size: 8.5pt; }

  /* Los temas fluyen continuos (con separador fuerte): forzar salto de página
     por tema dejaba páginas finales casi vacías. */
  .tema { margin-top: 11mm; padding-top: 7mm; border-top: 0.8mm solid #3730a3; }
  .tema:first-of-type { margin-top: 2mm; padding-top: 0; border-top: none; }
  .tema header { display: flex; align-items: baseline; gap: 4mm; border-bottom: 0.6mm solid #3730a3; padding-bottom: 3mm; margin-bottom: 5mm; }
  .numero { font-size: 20pt; font-weight: 700; color: #6366f1; }
  .tema h2 { font-size: 16.5pt; color: #1e1b4b; flex: 1; }
  .duracion { font-size: 8.5pt; font-weight: 700; color: #d97706; white-space: nowrap; }
  .resumen { text-align: justify; margin-bottom: 6mm; }

  figure { margin: 5mm 0 6mm; page-break-inside: avoid; }
  figure img { width: 100%; max-height: 88mm; object-fit: contain; border: 0.35mm solid #d6d4ee; border-radius: 2.5mm; background: #f8f8ff; }
  figcaption { font-size: 8.3pt; color: #6b7280; margin-top: 2mm; border-left: 1mm solid #d97706; padding-left: 3mm; }
  .cap-texto { display: block; margin-top: 1mm; color: #4b5563; }

  .subtitillo { font-family: Georgia, serif; font-weight: 700; color: #3730a3; font-size: 11pt; margin: 6mm 0 3mm; }
  .conceptos { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin: 4mm 0; }
  /* 4 columnas: el glosario típico (12-16 términos) cierra en una sola página,
     dejando lugar para la línea de cierre del documento */
  .seccion-glosario .conceptos { grid-template-columns: repeat(4, 1fr); gap: 2.2mm; }
  .seccion-glosario .concepto { padding: 2mm 2.2mm; }
  .seccion-glosario .concepto p { font-size: 7.1pt; }
  .seccion-glosario .concepto .termino { font-size: 8.2pt; }
  .concepto { background: #f7f7fe; border: 0.3mm solid #e4e2f7; border-radius: 2.5mm; padding: 3mm 3.5mm; page-break-inside: avoid; }
  .concepto .termino { font-weight: 700; color: #3730a3; font-size: 9.5pt; margin-bottom: 1mm; }
  .concepto p:last-child { font-size: 9pt; }

  .qa { margin: 3.5mm 0; page-break-inside: avoid; border-left: 1mm solid #6366f1; padding-left: 4mm; }
  .qa .q { font-weight: 700; color: #312e81; }
  .qa .r { color: #374151; margin-top: 1mm; }

  .curiosos { page-break-inside: avoid; }
  .curiosos ul { margin-left: 5mm; }
  .curiosos li { margin: 1.5mm 0; }

  .seccion-examen h2, .seccion-glosario h2 { font-size: 15pt; color: #1e1b4b; border-bottom: 0.6mm solid #d97706; padding-bottom: 2.5mm; margin-bottom: 5mm; }
  .cierre { margin-top: 3mm; padding-top: 3mm; border-top: 0.25mm solid #e5e7eb; color: #6b7280; font-size: 8pt; text-align: center; white-space: nowrap; }
  `;
}

function armarHtml(id, informe, frames, descripciones, meta) {
  const tiempos = new Map(frames.map((f) => [f.archivo, f.tiempos ?? [f.tiempo]]));
  const yaVistos = new Set();
  const temas = (informe.temas ?? [])
    .map((t, i) => paginaTema(i + 1, t, id, tiempos, descripciones, yaVistos))
    .join("");
  const examen = informe.examen?.length
    ? `<section class="seccion-examen"><h2>Posibles preguntas de examen</h2>${informe.examen
        .map((p) => bloqueQA(p))
        .join("")}</section>`
    : "";
  const glosario = informe.glosario?.length
    ? `<section class="seccion-glosario"><h2>Glosario</h2><div class="conceptos">${informe.glosario
        .map((g) => `<div class="concepto"><p class="termino">${esc(g.termino)}</p><p>${esc(g.definicion)}</p></div>`)
        .join("")}</div></section>`
    : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css()}</style></head>
  <body>
    ${portada(informe, meta)}
    ${temas}
    ${examen}
    ${glosario}
    <p class="cierre">Fin del informe · transcripción de voz, diapositivas y síntesis con IA · Clase a Informe</p>
  </body></html>`;
}

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("falta el id del análisis");
  const dir = DIR(id);
  const leer = (n) => JSON.parse(fs.readFileSync(path.join(dir, n), "utf8"));
  const informe = leer("informe.json");
  const frames = (() => {
    try { return leer("frames_unicos.json"); } catch { return []; }
  })();
  const descripciones = (() => {
    try { return leer("descripciones.json"); } catch { return []; }
  })();
  const meta = (() => {
    try { return leer("meta.json"); } catch { return {}; }
  })();

  const html = armarHtml(id, informe, frames, descripciones, meta);
  // El HTML va a disco y se navega con file://: desde about:blank (setContent)
  // Chrome bloquea los subrecursos file:// y las diapositivas salen rotas.
  const rutaHtml = path.join(dir, "informe.html");
  fs.writeFileSync(rutaHtml, html);
  const navegador = await puppeteer.launch({ headless: true });
  try {
    const pagina = await navegador.newPage();
    await pagina.goto(pathToFileURL(rutaHtml).href, {
      waitUntil: "networkidle0",
      timeout: 120_000,
    });
    await pagina.pdf({
      path: path.join(dir, "informe.pdf"),
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "18mm", left: "16mm", right: "16mm" },
      displayHeaderFooter: true,
      headerTemplate: `<div style="width:100%; font-size:7pt; color:#9ca3af; padding:0 16mm; display:flex; justify-content:space-between;">
        <span>Clase a Informe</span><span>${esc((informe.titulo || "").slice(0, 70))}</span></div>`,
      footerTemplate: `<div style="width:100%; font-size:7.5pt; color:#9ca3af; text-align:center;">
        Página <span class="pageNumber"></span> de <span class="totalPages"></span></div>`,
    });
    console.log("PDF_OK " + path.join(dir, "informe.pdf"));
  } finally {
    await navegador.close();
  }
}

main().catch((e) => {
  console.error("PDF_ERROR " + (e?.message || e));
  process.exit(1);
});
