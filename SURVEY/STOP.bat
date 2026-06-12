@echo off
chcp 65001 > nul
echo Deteniendo Survey Analytics...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5055 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5176 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
echo Puertos 5055 y 5176 liberados.
