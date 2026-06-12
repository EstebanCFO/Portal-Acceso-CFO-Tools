@echo off
chcp 65001 > nul
title CFOTech IT Tools - Bandas Salariales DC
color 1F

echo.
echo   ==========================================
echo    CFOTech IT Tools  -  Bandas Salariales DC
echo   ==========================================
echo.

:: [1/3] Backend ASP.NET Core 8
echo   [1/3]  Iniciando API Backend  (puerto 5050)...
start "Backend - Bandas Salariales DC - :5050" /d "C:\Esteban CFOTech\Bandas Salariales\BandasSalariales.Web" cmd /k "dotnet run"

:: Esperar que dotnet arranque
echo   [2/3]  Esperando que el backend levante...
timeout /t 5 /nobreak > nul

:: [3/3] Frontend Vite + React
echo   [3/3]  Iniciando Frontend React  (puerto 5173)...
start "Frontend - Bandas Salariales DC - :5173" /d "C:\Esteban CFOTech\Bandas Salariales\bandas-frontend" cmd /k "npm run dev"

:: Abrir el navegador
echo.
echo   Abriendo http://localhost:5173 en el navegador...
timeout /t 6 /nobreak > nul
start "" "http://localhost:5173"

echo.
echo   App iniciada. Podes cerrar esta ventana.
timeout /t 3 /nobreak > nul
exit
