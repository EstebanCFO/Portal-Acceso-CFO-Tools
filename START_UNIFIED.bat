@echo off
chcp 65001 > nul
title Portal Unificado CFOTech

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   Portal Unificado CFOTech               ║
echo  ║   http://localhost:5174                  ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  Iniciando gateway (backends + Sound Catch inline)...
echo  Cerrar esta ventana detiene todos los servicios.
echo.

python "%~dp0portal_server.py"

pause
