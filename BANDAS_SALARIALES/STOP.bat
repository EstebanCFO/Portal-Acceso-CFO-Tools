@echo off
chcp 65001 >nul
title Bandas Salariales DC - Deteniendo...

echo.
echo [Bandas Salariales DC] Deteniendo servicios...
echo.

:: Matar proceso dotnet en puerto 5050
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5050"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Matar proceso node en puerto 5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo [OK] Servicios detenidos (puertos 5050 y 5173).
echo.
