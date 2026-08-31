# clase-a-informe

Convierte un **video de clase grabado** (por ejemplo con ShareX) en un **informe de
estudio completo**, combinando lo que se **dice** y lo que se **muestra**:

- 🎙️ **Transcripción de la voz** con marcas de tiempo — local y gratis (faster-whisper)
- 🖼️ **Detección automática de diapositivas** — solo se extrae un frame por cada
  cambio real de contenido (PySceneDetect + hash perceptual con firma de color)
- 👁️ **Lectura de diapositivas y pizarra** con un modelo de visión (GLM-4.6V vía z.ai)
- 📄 **Informe de estudio final** generado con IA: temario, resúmenes por tema,
  conceptos clave, preguntas y respuestas, datos curiosos, posibles preguntas de
  examen, glosario y flashcards para Anki

100% local salvo las llamadas de visión y redacción (tu API key de z.ai).

## Instalación

Requisitos: **Python 3.10–3.12**, **ffmpeg** en el PATH, y una API key de [z.ai](https://z.ai/model-api).

```bash
# macOS
python3.12 -m venv .venv
source .venv/bin/activate

# Windows (PowerShell)
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

```bash
cp .env.example .env   # y pega tu ZAI_API_KEY dentro
```

> En Windows, si no tienes ffmpeg: `winget install ffmpeg`

## Uso

```bash
python analiza.py MI_CLASE.mp4
```

Eso genera la carpeta `MI_CLASE_analisis/` con:

| Archivo | Contenido |
|---|---|
| `informe.md` | **El informe de estudio** (temario, resúmenes, Q&A, examen, glosario) |
| `flashcards_anki.tsv` | Flashcards listas para importar en Anki (Archivo → Importar) |
| `transcripcion.md` | Transcripción completa con minutos |
| `frames/` | Diapositivas únicas detectadas (`duplicados/` las descartadas) |
| `transcripcion.json`, `frames_unicos.json`, `descripciones.json`, `partes.json`, `informe.json` | Estados intermedios (reanudable: si se corta, re-correr continúa donde iba) |

### Opciones útiles

```bash
python analiza.py clase.mp4 --sin-ia              # modo offline: solo transcripción + frames
python analiza.py clase.mp4 --whisper-modelo medium   # mejor precisión de voz (más lento)
python analiza.py clase.mp4 --umbral 20           # detecta cambios de diapositiva más sutiles
python analiza.py clase.mp4 --muestreo-seg 120    # frames cada 2 min (clases de mucha pizarra)
python analiza.py clase.mp4 --rehacer             # reprocesar desde cero
python analiza.py clase.mp4 -o SALIDA             # carpeta de salida personalizada
```

Ver todas: `python analiza.py --help`

## Cómo funciona

```
video.mp4
   ├─► audio ──► faster-whisper ──► transcripción con timestamps
   └─► video ──► PySceneDetect (umbral de contenido) ──► frame por cambio real
                    └─► hash perceptual + firma de color ──► diapositivas únicas
                    └─► rachas de escenas cortas ──► marcadas "video proyectado" (se ignoran)
   ▼
cada diapositiva única ──► GLM-4.6V (visión) ──► texto visible, bullets, fórmulas
   ▼
cronología (voz + visual) ──► fragmentos ──► GLM-5.3 resume cada uno (map-reduce)
   ▼
informe.md + flashcards_anki.tsv
```

Notas de diseño:

- **Solo se paga visión por diapositivas únicas**: una clase de 40 slides = ~40 llamadas,
  no 40 × cada cuánto se apareció. Los fotogramas de videos proyectados se descartan.
- **El Markdown lo arma Python, no el LLM**: el modelo devuelve JSON estructurado y el
  programa incrusta las imágenes donde corresponde (con reintento y fallback si el JSON viene roto).
- **Reanudable**: cada etapa guarda su JSON; si algo falla a mitad de una clase larga,
  se vuelve a correr y continúa donde estaba.

## Ajustes finos

| Problema | Solución |
|---|---|
| Se escapa algún cambio de diapositiva | `--umbral 20` (o menor; default 27) |
| Detecta "cambios" que no son (animaciones) | `--umbral 32` |
| Transcripción con errores de nombres técnicos | `--whisper-modelo medium` o `large-v3` |
| Clase dictada en otro idioma | `--idioma en` (o `auto`) |
| Clase de mucha pizarra, pocos cambios | `--muestreo-seg 120` |
| La API limita velocidad (429) | `--paralelo 1` |

## Modelos (configurables en `.env`)

`glm-5.3-flash` tiene visión y rendimiento sobrado: **un solo modelo para todo** (configuración por defecto del repo).
Alternativas: `MODELO_VISION` → `glm-4.6v`, `glm-4.5v` · `MODELO_TEXTO` → `glm-5.3`, `glm-4.6`

## Stack (todo open source)

[faster-whisper](https://github.com/SYSTRAN/faster-whisper) ·
[PySceneDetect](https://github.com/Breakthrough/PySceneDetect) ·
[imagehash](https://github.com/JohannesBuchner/imagehash) ·
[Pillow](https://github.com/python-pillow/Pillow) ·
[ffmpeg](https://ffmpeg.org) · API [z.ai](https://z.ai/model-api) (GLM)
