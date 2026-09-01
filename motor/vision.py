"""Etapa 3 — Cliente de la API de z.ai (compatible OpenAI) para describir frames con visión."""
import base64
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .util import extraer_json, loguear

PROMPT_FRAME = """Eres un asistente que analiza capturas de una clase (diapositivas, pizarra, páginas web proyectadas).
Analiza la imagen y responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional, con esta estructura exacta:
{"tipo": "diapositiva|pizarra|web|video|otro",
 "titulo": "título breve o 'Sin título'",
 "texto_visible": "todo el texto legible en la imagen, transcrito fielmente",
 "bullets": ["puntos clave si es una diapositiva"],
 "formulas": ["fórmulas o código en texto plano"],
 "diagrama": "descripción del diagrama o figura si hay, si no cadena vacía",
 "relevancia": "alta|media|baja"}
Si la imagen es un fotograma suelto de un video proyectado, una transición o algo sin valor de estudio, usa relevancia "baja".
Si la clase es por videoconferencia, IGNORA por completo la interfaz: lista de participantes, cámaras, chat, barras y avisos del sistema (por ejemplo "usted está viendo la pantalla de..." o "escribe el mensaje aquí"). En "texto_visible" transcribe SOLO el contenido de la diapositiva, pizarra o documento compartido; si la captura es mayormente interfaz sin contenido compartido legible, usa relevancia "baja"."""


class ClienteIA:
    def __init__(self, cfg):
        from openai import OpenAI

        self.cfg = cfg
        self.cliente = OpenAI(api_key=cfg.api_key, base_url=cfg.base_url,
                              timeout=240, max_retries=0)

    def _chat(self, modelo: str, contenido, temperatura: float) -> str:
        r = self.cliente.chat.completions.create(
            model=modelo,
            temperature=temperatura,
            messages=[{"role": "user", "content": contenido}],
        )
        return r.choices[0].message.content or ""

    def chat_texto(self, prompt: str, temperatura: float = 0.3) -> str:
        return self._chat(self.cfg.modelo_texto, prompt, temperatura)

    def _con_reintentos(self, fn):
        ultimo = None
        for intento in range(3):
            try:
                return fn()
            except Exception as e:  # red, rate limit o JSON roto: reintentar
                ultimo = e
                time.sleep(2 * (intento + 1))
        raise ultimo

    def describir_frame(self, ruta: Path) -> dict:
        def llamada():
            b64 = base64.b64encode(ruta.read_bytes()).decode()
            contenido = [
                {"type": "text", "text": PROMPT_FRAME},
                {"type": "image_url",
                 "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            ]
            return extraer_json(self._chat(self.cfg.modelo_vision, contenido, 0.1))

        try:
            datos = self._con_reintentos(llamada)
        except Exception as e:
            loguear(f"⚠ no se pudo describir {ruta.name}: {e}")
            return {"archivo": ruta.name, "tipo": "desconocido", "titulo": "Sin descripción",
                    "texto_visible": "", "bullets": [], "formulas": [], "diagrama": "",
                    "relevancia": "baja", "error": str(e)}
        datos["archivo"] = ruta.name
        return datos


def describir_frames(frames: list[dict], carpeta: Path, cliente: ClienteIA,
                     paralelo: int, progreso=None) -> list[dict]:
    rutas = [carpeta / f["archivo"] for f in frames if (carpeta / f["archivo"]).exists()]
    resultados = []
    total = len(rutas)
    with ThreadPoolExecutor(max_workers=max(1, paralelo)) as pool:
        for i, desc in enumerate(pool.map(cliente.describir_frame, rutas), 1):
            resultados.append(desc)
            loguear(f"[{i}/{total}] {desc.get('titulo', '')[:70]}")
            if progreso:
                progreso("vision", "progreso", round(i / total * 100, 1),
                         f"{i}/{total}: {desc.get('titulo', '')[:50]}")
    return resultados
