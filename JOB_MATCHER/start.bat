@echo off
title CFOTech - Job Matcher / JD Generator
echo.
echo  CFOTech IT Tools - Job Matcher + JD Generator (FASE 3)
echo  ========================================================
echo.

echo [1/4] Liberando puertos 5002 y 5003...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5002 ^| findstr LISTENING 2^>nul') do (
    taskkill /PID %%a /F > nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5003 ^| findstr LISTENING 2^>nul') do (
    taskkill /PID %%a /F > nul 2>&1
)

if not exist "%~dp0backend\node_modules" (
    echo [2/4] Instalando dependencias backend...
    pushd "%~dp0backend"
    npm install --silent
    popd
) else (
    echo [2/4] Dependencias backend OK.
)

if not exist "%~dp0frontend\node_modules" (
    echo [3/4] Instalando dependencias frontend...
    pushd "%~dp0frontend"
    npm install --silent
    popd
) else (
    echo [3/4] Dependencias frontend OK.
)

echo [4/4] Iniciando backend API :5002 y frontend React :5003...
start "JM Backend :5002" /D "%~dp0backend" /min cmd /c "node server.js"
timeout /t 2 /nobreak > nul
start "JM Frontend :5003" /D "%~dp0frontend" /min cmd /c "npm run dev"

timeout /t 4 /nobreak > nul
echo Abriendo http://localhost:5003
start http://localhost:5003

echo.
echo  Backend API : http://localhost:5002
echo  Frontend    : http://localhost:5003
echo  Detener     : ejecutar stop.bat
echo.
