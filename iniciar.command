#!/bin/bash
# Clase a Informe — lanzador para macOS.
# Doble clic en iniciar.command (la primera vez: clic derecho > Abrir).
set -e
cd "$(dirname "$0")"

echo ""
echo " ============================================"
echo "  Clase a Informe - iniciando..."
echo " ============================================"
echo ""

REINSTALO=0

# ---------- 1. Homebrew (gestor de paquetes) ----------
BREW=""
if command -v brew >/dev/null 2>&1; then
  BREW="$(command -v brew)"
elif [ -x /opt/homebrew/bin/brew ]; then
  BREW=/opt/homebrew/bin/brew
elif [ -x /usr/local/bin/brew ]; then
  BREW=/usr/local/bin/brew
else
  echo "[deps] Homebrew no esta instalado. Instalando..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [ -x /opt/homebrew/bin/brew ]; then BREW=/opt/homebrew/bin/brew
  elif [ -x /usr/local/bin/brew ]; then BREW=/usr/local/bin/brew
  else echo "ERROR: Homebrew no quedo instalado."; exit 1; fi
  REINSTALO=1
  eval "$($BREW shellenv)"
fi

# ---------- 2. Node.js ----------
if ! command -v node >/dev/null 2>&1; then
  echo "[deps] Node.js no esta. Instalando con brew (tarda unos minutos)..."
  "$BREW" install node
  REINSTALO=1
fi

# ---------- 3. FFmpeg ----------
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "[deps] FFmpeg no esta. Instalando con brew..."
  "$BREW" install ffmpeg
  REINSTALO=1
fi

# ---------- 4. Python 3.12 ----------
PYCMD=""
if command -v python3.12 >/dev/null 2>&1; then
  PYCMD=python3.12
elif "$BREW" --prefix python@3.12 >/dev/null 2>&1; then
  PYCMD="$("$BREW" --prefix python@3.12)/bin/python3.12"
fi
if [ -z "$PYCMD" ]; then
  echo "[deps] Python 3.12 no esta. Instalando con brew..."
  "$BREW" install python@3.12
  PYCMD="$("$BREW" --prefix python@3.12)/bin/python3.12"
  REINSTALO=1
fi

if [ "$REINSTALO" = "1" ]; then
  echo ""
  echo " ============================================================"
  echo "  Se instalaron programas nuevos. Cierra esta ventana"
  echo "  y vuelve a abrir iniciar.command para continuar."
  echo " ============================================================"
  echo ""
  read -r -p "Presiona Enter para cerrar..."
  exit 0
fi

# ---------- 5. Entorno virtual de Python ----------
if [ ! -x ".venv/bin/python" ]; then
  echo "[setup] Creando entorno virtual de Python..."
  "$PYCMD" -m venv .venv
fi
echo "[setup] Instalando dependencias de Python (rapido si ya estan)..."
.venv/bin/python -m pip install -q -r requirements.txt

# ---------- 6. Dependencias de la web ----------
cd web
if [ ! -d "node_modules" ]; then
  echo "[setup] Instalando dependencias de la interfaz (npm install, unos minutos la primera vez)..."
  npm install
fi

# ---------- 7. Chrome para el generador de PDF ----------
if [ ! -d "$HOME/.cache/puppeteer" ]; then
  echo "[setup] Descargando Chrome para generar PDFs..."
  npx puppeteer browsers install chrome
fi

# ---------- 8. Build de la interfaz ----------
if [ ! -f ".next/BUILD_ID" ]; then
  echo "[setup] Compilando la interfaz (npm run build, unos minutos la primera vez)..."
  npm run build
fi

# ---------- 9. Puerto libre ----------
PID_OCUPA=$(lsof -ti tcp:4310 2>/dev/null || true)
if [ -n "$PID_OCUPA" ]; then
  echo "[setup] Puerto 4310 ocupado, liberando proceso $PID_OCUPA..."
  kill -9 $PID_OCUPA 2>/dev/null || true
fi

echo ""
echo " ============================================================"
echo "  Listo. Abriendo http://localhost:4310 en tu navegador."
echo "  Deja esta ventana abierta mientras uses la app:"
echo "  al cerrarla, todo se apaga."
echo " ============================================================"
echo ""

# Al cerrar la ventana (o Ctrl+C), mueren el servidor y el navegador diferido.
trap 'kill 0' EXIT
( sleep 4; open http://localhost:4310 ) &

npm run start
