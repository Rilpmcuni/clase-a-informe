"""Etapa 1 — Voz a texto local con faster-whisper, con marcas de tiempo por segmento."""
from pathlib import Path

from .config import Config


def transcribir(video: Path, cfg: Config) -> list[dict]:
    from faster_whisper import WhisperModel

    modelo = WhisperModel(cfg.whisper_modelo, device="auto", compute_type="auto")
    idioma = None if cfg.idioma == "auto" else cfg.idioma
    segmentos, _ = modelo.transcribe(
        str(video),
        language=idioma,
        vad_filter=True,  # recorta silencios: menos basura y menos alucinaciones
    )
    return [
        {"inicio": round(s.start, 2), "fin": round(s.end, 2), "texto": s.text.strip()}
        for s in segmentos
        if s.text.strip()
    ]
