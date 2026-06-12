@echo off
title CFOTech - Reporte DevOps
echo.
echo  CFOTech IT Tools - Reporte DevOps
echo  ====================================
echo.

:: --- Liberar puertos ---
echo [1/4] Liberando puertos 5000 y 5001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5001 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
)

:: --- Backend Flask ---
:: /D fija el directorio de trabajo -- evita comillas anidadas con rutas con espacios
echo [2/4] Iniciando backend Flask (puerto 5000)...
start "CFOTech - Backend Flask" /D "%~dp0backend" /min cmd /c "pip install -r requirements.txt -q && python app.py"

:: --- Esperar que Flask levante ---
echo [3/4] Esperando backend (5 segundos)...
timeout /t 5 /nobreak > nul

:: --- Frontend React/Vite ---
echo [4/4] Iniciando frontend React+Vite (puerto 5001)...
start "CFOTech - Frontend React" /D "%~dp0frontend" /min cmd /c "npm install --silent && npm run dev"

:: --- Esperar que Vite levante ---
echo Esperando frontend (6 segundos)...
timeout /t 6 /nobreak > nul

:: --- Abrir navegador ---
echo Abriendo http://localhost:5001
start http://localhost:5001

echo.
echo  Backend : http://localhost:5000
echo  Frontend: http://localhost:5001
echo.
echo  Cierra este script o ejecuta STOP.bat para detener los servidores.
echo.
pause
