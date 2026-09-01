"""Etapa 4 — Informe de estudio: fusiona transcripción + diapositivas y genera el documento.

Estrategia map-reduce para soportar clases largas sin reventar el contexto:
1. Se corta la cronología (voz + visual) en fragmentos y el LLM resume cada uno.
2. Con todas las partes parciales, una llamada final consolida el informe.
3. Python (no el LLM) arma el Markdown, para incrustar las diapositivas donde toca.
"""
from pathlib import Path

from .util import extraer_json, guardar_json, loguear, mmss

MAX_CHARS_FRAGMENTO = 14000

PROMPT_PARCIAL = """Eres un profesor experto que prepara material de estudio a partir de una clase grabada (voz transcrita + contenido visual de diapositivas/pizarra).
Con el siguiente fragmento de clase, responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional:
{"tema": "título del tema tratado en este fragmento",
 "resumen": "resumen didáctico y completo (varios párrafos si hace falta), explicando como a un estudiante",
 "conceptos": [{"termino": "", "definicion": ""}],
 "preguntas": [{"pregunta": "", "respuesta": ""}],
 "datos_curiosos": ["datos, anécdotas o curiosidades mencionadas en la clase"],
 "frames": ["nombres de archivo de las diapositivas importantes de este fragmento, tal cual aparecen"]}
Si el fragmento es continuación del mismo tema, repite el tema en "tema".

FRAGMENTO DE CLASE:
{contenido}"""

PROMPT_FINAL = """Eres un profesor experto. Con las partes parciales de una clase (JSON), genera el material de estudio final consolidado.
Fusiona los temas que se repitan, elimina duplicados y mantén el orden cronológico.
Responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional:
{"titulo": "título de la clase",
 "resumen_ejecutivo": "5-10 frases con la esencia de toda la clase",
 "temas": [{"tema": "", "duracion": "ej: 00:05-00:20", "resumen": "",
            "conceptos": [{"termino": "", "definicion": ""}],
            "preguntas": [{"pregunta": "", "respuesta": ""}],
            "datos_curiosos": [""],
            "frames": ["frame_0001.jpg"]}],
 "examen": [{"pregunta": "posible pregunta de examen", "respuesta": "", "tema": ""}],
 "glosario": [{"termino": "", "definicion": ""}]}

PARTES PARCIALES:
{partes}"""


def _lineas_cronologia(transcripcion: list[dict], frames_unicos: list[dict],
                       descripciones: list[dict]) -> list[str]:
    desc_por_archivo = {d["archivo"]: d for d in descripciones}
    eventos = []
    for s in transcripcion:
        eventos.append((s["inicio"], f"[{mmss(s['inicio'])}-{mmss(s['fin'])}] {s['texto']}"))
    for f in frames_unicos:
        d = desc_por_archivo.get(f["archivo"], {})
        if d.get("relevancia") == "baja" and d.get("tipo") in ("video", "desconocido"):
            continue
        bloques = [f"== VISUAL ({f['archivo']}, minuto {mmss(f['tiempo'])}, tipo {d.get('tipo', '?')}) =="]
        if d.get("titulo"):
            bloques.append(f"Título: {d['titulo']}")
        if d.get("texto_visible"):
            bloques.append(f"Texto en pantalla: {d['texto_visible']}")
        if d.get("bullets"):
            bloques.append("Puntos: " + "; ".join(map(str, d["bullets"])))
        if d.get("formulas"):
            bloques.append("Fórmulas/código: " + "; ".join(map(str, d["formulas"])))
        if d.get("diagrama"):
            bloques.append("Diagrama: " + d["diagrama"])
        eventos.append((f["tiempo"], "\n".join(bloques)))
    eventos.sort(key=lambda x: x[0])
    return [texto for _, texto in eventos]


def fragmentar(lineas: list[str], max_chars: int = MAX_CHARS_FRAGMENTO) -> list[str]:
    fragmentos, actual, largo = [], [], 0
    for linea in lineas:
        if actual and largo + len(linea) > max_chars:
            fragmentos.append("\n".join(actual))
            actual, largo = [], 0
        actual.append(linea)
        largo += len(linea)
    if actual:
        fragmentos.append("\n".join(actual))
    return fragmentos


def _llamar_json(cliente, prompt: str) -> dict:
    ultimo = None
    for intento in range(3):
        try:
            return extraer_json(cliente.chat_texto(prompt))
        except Exception as e:
            ultimo = e
    raise ultimo


def generar_informe(cfg, transcripcion: list[dict], frames_unicos: list[dict],
                    descripciones: list[dict], progreso=None) -> Path:
    from .vision import ClienteIA

    cliente = ClienteIA(cfg)
    salida_md = cfg.salida / "informe.md"

    lineas = _lineas_cronologia(transcripcion, frames_unicos, descripciones)
    fragmentos = fragmentar(lineas)
    loguear(f"{len(lineas)} eventos en {len(fragmentos)} fragmento(s)")

    partes = []
    for i, frag in enumerate(fragmentos, 1):
        loguear(f"resumiendo fragmento {i}/{len(fragmentos)}…")
        if progreso:
            progreso("informe", "progreso", round(i / (len(fragmentos) + 1) * 80, 1),
                     f"fragmento {i}/{len(fragmentos)}")
        try:
            parcial = _llamar_json(cliente, PROMPT_PARCIAL.replace("{contenido}", frag))
        except Exception as e:
            loguear(f"⚠ fragmento {i} falló: {e}")
            parcial = {"tema": f"Fragmento {i}", "resumen": frag[:2000],
                       "conceptos": [], "preguntas": [], "datos_curiosos": [], "frames": []}
        parcial["fragmento"] = i
        partes.append(parcial)
    guardar_json(cfg.salida / "partes.json", partes)

    loguear("generando informe final consolidado…")
    if progreso:
        progreso("informe", "progreso", 85.0, "consolidando informe final")
    try:
        final = _llamar_json(cliente, PROMPT_FINAL.replace(
            "{partes}", "\n\n".join(str(p) for p in partes)))
    except Exception as e:
        loguear(f"⚠ no se pudo consolidar el JSON final ({e}); guardo salida cruda")
        salida_md.write_text(
            "# Informe (salida cruda)\n\nEl JSON final falló. Partes parciales:\n\n"
            + "\n\n---\n\n".join(str(p) for p in partes),
            encoding="utf-8")
        return salida_md
    guardar_json(cfg.salida / "informe.json", final)

    salida_md.write_text(
        renderizar_informe_markdown(final, frames_unicos, descripciones, transcripcion),
        encoding="utf-8")
    escribir_transcripcion_md(cfg.salida / "transcripcion.md", final.get("titulo", "Clase"),
                              transcripcion)
    escribir_flashcards(cfg.salida / "flashcards_anki.tsv", final)
    return salida_md


def renderizar_informe_markdown(datos: dict, frames_unicos: list[dict],
                                descripciones: list[dict], transcripcion: list[dict]) -> str:
    desc_por_archivo = {d["archivo"]: d for d in descripciones}
    tiempos = {f["archivo"]: f.get("tiempos", [f.get("tiempo", 0)]) for f in frames_unicos}

    lineas = [
        f"# {datos.get('titulo', 'Clase')}", "",
        f"> Informe de estudio generado automáticamente · {len(frames_unicos)} diapositivas · "
        f"{len(transcripcion)} intervenciones de voz", "",
        "## Resumen ejecutivo", datos.get("resumen_ejecutivo", ""), "",
    ]

    lineas += ["## Temario", ""]
    for i, t in enumerate(datos.get("temas", []), 1):
        dur = t.get("duracion", "")
        lineas.append(f"{i}. **{t.get('tema', '')}**" + (f" · `{dur}`" if dur else ""))
    lineas.append("")

    for i, t in enumerate(datos.get("temas", []), 1):
        dur = t.get("duracion", "")
        lineas += [f"## {i}. {t.get('tema', 'Tema')}" + (f" · `{dur}`" if dur else ""), ""]
        lineas += [t.get("resumen", ""), ""]
        for archivo in t.get("frames", []):
            d = desc_por_archivo.get(archivo, {})
            ts = tiempos.get(archivo, [0])
            minuto = mmss(ts[0]) if ts and isinstance(ts[0], (int, float)) else str(ts)
            titulo = d.get("titulo") or archivo
            lineas += [
                f"![{titulo}](frames/{archivo})",
                f"",
                f"**{titulo}** · minuto {minuto}", "",
            ]
            if d.get("texto_visible"):
                lineas += [f"> {d['texto_visible']}", ""]
        conceptos = t.get("conceptos", [])
        if conceptos:
            lineas += ["### Conceptos clave", ""]
            lineas += [f"- **{c.get('termino', '')}**: {c.get('definicion', '')}"
                       for c in conceptos]
            lineas.append("")
        preguntas = t.get("preguntas", [])
        if preguntas:
            lineas += ["### Preguntas y respuestas de la clase", ""]
            for p in preguntas:
                lineas += [f"**{p.get('pregunta', '')}**", "", p.get("respuesta", ""), ""]
        curiosos = t.get("datos_curiosos", [])
        if curiosos:
            lineas += ["### Datos curiosos", ""]
            lineas += [f"- {c}" for c in curiosos] + [""]

    examen = datos.get("examen", [])
    if examen:
        lineas += ["## Posibles preguntas de examen", ""]
        for i, p in enumerate(examen, 1):
            tema = f" *(tema: {p['tema']})*" if p.get("tema") else ""
            lineas += [f"**{i}. {p.get('pregunta', '')}**{tema}", "",
                       p.get("respuesta", ""), ""]

    glosario = datos.get("glosario", [])
    if glosario:
        lineas += ["## Glosario", ""]
        lineas += [f"- **{g.get('termino', '')}**: {g.get('definicion', '')}" for g in glosario]
        lineas.append("")

    lineas += ["---", "", "*Generado con clase-a-informe (faster-whisper + PySceneDetect + z.ai)*"]
    return "\n".join(lineas)


def escribir_transcripcion_md(ruta: Path, titulo: str, transcripcion: list[dict]) -> None:
    lineas = [f"# Transcripción — {titulo}", ""]
    for s in transcripcion:
        lineas.append(f"**[{mmss(s['inicio'])}]** {s['texto']}")
        lineas.append("")
    ruta.write_text("\n".join(lineas), encoding="utf-8")


def escribir_flashcards(ruta: Path, datos: dict) -> None:
    tarjetas, vistos = [], set()

    def agregar(anverso: str, reverso: str) -> None:
        clave = anverso.strip().lower()
        if clave and clave not in vistos:
            vistos.add(clave)
            tarjetas.append((anverso.replace("\t", " "), reverso.replace("\t", " ")))

    for t in datos.get("temas", []):
        for c in t.get("conceptos", []):
            agregar(c.get("termino", ""), c.get("definicion", ""))
    for g in datos.get("glosario", []):
        agregar(g.get("termino", ""), g.get("definicion", ""))
    for p in datos.get("examen", []):
        agregar(p.get("pregunta", ""), p.get("respuesta", ""))

    lineas = ["#separator:tab", "#html:false"]
    lineas += [f"{a}\t{r}" for a, r in tarjetas]
    ruta.write_text("\n".join(lineas) + "\n", encoding="utf-8")
