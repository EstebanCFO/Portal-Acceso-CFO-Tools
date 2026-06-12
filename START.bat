@echo off
chcp 65001 > nul
title CFOTech - Portal de Acceso
echo.
echo  CFOTech IT Tools - Portal de Acceso
echo  =====================================
echo.

echo [1/4] Liberando puertos 4999 y 5174...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4999 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5174 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
)

echo [2/4] Instalando dependencias del launcher...
start "CFOTech Launcher - Install" /D "%~dp0portal-launcher" /wait /min cmd /c "pip install -r requirements.txt -q"

echo [3/4] Iniciando Portal Launcher (puerto 4999)...
start "CFOTech Portal Launcher" /D "%~dp0portal-launcher" /min cmd /c "python launcher.py"

timeout /t 3 /nobreak > nul

if not exist "%~dp0node_modules" (
    echo [4/4] Instalando dependencias npm...
    pushd "%~dp0"
    npm install --silent
    popd
) else (
    echo [4/4] Dependencias ya instaladas.
)

echo Iniciando portal React+Vite en puerto 5174...
start "CFOTech Portal" /D "%~dp0" /min cmd /c "npm run dev"

timeout /t 4 /nobreak > nul
echo Abriendo http://localhost:5174
start http://localhost:5174

echo.
echo  Launcher: http://localhost:4999
echo  Portal  : http://localhost:5174
echo  Detener : ejecutar STOP.bat
echo.
pause
