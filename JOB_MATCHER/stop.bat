@echo off
title Deteniendo CFOTech - Job Matcher
echo Liberando puertos 5002 y 5003...

set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5002 ^| findstr LISTENING 2^>nul') do (
    taskkill /PID %%a /F > nul 2>&1
    set FOUND=1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5003 ^| findstr LISTENING 2^>nul') do (
    taskkill /PID %%a /F > nul 2>&1
    set FOUND=1
)

if %FOUND% EQU 0 (echo No habia procesos corriendo.) else (echo Job Matcher detenido.)
pause
