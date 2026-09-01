"""Etapa 1 — Voz a texto local con faster-whisper, con marcas de tiempo por segmento."""
from pathlib import Path

from .config import Config


def transcribir(video: Path, cfg: Config, progreso=None) -> list[dict]:
    from faster_whisper import WhisperModel

    from .util import ffprobe_segundos

    modelo = WhisperModel(cfg.whisper_modelo, device="auto", compute_type="auto")
    idioma = None if cfg.idioma == "auto" else cfg.idioma
    duracion = ffprobe_segundos(video) or None
    segmentos, _ = modelo.transcribe(
        str(video),
        language=idioma,
        vad_filter=True,  # recorta silencios: menos basura y menos alucinaciones
    )
    resultado = []
    n = 0
    for s in segmentos:
        n += 1
        if s.text.strip():
            resultado.append({"inicio": round(s.start, 2), "fin": round(s.end, 2),
                              "texto": s.text.strip()})
        if progreso and duracion:
            progreso("stt", "progreso", min(99.0, round(s.end / duracion * 100, 1)),
                     f"segmento {n}")
    return resultado
