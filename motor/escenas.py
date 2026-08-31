"""Etapa 2 — Detección de cambios de diapositiva, extracción y deduplicación de frames.

La idea: PySceneDetect encuentra los momentos donde la imagen cambia de verdad
(cambio de diapositiva), se saca un frame de cada uno, y el hash perceptual
elimina las diapositivas que se repiten. Las rachas de escenas muy cortas se
marcan como "video proyectado" (material de relleno que no vale para estudiar).
"""
from pathlib import Path

import imagehash
from PIL import Image

from .util import extraer_frame, ffprobe_segundos, guardar_json, leer_json, loguear

DUR_VIDEO_SEG = 2.5   # escenas más cortas que esto pueden ser parte de un video proyectado
MIN_EN_RACHA = 3      # cuántas escenas cortas seguidas indican "están pasando un video"


def detectar_escenas(video: Path, umbral: float) -> list[dict]:
    from scenedetect import ContentDetector, detect

    escenas = detect(str(video), ContentDetector(threshold=umbral))
    lista = [{"inicio": ini.seconds, "fin": fin.seconds} for ini, fin in escenas]
    if not lista:  # video estático (una sola pizarra toda la clase)
        dur = ffprobe_segundos(video)
        lista = [{"inicio": 0.0, "fin": dur}]
    return lista


def clasificar(escenas: list[dict]) -> None:
    """Marca tipo 'video' en rachas de escenas muy cortas (contenido proyectado)."""
    for e in escenas:
        e["tipo"] = "diapositiva"
    racha: list[int] = []

    def cerrar() -> None:
        if len(racha) >= MIN_EN_RACHA:
            for j in racha:
                escenas[j]["tipo"] = "video"

    for i, e in enumerate(escenas):
        if (e["fin"] - e["inicio"]) < DUR_VIDEO_SEG:
            racha.append(i)
        else:
            cerrar()
            racha = []
    cerrar()


def extraer_frames(video: Path, escenas: list[dict], carpeta: Path,
                   muestreo_seg: int) -> list[dict]:
    """Un frame por escena de diapositiva + muestreo periódico (para la pizarra)."""
    carpeta.mkdir(parents=True, exist_ok=True)
    frames = []
    for i, e in enumerate(escenas):
        if e["tipo"] != "diapositiva":
            continue
        dur = e["fin"] - e["inicio"]
        t = e["inicio"] + min(0.6, dur / 3)
        archivo = carpeta / f"diapositiva_{i:04d}.jpg"
        if not archivo.exists():
            extraer_frame(video, t, archivo)
        frames.append({"archivo": archivo.name, "tiempo": round(t, 2)})
    if muestreo_seg > 0:
        dur_total = escenas[-1]["fin"] if escenas else 0
        paso = max(30, muestreo_seg)
        t, n = 0.0, 0
        while t < dur_total:
            archivo = carpeta / f"muestreo_{n:04d}.jpg"
            if not archivo.exists():
                extraer_frame(video, t, archivo)
            frames.append({"archivo": archivo.name, "tiempo": round(t, 2)})
            t += paso
            n += 1
    frames.sort(key=lambda f: f["tiempo"])
    return frames


def _firma_color(imagen) -> tuple[int, int, int]:
    """Color promedio en cubetas de ~24 niveles: distingue diapositivas planas
    que el phash (solo estructura) no puede separar."""
    pequeña = imagen.convert("RGB").resize((16, 16))
    pixeles = list(pequeña.getdata())
    n = len(pixeles)
    return (sum(p[0] for p in pixeles) // n // 24,
            sum(p[1] for p in pixeles) // n // 24,
            sum(p[2] for p in pixeles) // n // 24)


def _color_cercano(a: tuple[int, int, int], b: tuple[int, int, int]) -> bool:
    return all(abs(x - y) <= 1 for x, y in zip(a, b))


def deduplicar(carpeta: Path, frames: list[dict], distancia: int) -> list[dict]:
    """Quita frames casi idénticos (misma diapositiva repetida): hash perceptual
    para la estructura + firma de color para fondos planos."""
    if not frames:
        return []
    duplicados = carpeta / "duplicados"
    duplicados.mkdir(exist_ok=True)
    grupos: list[dict] = []
    for f in frames:
        h, firma = None, None
        try:
            imagen = Image.open(carpeta / f["archivo"])
            h = imagehash.phash(imagen)
            firma = _firma_color(imagen)
        except Exception:
            pass
        grupo = None
        if h is not None:
            for g in grupos:
                if (g["hash"] is not None and (h - g["hash"]) <= distancia
                        and _color_cercano(firma, g["firma"])):
                    grupo = g
                    break
            else:
                grupo = {"hash": h, "firma": firma, "integrantes": [], "representante": f}
                grupos.append(grupo)
        if grupo is None:  # imagen ilegible: dejarla como única
            grupo = {"hash": None, "firma": None, "integrantes": [], "representante": f}
            grupos.append(grupo)
        grupo["integrantes"].append(f)

    unicos = []
    for g in grupos:
        rep = g["representante"]
        unicos.append({
            **rep,
            "veces": len(g["integrantes"]),
            "tiempos": [m["tiempo"] for m in g["integrantes"]],
        })
        for m in g["integrantes"]:
            if m["archivo"] != rep["archivo"]:
                origen = carpeta / m["archivo"]
                if origen.exists():
                    origen.rename(duplicados / m["archivo"])
    return unicos


def etapa_escenas(video: Path, cfg, carpeta_salida: Path) -> list[dict]:
    """Pipeline completo de la etapa visual; devuelve los frames únicos."""
    ruta_estado = carpeta_salida / "frames_unicos.json"
    if ruta_estado.exists() and not cfg.rehacer:
        unicos = leer_json(ruta_estado)
        loguear(f"frames ya existían ({len(unicos)} únicos)")
        return unicos

    loguear(f"detectando escenas (umbral {cfg.umbral_escena})…")
    escenas = detectar_escenas(video, cfg.umbral_escena)
    clasificar(escenas)
    n_video = sum(1 for e in escenas if e["tipo"] == "video")
    loguear(f"{len(escenas)} escenas ({n_video} marcadas como video proyectado)")
    guardar_json(carpeta_salida / "escenas.json", escenas)

    loguear("extrayendo frames…")
    frames = extraer_frames(video, escenas, carpeta_salida / "frames", cfg.muestreo_seg)
    loguear(f"{len(frames)} frames extraídos, deduplicando…")
    unicos = deduplicar(carpeta_salida / "frames", frames, cfg.hash_distancia)
    guardar_json(ruta_estado, unicos)
    loguear(f"{len(unicos)} diapositivas únicas → frames_unicos.json")
    return unicos
