# clase-a-informe

Convierte un **video de clase grabado** (por ejemplo con ShareX u OBS) en **material de
estudio completo**, combinando lo que se **dice** y lo que se **muestra** — con una
interfaz web para seguir todo el proceso y estudiar la clase.

- 🎙️ **Transcripción de la voz** con marcas de tiempo — local y gratis (faster-whisper)
- 🖼️ **Detección automática de diapositivas** — solo un frame por cada cambio real de
  contenido (PySceneDetect + hash perceptual con firma de color)
- 👁️ **Lectura de diapositivas y pizarra** con visión IA (glm-5.3-flash vía z.ai)
- 📄 **Informe de estudio**: temario, resúmenes por tema, conceptos clave, Q&A,
  datos curiosos, posibles preguntas de examen, glosario y flashcards para Anki
- 🖥️ **Interfaz web**: sube el video arrastrándolo, mira cada paso del análisis en vivo,
  estudia con video + subtítulos + transcripción sincronizada (clic en un minuto o un
  tema y el video salta ahí), chatea con un tutor IA que vio toda la clase y descarga
  el informe en PDF con diseño editorial

100% local salvo las llamadas de visión y redacción (tu API key de z.ai).

## Inicio rápido

**macOS:** doble clic en `iniciar.command` (la primera vez: clic derecho → Abrir).
**Windows:** doble clic en `iniciar.bat`.

El lanzador instala solo lo que falte (Node.js, Python 3.12, FFmpeg, Homebrew/winget),
prepara dependencias, compila la interfaz, arranca todo y abre
[http://localhost:4310](http://localhost:4310). **Cierra la ventana y se apaga todo.**

Primera vez dentro de la app: entra a **Ajustes** y pega tu API key de z.ai
(vive en `.data/config.json`, que nunca se sube a git).

> ¿Usas una key del **GLM Coding Plan**? El endpoint correcto es
> `https://api.z.ai/api/coding/paas/v4` (ya viene por defecto). Una key de la API por
> consumo usa `https://api.z.ai/api/paas/v4`.

### Instalación manual (si prefieres)

```bash
python3.12 -m venv .venv                     # Windows: py -3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt    # Windows: .venv\Scripts\pip ...
cd web && npm install && npm run build && npm run start
```

## La app

| Vista | Qué hace |
|---|---|
| **Clases** (dashboard) | Tus clases analizadas + zona de arrastre para subir un video nuevo |
| **Procesando** | Las 4 fases del motor en vivo (voz → escenas → visión → informe) con progreso y registro |
| **Clase** | Video con subtítulos, transcripción sincronizada (clic = saltar, selecciona texto = pregúntale a la IA), galería de diapositivas, informe completo y **chat** con adjuntos (fotograma capturado o fragmento seleccionado) |
| **Ajustes** | API key, endpoint, modelos, umbral de escenas, whisper, paralelismo — con botón "probar conexión" |
| **Memoria** | Notas que la app aprende automáticamente de tus clases; el chat las lee |

**PDF**: botón «Descargar informe PDF» en la vista de clase — se genera al vuelo con
Puppeteer (A4 vectorial, portada, figuras con su texto visible, glosario).

## Uso por consola (opcional)

```bash
python analiza.py MI_CLASE.mp4          # genera .data/analisis/MI_CLASE/
python analiza.py clase.mp4 --sin-ia    # offline: solo transcripción + frames
python analiza.py clase.mp4 --umbral 20 --whisper-modelo medium --rehacer
python analiza.py --help                # todas las opciones
```

Todo queda en `.data/` (gitignored): `videos/`, `analisis/<id>/`, `jobs/`,
`memoria/MEMORIA.md`, `config.json`. Borrar la carpeta del proyecto desinstala todo.

## Cómo funciona

```
video.mp4
   ├─► audio ──► faster-whisper ──► transcripción con timestamps
   └─► video ──► PySceneDetect (umbral de contenido) ──► frame por cambio real
                    └─► hash perceptual + firma de color ──► diapositivas únicas
                    └─► rachas de escenas cortas ──► "video proyectado" (se descarta)
   ▼
cada diapositiva única ──► glm-5.3-flash (visión) ──► texto visible, bullets, fórmulas
   ▼
cronología (voz + visual) ──► fragmentos ──► glm-5.3-flash resume (map-reduce)
   ▼
informe.json/md + flashcards_anki.tsv + informe.pdf
```

Notas de diseño:

- **Solo se paga visión por diapositivas únicas**: 40 slides = ~40 llamadas, no 40 ×
  cada vez que apareció. Los fotogramas de videos proyectados se descartan.
- **El Markdown lo arma Python, no el LLM**: el modelo devuelve JSON estructurado y el
  programa incrusta las imágenes donde corresponde (con reintento y fallback).
- **Reanudable**: cada etapa guarda su JSON; si algo falla a mitad de una clase larga,
  volver a analizar continúa donde estaba (el botón «Reanalizar» sí rehace la IA).
- **Interfaz = Next.js que orquesta**: la web lanza el motor Python como subproceso y
  lee su progreso línea a línea (eventos JSON); el estado sobrevive recargas.

## Ajustes finos

| Problema | Solución |
|---|---|
| Se escapa algún cambio de diapositiva | Umbral 20 en Ajustes (default 27) |
| Detecta "cambios" que no son (animaciones) | Umbral 32 |
| Transcripción con errores de nombres técnicos | whisper `medium` o `large-v3` |
| Clase dictada en otro idioma | idioma `en` |
| Clase de mucha pizarra, pocos cambios | Muestreo 120 s |
| La API limita velocidad (429) | Paralelismo 1 |

## Stack (todo open source)

[faster-whisper](https://github.com/SYSTRAN/faster-whisper) ·
[PySceneDetect](https://github.com/Breakthrough/PySceneDetect) ·
[imagehash](https://github.com/JohannesBuchner/imagehash) ·
[Pillow](https://github.com/python-pillow/Pillow) ·
[ffmpeg](https://ffmpeg.org) ·
[Next.js](https://nextjs.org) + [shadcn/ui](https://ui.shadcn.com) +
[AI SDK](https://sdk.vercel.ai) + [Puppeteer](https://pptr.dev) · API [z.ai](https://z.ai) (GLM)
