@echo off
title Deteniendo CFOTech - Portal de Acceso
echo Liberando puertos 4999 y 5174...

set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4999 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
    set FOUND=1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5174 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
    set FOUND=1
)

if %FOUND% EQU 0 (echo No habia procesos corriendo.) else (echo Portal y Launcher detenidos.)
pause
