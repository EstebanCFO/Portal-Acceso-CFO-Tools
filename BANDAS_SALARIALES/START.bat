@echo off
chcp 65001 >nul
title Bandas Salariales DC - Iniciando...

echo.
echo [Bandas Salariales DC] Iniciando servicios...
echo.

:: Backend ASP.NET Core :5050
echo [1/2] Backend ASP.NET Core (puerto 5050)...
start "BS Backend :5050" cmd /k "cd /D "%~dp0BandasSalariales.Web" && dotnet run"

:: Esperar a que el backend levante
timeout /t 5 /nobreak >nul

:: Frontend Vite :5173
echo [2/2] Frontend Vite (puerto 5173)...
start "BS Frontend :5173" cmd /k "cd /D "%~dp0bandas-frontend" && npm run dev"

:: Esperar a que Vite compile
timeout /t 6 /nobreak >nul

:: Abrir en el navegador
echo Abriendo http://localhost:5173 ...
start "" "http://localhost:5173"

echo.
echo [OK] Bandas Salariales DC iniciado.
echo   Backend : http://localhost:5050
echo   Frontend: http://localhost:5173
echo.
