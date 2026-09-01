@echo off
setlocal EnableExtensions
title Clase a Informe
cd /d "%~dp0"
echo.
echo  ============================================
echo   Clase a Informe - iniciando...
echo  ============================================
echo.

set "REINSTALO=0"

rem ---------- 1. Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
  echo [deps] Node.js no esta instalado. Instalando con winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  set "REINSTALO=1"
)

rem ---------- 2. FFmpeg ----------
where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo [deps] FFmpeg no esta instalado. Instalando con winget...
  winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
  set "REINSTALO=1"
)

rem ---------- 3. Python 3.12 ----------
set "PYCMD="
py -3.12 --version >nul 2>nul && set "PYCMD=py -3.12"
if not defined PYCMD (
  where python >nul 2>nul && for /f "tokens=*" %%v in ('python -c "import sys; print(sys.version_info[:2]==(3,12))" 2^>nul') do (
    if "%%v"=="True" set "PYCMD=python"
  )
)
if not defined PYCMD (
  echo [deps] Python 3.12 no esta instalado. Instalando con winget...
  winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
  set "REINSTALO=1"
)

if "%REINSTALO%"=="1" (
  echo.
  echo  ============================================================
  echo   Se instalaron programas nuevos. Cierra esta ventana
  echo   y vuelve a ejecutar iniciar.bat para continuar.
  echo  ============================================================
  echo.
  pause
  exit /b 0
)

rem ---------- 4. Entorno virtual de Python ----------
if not exist ".venv\Scripts\python.exe" (
  echo [setup] Creando entorno virtual de Python...
  %PYCMD% -m venv .venv || (echo ERROR: no se pudo crear .venv & pause & exit /b 1)
)
echo [setup] Instalando dependencias de Python (rapido si ya estan)...
".venv\Scripts\python.exe" -m pip install -q -r requirements.txt || (echo ERROR: fallo pip install & pause & exit /b 1)

rem ---------- 5. Dependencias de la web ----------
pushd web
if not exist "node_modules" (
  echo [setup] Instalando dependencias de la interfaz (npm install, unos minutos la primera vez^)...
  call npm install || (echo ERROR: fallo npm install & popd & pause & exit /b 1)
)

rem ---------- 6. Chrome para el generador de PDF ----------
if not exist "%USERPROFILE%\.cache\puppeteer" (
  echo [setup] Descargando Chrome para generar PDFs...
  call npx puppeteer browsers install chrome
)

rem ---------- 7. Build de la interfaz ----------
if not exist ".next\BUILD_ID" (
  echo [setup] Compilando la interfaz (npm run build, unos minutos la primera vez^)...
  call npm run build || (echo ERROR: fallo npm run build & popd & pause & exit /b 1)
)

rem ---------- 8. Puerto libre ----------
for /f "tokens=5" %%p in ('netstat -ano ^| findstr :4310 ^| findstr LISTENING') do (
  echo [setup] Puerto 4310 ocupado, liberando proceso %%p...
  taskkill /F /PID %%p >nul 2>nul
)

echo.
echo  ============================================================
echo   Listo. Abriendo http://localhost:4310 en tu navegador.
echo   Deja esta ventana abierta mientras uses la app:
echo   al cerrarla, todo se apaga.
echo  ============================================================
echo.

start "" cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:4310"
call npm run start

popd
endlocal
