@echo off
chcp 65001 > nul
title Survey Analytics - CFOTech IT Tools

echo Iniciando Survey Analytics...
echo Backend  ASP.NET Core  puerto 5055
echo Frontend React Vite    puerto 5176

start "Survey Backend" cmd /k "cd /D "%~dp0SurveyApp.Web" && dotnet run"
timeout /t 10 /nobreak > nul

start "Survey Frontend" cmd /k "cd /D "%~dp0survey-frontend" && npm run dev"
timeout /t 8 /nobreak > nul

start "" http://localhost:5176
echo Survey Analytics iniciado.
