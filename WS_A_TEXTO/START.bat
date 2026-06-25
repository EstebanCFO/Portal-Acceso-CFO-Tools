@echo off
title Sound Catch

echo.
echo  ==========================================
echo   Sound Catch - Transcripcion de Audio
echo  ==========================================
echo.

:: Backend FastAPI
echo [1/2] Iniciando backend (FastAPI :5008)...
cd /d "%~dp0web\backend"
if not exist ".env" copy ".env.example" ".env" > nul
start "SC-Backend" /min cmd /c "pip install -r requirements.txt --quiet && python app.py"
cd /d "%~dp0"

:: Esperar backend
echo     Esperando backend...
timeout /t 4 /nobreak > nul

:: Frontend Vite
echo [2/2] Iniciando frontend (Vite :5009)...
cd /d "%~dp0web\frontend"
if not exist ".env" copy ".env.example" ".env" > nul
if not exist "node_modules" (
    echo     Instalando dependencias npm...
    call npm install --silent
)
start "SC-Frontend" /min cmd /c "npm run dev"
cd /d "%~dp0"

:: Esperar frontend
timeout /t 5 /nobreak > nul

:: Abrir browser
echo.
echo  Backend : http://localhost:5008/api/health
echo  Frontend: http://localhost:5009
echo.
start http://localhost:5009

echo  Sound Catch iniciado. Cerrar ventanas "SC-Backend" y "SC-Frontend" para detener.
echo.
pause
