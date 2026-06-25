@echo off
title Sound Catch - Detener

echo Deteniendo Sound Catch...

:: Matar por titulo de ventana
taskkill /fi "WINDOWTITLE eq SC-Backend*"  /f > nul 2>&1
taskkill /fi "WINDOWTITLE eq SC-Frontend*" /f > nul 2>&1

:: Matar por puerto como fallback
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5008 "') do taskkill /PID %%a /F > nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5009 "') do taskkill /PID %%a /F > nul 2>&1

echo Sound Catch detenido.
timeout /t 2 /nobreak > nul
