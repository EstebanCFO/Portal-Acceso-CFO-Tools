@echo off
title Deteniendo CFOTech - Reporte DevOps
echo Deteniendo servidores...
echo.

echo [1/2] Liberando puerto 5000 (Flask)...
set F1=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
    set F1=1
)
if %F1% EQU 0 (echo   No habia proceso en :5000.) else (echo   Backend detenido.)

echo [2/2] Liberando puerto 5001 (Vite)...
set F2=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5001 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
    set F2=1
)
if %F2% EQU 0 (echo   No habia proceso en :5001.) else (echo   Frontend detenido.)

echo.
echo Listo.
pause
