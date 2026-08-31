"""Configuración del motor: variables de .env + flags de la línea de comandos."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

RAIZ = Path(__file__).resolve().parent.parent


@dataclass
class Config:
    video: Path
    salida: Path
    api_key: str = ""
    base_url: str = "https://api.z.ai/api/paas/v4"
    modelo_vision: str = "glm-4.6v"
    modelo_texto: str = "glm-5.3"
    idioma: str = "es"
    whisper_modelo: str = "small"
    umbral_escena: float = 27.0
    muestreo_seg: int = 180
    hash_distancia: int = 6
    paralelo: int = 4
    sin_stt: bool = False
    sin_vision: bool = False
    sin_informe: bool = False
    rehacer: bool = False

    @property
    def usa_ia(self) -> bool:
        return not self.sin_vision or not self.sin_informe


def desde_args(args) -> Config:
    load_dotenv(RAIZ / ".env")
    video = Path(args.video).expanduser().resolve()
    if args.salida:
        salida = Path(args.salida).expanduser().resolve()
    else:
        salida = video.parent / f"{video.stem}_analisis"
    return Config(
        video=video,
        salida=salida,
        api_key=os.getenv("ZAI_API_KEY", "").strip(),
        base_url=os.getenv("ZAI_BASE_URL", "https://api.z.ai/api/paas/v4").strip(),
        modelo_vision=os.getenv("MODELO_VISION", "glm-4.6v").strip(),
        modelo_texto=os.getenv("MODELO_TEXTO", "glm-5.3").strip(),
        idioma=args.idioma,
        whisper_modelo=args.whisper_modelo,
        umbral_escena=args.umbral,
        muestreo_seg=args.muestreo_seg,
        hash_distancia=args.hash_distancia,
        paralelo=args.paralelo,
        sin_stt=args.sin_stt or args.sin_ia,
        sin_vision=args.sin_vision or args.sin_ia,
        sin_informe=args.sin_informe or args.sin_ia,
        rehacer=args.rehacer,
    )
