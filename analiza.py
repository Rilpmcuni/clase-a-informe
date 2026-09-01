#!/usr/bin/env python3
"""analiza.py — Motor de análisis de clases grabadas.

Convierte un video de clase (grabado por ejemplo con ShareX) en un informe de
estudio completo: transcripción de la voz, diapositivas detectadas
automáticamente y material generado con IA (z.ai).

Uso:
    python analiza.py CLASE.mp4
    python analiza.py CLASE.mp4 --sin-ia          # solo transcripción + frames
    python analiza.py CLASE.mp4 -o MI_CARPETA     # carpeta de salida
"""
import argparse
import json
import sys
import time
from pathlib import Path

from motor.config import desde_args
from motor.util import fase, ffprobe_segundos, guardar_json, leer_json, loguear, mmss


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Convierte un video de clase en un informe de estudio.")
    p.add_argument("video", help="ruta al video (mp4, mkv, …)")
    p.add_argument("-o", "--salida", help="carpeta de salida (por defecto: <video>_analisis)")
    p.add_argument("--progreso", action="store_true",
                   help="emitir eventos JSON línea a línea (para interfaces)")
    p.add_argument("--idioma", default="es", help="idioma de la clase: es, en, auto… (default: es)")
    p.add_argument("--whisper-modelo", default="small",
                   help="modelo whisper: tiny, base, small, medium, large-v3 (default: small)")
    p.add_argument("--umbral", type=float, default=27.0,
                   help="sensibilidad del detector de escenas, menor = más cortes (default: 27)")
    p.add_argument("--muestreo-seg", type=int, default=180,
                   help="segundos entre frames de muestreo para la pizarra, 0 desactiva (default: 180)")
    p.add_argument("--hash-distancia", type=int, default=6,
                   help="distancia de hash para considerar dos frames iguales (default: 6)")
    p.add_argument("--paralelo", type=int, default=4,
                   help="llamadas en paralelo a la API de visión (default: 4)")
    p.add_argument("--sin-stt", action="store_true", help="saltar la transcripción de voz")
    p.add_argument("--sin-vision", action="store_true", help="saltar la descripción de frames")
    p.add_argument("--sin-informe", action="store_true", help="saltar el informe final (IA)")
    p.add_argument("--sin-ia", action="store_true",
                   help="modo offline: solo transcripción + frames (equivale a --sin-vision --sin-informe)")
    p.add_argument("--rehacer", action="store_true", help="reprocesar aunque existan resultados previos")
    return p.parse_args()


def main() -> int:
    args = _parse_args()
    cfg = desde_args(args)

    def emitir(fase_: str, evento: str, pct=None, detalle: str = "") -> None:
        if args.progreso:
            print(json.dumps({"fase": fase_, "evento": evento, "pct": pct,
                              "detalle": detalle}, ensure_ascii=False), flush=True)

    if not cfg.video.exists():
        print(f"ERROR: no existe el video: {cfg.video}")
        return 1
    if cfg.usa_ia and not cfg.api_key:
        print("ERROR: falta ZAI_API_KEY (copia .env.example a .env) o usa --sin-ia")
        return 1
    cfg.salida.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    print(f"\nVideo:  {cfg.video.name} ({mmss(ffprobe_segundos(cfg.video))})")
    print(f"Salida: {cfg.salida}")

    # ── 1/4 Transcripción de voz ──────────────────────────────────────────────
    transcripcion = []
    if not cfg.sin_stt:
        ruta_trans = cfg.salida / "transcripcion.json"
        if ruta_trans.exists() and not cfg.rehacer:
            transcripcion = leer_json(ruta_trans)
            loguear(f"transcripción ya existía ({len(transcripcion)} segmentos)")
            emitir("stt", "omitido", 100, f"{len(transcripcion)} segmentos ya estaban")
        else:
            fase("1/4 Transcripción de voz (faster-whisper)")
            loguear(f"modelo: {cfg.whisper_modelo} · idioma: {cfg.idioma}"
                    f" (la primera vez descarga el modelo, ten paciencia)")
            emitir("stt", "inicio", 0, f"modelo {cfg.whisper_modelo}")
            from motor.transcripcion import transcribir
            transcripcion = transcribir(cfg.video, cfg, progreso=emitir)
            guardar_json(ruta_trans, transcripcion)
            loguear(f"{len(transcripcion)} segmentos → transcripcion.json")
            emitir("stt", "fin", 100, f"{len(transcripcion)} segmentos")
    else:
        loguear("transcripción desactivada (--sin-stt)")
        emitir("stt", "omitido", 100, "desactivada")

    # ── 2/4 Escenas, frames y deduplicación ──────────────────────────────────
    fase("2/4 Diapositivas (PySceneDetect + hash perceptual)")
    emitir("escenas", "inicio", 0)
    from motor.escenas import etapa_escenas
    frames_unicos = etapa_escenas(cfg.video, cfg, cfg.salida)
    emitir("escenas", "fin", 100, f"{len(frames_unicos)} diapositivas únicas")

    # ── 3/4 Visión (describir cada diapositiva única) ─────────────────────────
    descripciones = []
    if not cfg.sin_vision:
        ruta_desc = cfg.salida / "descripciones.json"
        if ruta_desc.exists() and not cfg.rehacer:
            descripciones = leer_json(ruta_desc)
            loguear(f"descripciones ya existían ({len(descripciones)})")
        elif not frames_unicos:
            loguear("no hay frames que describir")
        else:
            fase(f"3/4 Visión ({cfg.modelo_vision} en z.ai)")
            emitir("vision", "inicio", 0, cfg.modelo_vision)
            from motor.vision import ClienteIA, describir_frames
            cliente = ClienteIA(cfg)
            descripciones = describir_frames(frames_unicos, cfg.salida / "frames",
                                             cliente, cfg.paralelo, progreso=emitir)
            guardar_json(ruta_desc, descripciones)
            emitir("vision", "fin", 100, f"{len(descripciones)} frames")
    else:
        loguear("visión desactivada (--sin-vision)")
        emitir("vision", "omitido", 100, "desactivada")

    # ── 4/4 Informe final ─────────────────────────────────────────────────────
    informe_md = None
    if not cfg.sin_informe:
        if not transcripcion or not descripciones:
            loguear("sin transcripción o sin descripciones: no se puede generar el informe")
        else:
            fase(f"4/4 Informe de estudio ({cfg.modelo_texto} en z.ai)")
            emitir("informe", "inicio", 0, cfg.modelo_texto)
            from motor.informe import generar_informe
            informe_md = generar_informe(cfg, transcripcion, frames_unicos,
                                         descripciones, progreso=emitir)
            emitir("informe", "fin", 100)
    else:
        loguear("informe desactivado (--sin-informe)")
        emitir("informe", "omitido", 100, "desactivado")

    # ── Resumen ────────────────────────────────────────────────────────────────
    print(f"\n=== Listo en {int(time.time() - t0)} s ===")
    for ruta, desc in [
        (cfg.salida / "transcripcion.json", f"{len(transcripcion)} segmentos de voz"),
        (cfg.salida / "frames_unicos.json", f"{len(frames_unicos)} diapositivas únicas"),
        (cfg.salida / "descripciones.json", f"{len(descripciones)} frames descritos"),
        (informe_md, "informe de estudio"),
    ]:
        if ruta and Path(ruta).exists():
            print(f"  ✓ {ruta}  ({desc})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
