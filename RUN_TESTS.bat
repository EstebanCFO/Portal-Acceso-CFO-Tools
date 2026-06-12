@echo off
title CFOTech - Suite de Tests
echo.
echo  CFOTech IT Tools - Suite de Tests
echo  =====================================
echo.

set PORTAL_DIR=%~dp0
set BACKEND_DIR=%~dp0REPORTE_DEV_OPS\backend
set FAILED=0

:: =====================================================
:: [1] PORTAL -- Tests unitarios (Vitest)
:: =====================================================
echo [1/3] Tests del Portal (Vitest)...
echo       Directorio: %PORTAL_DIR%
pushd "%PORTAL_DIR%"
if not exist "node_modules" (
    echo       Instalando dependencias npm...
    npm install --silent
)
call npm run test:run
if %ERRORLEVEL% NEQ 0 (
    echo  [FAIL] Tests del portal fallaron.
    set FAILED=1
) else (
    echo  [OK]   Tests del portal pasaron.
)
popd
echo.

:: =====================================================
:: [2] BACKEND -- Tests pytest
:: =====================================================
echo [2/3] Tests del Backend (pytest)...
echo       Directorio: %BACKEND_DIR%
pushd "%BACKEND_DIR%"
if not exist "venv" (
    echo       Creando entorno virtual...
    python -m venv venv > nul 2>&1
)
call venv\Scripts\activate.bat > nul 2>&1
pip install -r requirements-test.txt -q
python -m pytest tests/ -v --tb=short
if %ERRORLEVEL% NEQ 0 (
    echo  [FAIL] Tests del backend fallaron.
    set FAILED=1
) else (
    echo  [OK]   Tests del backend pasaron.
)
call venv\Scripts\deactivate.bat > nul 2>&1
popd
echo.

:: =====================================================
:: [3] LOGS -- Analisis del log mas reciente
:: =====================================================
echo [3/3] Analizando logs...
pushd "%BACKEND_DIR%"
if exist "logs\Trace_*.log" (
    python analizar_logs.py --ultimo --timeline
) else (
    echo       Sin logs disponibles aun (ejecutar el servidor primero).
)
popd
echo.

:: =====================================================
:: Resultado final
:: =====================================================
echo =====================================================
if %FAILED% EQU 0 (
    echo  RESULTADO: TODOS LOS TESTS PASARON
) else (
    echo  RESULTADO: ALGUNOS TESTS FALLARON -- Revisar output arriba
)
echo =====================================================
echo.
pause
