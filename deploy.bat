@echo off
REM ── deploy.bat — Despliegue en Azure App Service (Windows) ──────────────────
REM Requisitos: Azure CLI instalado y sesion iniciada (az login).

setlocal enabledelayedexpansion

REM ── CONFIGURACION ────────────────────────────────────────────────────────────
set APP_NAME=agente-informe-recruiting-demo
set RESOURCE_GROUP=rg-agente-recruiting
set LOCATION=eastus
set PLAN_NAME=plan-agente-recruiting
set SKU=B2

REM ── AUTENTICACION ────────────────────────────────────────────────────────────
echo Verificando sesion en Azure...
az account show >nul 2>&1
if errorlevel 1 (
    echo No se detecto una sesion activa. Iniciando az login...
    az login
    if errorlevel 1 (
        echo ERROR: az login fallo. Abortando.
        exit /b 1
    )
) else (
    echo Sesion activa detectada.
)

az account set --subscription "Azure subscription 1"
if errorlevel 1 (
    echo ERROR: No se pudo seleccionar la suscripcion.
    exit /b 1
)

echo Iniciando despliegue de "%APP_NAME%" en Azure...

REM 1. Crear/Actualizar la App Service
echo Creando recursos en Azure (esto puede tardar unos minutos)...
az webapp up ^
    --name "%APP_NAME%" ^
    --resource-group "%RESOURCE_GROUP%" ^
    --plan "%PLAN_NAME%" ^
    --sku "%SKU%" ^
    --location "%LOCATION%" ^
    --runtime "PYTHON:3.11"
if errorlevel 1 (
    echo ERROR: az webapp up fallo.
    exit /b 1
)

REM 2. Configurar comando de inicio para Gunicorn
echo Configurando comando de inicio y Always On...
az webapp config set ^
    --name "%APP_NAME%" ^
    --resource-group "%RESOURCE_GROUP%" ^
    --always-on true ^
    --startup-file "gunicorn --bind=0.0.0.0 --workers 6 --worker-class gevent --worker-connections 100 --timeout 600 \"app.main:app\""
if errorlevel 1 (
    echo ERROR: No se pudo configurar el startup command.
    exit /b 1
)

REM 3. Cargar variables de entorno desde .env
echo Cargando secretos y variables de entorno desde .env...

if not exist ".env" (
    echo ERROR: No se encontro el archivo .env en el directorio actual.
    echo Crea un .env basado en .env.example antes de deployar.
    exit /b 1
)

REM Construir la lista de settings desde .env ignorando comentarios y lineas vacias
set SETTINGS=

for /f "usebackq tokens=* delims=" %%L in (".env") do (
    set LINE=%%L
    REM Ignorar lineas que empiezan con # o estan vacias
    if not "!LINE!"=="" (
        set FIRST=!LINE:~0,1!
        if not "!FIRST!"=="#" (
            REM Quitar comentarios en la misma linea (parte despues de #)
            for /f "tokens=1 delims=#" %%K in ("!LINE!") do (
                set CLEAN=%%K
                REM Quitar espacios al final
                for /f "tokens=* delims= " %%T in ("!CLEAN!") do set CLEAN=%%T
                if not "!CLEAN!"=="" (
                    set SETTINGS=!SETTINGS! "!CLEAN!"
                )
            )
        )
    )
)

if "!SETTINGS!"=="" (
    echo ADVERTENCIA: No se encontraron variables en el archivo .env
) else (
    az webapp config appsettings set ^
        --name "%APP_NAME%" ^
        --resource-group "%RESOURCE_GROUP%" ^
        --settings !SETTINGS!
    if errorlevel 1 (
        echo ERROR: No se pudieron cargar las variables de entorno.
        exit /b 1
    )
)

REM 4. Activar feature flags, auth y parametros de performance
echo Activando feature flags y configurando autenticacion...
az webapp config appsettings set ^
    --name "%APP_NAME%" ^
    --resource-group "%RESOURCE_GROUP%" ^
    --settings ^
        FEATURE_CLIENT_NOTIFICATION_ENABLED=true ^
        FEATURE_INTERVIEW_QUALITY_ENABLED=false ^
        AUTH_ENABLED=true ^
        "MS_REDIRECT_URI=https://%APP_NAME%.azurewebsites.net/auth/callback" ^
        FEATURE_ASYNC_PROCESSING_ENABLED=true ^
        FEATURE_COST_TRACKING_ENABLED=true ^
        LLM_MAX_CONCURRENT=6
if errorlevel 1 (
    echo ERROR: No se pudieron configurar los feature flags.
    exit /b 1
)

REM 5. Reiniciar la app para que tome los cambios
echo Reiniciando la aplicacion...
az webapp restart ^
    --name "%APP_NAME%" ^
    --resource-group "%RESOURCE_GROUP%"
if errorlevel 1 (
    echo ERROR: No se pudo reiniciar la app.
    exit /b 1
)

echo.
echo Despliegue completado con exito!
echo La aplicacion estara disponible en breve en: https://%APP_NAME%.azurewebsites.net
echo ────────────────────────────────────────────────────────────────────────────────
echo Features activados:
echo   - FEATURE_CLIENT_NOTIFICATION_ENABLED=true
echo   - FEATURE_INTERVIEW_QUALITY_ENABLED=false
echo   - AUTH_ENABLED=true
echo   - MS_REDIRECT_URI=https://%APP_NAME%.azurewebsites.net/auth/callback
echo   - FEATURE_ASYNC_PROCESSING_ENABLED=true
echo   - FEATURE_COST_TRACKING_ENABLED=true
echo   - LLM_MAX_CONCURRENT=6
echo.
echo Performance y concurrencia:
echo   - SKU: B2 (2 cores / 3.5 GB RAM - dedicado, no compartido)
echo   - Gunicorn: 6 workers gevent (I/O async, hasta 8 reclutadores en paralelo)
echo   - Always On: activo - sin cold start al inicio de jornada
echo   - Rate limit: /procesar 6/min . /procesar-async 10/min . /refinar 20/min
echo   - Semaforo LLM: max 6 llamadas simultaneas a la API
echo.
echo IMPORTANTE: Agrega esta Redirect URI en el App Registration de Azure AD:
echo   https://%APP_NAME%.azurewebsites.net/auth/callback
echo.
echo Nota: Si ves un error de inicio, espera 1-2 minutos a que el contenedor termine de arrancar.

endlocal
