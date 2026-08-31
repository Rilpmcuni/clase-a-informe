"""Utilidades compartidas: ffmpeg, JSON, tiempos y extracción de JSON de respuestas LLM."""
import json
import subprocess
from pathlib import Path


def mmss(segundos: float) -> str:
    s = int(segundos)
    return f"{s // 60:02d}:{s % 60:02d}"


def loguear(mensaje: str) -> None:
    print(f"  · {mensaje}", flush=True)


def fase(nombre: str) -> None:
    print(f"\n=== {nombre} ===", flush=True)


def run_ffmpeg(args: list[str]) -> None:
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args],
        capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg falló: {proc.stderr.strip()[:500]}")


def ffprobe_segundos(video: Path) -> float:
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(video)],
        capture_output=True, text=True)
    try:
        return float(proc.stdout.strip())
    except ValueError:
        return 0.0


def extraer_frame(video: Path, tiempo: float, destino: Path, ancho_max: int = 1600) -> None:
    """Saca un frame del video en `tiempo` (segundos), reescalado para no gastar tokens de más."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    run_ffmpeg([
        "-ss", f"{tiempo:.3f}", "-i", str(video),
        "-frames:v", "1", "-vf", f"scale='min({ancho_max},iw)':-2",
        "-q:v", "2", str(destino),
    ])


def guardar_json(ruta: Path, datos) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")


def leer_json(ruta: Path):
    return json.loads(ruta.read_text(encoding="utf-8"))


def extraer_json(texto: str):
    """Extrae el primer objeto JSON válido de una respuesta LLM (tolera vallas ```json)."""
    texto = texto.strip()
    if texto.startswith("```"):
        texto = texto.split("```")[1]
        if texto.startswith("json"):
            texto = texto[4:]
        texto = texto.strip()
    try:
        return json.loads(texto)
    except json.JSONDecodeError:
        pass
    ini = texto.find("{")
    if ini == -1:
        raise ValueError("La respuesta no contiene JSON")
    profundidad, en_cadena, escape = 0, False, False
    for i in range(ini, len(texto)):
        c = texto[i]
        if en_cadena:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == '"':
                en_cadena = False
        elif c == '"':
            en_cadena = True
        elif c == "{":
            profundidad += 1
        elif c == "}":
            profundidad -= 1
            if profundidad == 0:
                return json.loads(texto[ini:i + 1])
    raise ValueError("JSON incompleto en la respuesta del modelo")
