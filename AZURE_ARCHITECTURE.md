# AZURE_ARCHITECTURE.md — Arquitectura Cloud CFOTech Portal de Acceso

Diseño de despliegue en Azure con CI/CD automático por commit.

---

## Plataforma elegida: Azure Container Apps

| Necesidad | App Service | **Container Apps** ✅ |
|-----------|-------------|----------------------|
| Múltiples runtimes (Python, .NET, Node.js) | ❌ uno por servicio | ✅ cada container su runtime |
| Escala por app independiente | ⚠️ manual | ✅ auto-scale / scale-to-zero |
| Backends sin CORS entre sí | ❌ pasan por internet | ✅ red interna (DNS interno) |
| CI/CD por commit con path filters | ⚠️ posible pero frágil | ✅ GitHub Actions nativo |
| Costo en idle | 💰 corre siempre | ✅ scale-to-zero |

---

## Diagrama de arquitectura

```
Internet (HTTPS :443)
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│  Azure Container Apps Environment   (red interna privada)      │
│                                                                │
│  ┌────────────────────────────────────┐                        │
│  │  portal-gateway  (Python / FastAPI)│  ← único punto público │
│  │  puerto interno :8080              │                        │
│  │                                    │                        │
│  │  · Sirve dist/ del portal shell    │                        │
│  │  · Sirve dist/ de cada frontend    │                        │
│  │  · Proxy /api/{app}/* → backends   │                        │
│  │  · Audio a Texto inline (Whisper)  │                        │
│  └──────────────┬─────────────────────┘                        │
│                 │  HTTP interno  (DNS Container Apps)           │
│       ┌─────────┼──────────────────────────┐                   │
│       ▼         ▼           ▼          ▼   │                   │
│  ┌─────────┐ ┌──────┐ ┌────────┐ ┌──────┐ │                   │
│  │   rdo   │ │  jm  │ │ bandas │ │survey│ │                   │
│  │  Flask  │ │ Node │ │ .NET 8 │ │.NET 8│ │                   │
│  │  :5000  │ │:5002 │ │  :5050 │ │:5055 │ │                   │
│  │ interno │ │intern│ │ interno│ │intern│ │                   │
│  └─────────┘ └──────┘ └────────┘ └──────┘ │                   │
│                                            │                   │
└────────────────────────────────────────────┘                   │
                                                                 │
┌───────────────────────────────┐                                │
│  Azure Container Registry     │  ← GitHub Actions pushea      │
│  cfotech.azurecr.io           │    imágenes aquí              │
│                               │                                │
│  · portal-gateway:{sha}       │                                │
│  · reporte-devops-api:{sha}   │                                │
│  · job-matcher-api:{sha}      │                                │
│  · bandas-api:{sha}           │                                │
│  · survey-api:{sha}           │                                │
└───────────────────────────────┘
```

---

## Componentes y responsabilidades

| Container App | Runtime | Ingress | Rol |
|---------------|---------|---------|-----|
| `portal-gateway` | Python 3.11 / FastAPI | **Externo** (público) | Sirve portal shell + frontends + proxy a backends + Whisper inline |
| `reporte-devops-api` | Python 3.11 / Flask | Interno | API Azure DevOps — sprints, métricas, PDFs |
| `job-matcher-api` | Node 20 / Express | Interno | API matching IA + JD Generator |
| `bandas-api` | .NET 8 / ASP.NET Core | Interno | API bandas salariales |
| `survey-api` | .NET 8 / ASP.NET Core | Interno | API Survey Analytics (SurveyMonkey) |

> **Audio a Texto** permanece montado inline en el gateway (router FastAPI importado directamente). No necesita container propio.

---

## Flujo CI/CD por commit

```
Push a rama main
        │
        ├── src/**  o  portal_server.py  o  WS_A_TEXTO/**  cambió?
        │       └──▶  deploy-gateway.yml
        │               ├─ npm build (portal shell + todos los frontends)
        │               ├─ docker build Dockerfile.gateway
        │               ├─ push cfotech.azurecr.io/portal-gateway:{sha}
        │               └─ deploy Container App portal-gateway
        │
        ├── REPORTE_DEV_OPS/**  cambió?
        │       └──▶  deploy-reporte-devops.yml
        │               ├─ docker build Dockerfile.reporte-devops
        │               └─ deploy Container App reporte-devops-api
        │
        ├── JOB_MATCHER/**  cambió?
        │       └──▶  deploy-job-matcher.yml
        │               ├─ docker build Dockerfile.job-matcher
        │               └─ deploy Container App job-matcher-api
        │
        ├── BANDAS_SALARIALES/**  cambió?
        │       └──▶  deploy-bandas.yml
        │               ├─ dotnet publish + npm build frontend
        │               ├─ docker build Dockerfile.bandas
        │               └─ deploy Container App bandas-api
        │
        └── SURVEY/**  cambió?
                └──▶  deploy-survey.yml
                        ├─ dotnet publish + npm build frontend
                        ├─ docker build Dockerfile.survey
                        └─ deploy Container App survey-api
```

Cada workflow es **independiente** — si solo cambia RDO, solo se redeploya RDO. El resto no se toca.

---

## Cambio en `portal_server.py` — modo managed

El gateway soporta dos modos mediante una variable de entorno:

- **`PORTAL_MANAGED=false`** (default) → comportamiento local actual: lanza subprocesos, usa `localhost:puerto`
- **`PORTAL_MANAGED=true`** → modo Azure: lee URLs internas de env vars, no lanza ningún subproceso

### Diff conceptual del cambio

```python
# ── NUEVO: al inicio de portal_server.py ──────────────────────────────────────
_MANAGED = os.getenv('PORTAL_MANAGED', 'false').lower() == 'true'

# En la definición de APPS, agregar 'backend_managed_url' por cada app:
APPS: dict[str, dict] = {
    'reporte-devops': {
        'backend_managed_url': os.getenv('REPORTE_DEVOPS_URL', ''),  # ← NUEVO
        # todo lo siguiente queda igual (solo se usa cuando _MANAGED=false):
        'backend_cmd':     f'"{_PY}" app.py',
        'backend_dir':     BASE_DIR / 'REPORTE_DEV_OPS' / 'backend',
        'backend_port':    5000,
        'backend_health':  'http://localhost:5000/api/health',
        'backend_timeout': 20,
        'frontend_cmd':    'npm run dev',
        'frontend_dir':    BASE_DIR / 'REPORTE_DEV_OPS' / 'frontend',
        'frontend_port':   5001,
        'frontend_dist':   BASE_DIR / 'REPORTE_DEV_OPS' / 'frontend' / 'dist',
    },
    'job-matcher': {
        'backend_managed_url': os.getenv('JOB_MATCHER_URL', ''),     # ← NUEVO
        # ... resto igual
    },
    'bandas-salariales': {
        'backend_managed_url': os.getenv('BANDAS_URL', ''),          # ← NUEVO
        # ... resto igual
    },
    'survey': {
        'backend_managed_url': os.getenv('SURVEY_URL', ''),          # ← NUEVO
        # ... resto igual
    },
}

# ── En proxy_api() — único punto que cambia comportamiento ────────────────────
async def proxy_api(app_id: str, path: str, request: Request):
    cfg = APPS.get(app_id)

    if _MANAGED:
        # Azure: proxy a URL interna del Container App (DNS interno)
        base = cfg.get('backend_managed_url', '').rstrip('/')
        if not base:
            raise HTTPException(503, detail=f"URL de {app_id} no configurada (PORTAL_MANAGED=true)")
        qs = request.url.query
        target_url = f"{base}/{path}" + (f"?{qs}" if qs else "")
    else:
        # Local: comportamiento actual sin cambios
        port = cfg['backend_port']
        bp   = cfg.get('backend_path_prefix', '/api')
        target_url = f"http://localhost:{port}{bp}/{path}" if bp else f"http://localhost:{port}/{path}"
        qs = request.url.query
        if qs:
            target_url += f"?{qs}"

    # ... resto del proxy idéntico (headers, httpx, manejo de errores)
```

---

## Variables de entorno por Container App

### `portal-gateway`

| Variable | Valor en Azure |
|----------|----------------|
| `PORTAL_MANAGED` | `true` |
| `REPORTE_DEVOPS_URL` | `http://reporte-devops-api/api` |
| `JOB_MATCHER_URL` | `http://job-matcher-api` |
| `BANDAS_URL` | `http://bandas-api/api` |
| `SURVEY_URL` | `http://survey-api/api` |
| `ANTHROPIC_API_KEY` | `@Microsoft.KeyVault(...)` |
| `SC_MODEL` | `base` |
| `PORT` | `8080` |

### `reporte-devops-api`

| Variable | Valor en Azure |
|----------|----------------|
| `AZURE_DEVOPS_PAT` | `@Microsoft.KeyVault(...)` |
| `AZURE_DEVOPS_ORGS` | `CFOTech,...` |
| `PORTAL_ORIGIN` | `https://portal-cfotech.<region>.azurecontainerapps.io` |
| `FRONTEND_URL` | `https://portal-cfotech.<region>.azurecontainerapps.io` |
| `PORT` | `5000` |

### `job-matcher-api`

| Variable | Valor en Azure |
|----------|----------------|
| `ANTHROPIC_API_KEY` | `@Microsoft.KeyVault(...)` |
| `CORS_ORIGINS` | `https://portal-cfotech.<region>.azurecontainerapps.io` |
| `PORT` | `5002` |

### `bandas-api`

| Variable | Valor en Azure |
|----------|----------------|
| `ASPNETCORE_URLS` | `http://+:5050` |
| `AllowedOrigins` | `https://portal-cfotech.<region>.azurecontainerapps.io` |

### `survey-api`

| Variable | Valor en Azure |
|----------|----------------|
| `ASPNETCORE_URLS` | `http://+:5055` |
| `AllowedOrigins` | `https://portal-cfotech.<region>.azurecontainerapps.io` |
| `SurveyMonkey__AccessToken` | `@Microsoft.KeyVault(...)` |

> Los valores `@Microsoft.KeyVault(secretUri=...)` referencian secretos en Azure Key Vault — nunca se almacenan en texto en los workflows ni en el código.

---

## Dockerfiles

### `Dockerfile.gateway`

```dockerfile
# ── Etapa 1: build de todos los frontends React ───────────────────────────────
FROM node:20-slim AS frontend-builder
WORKDIR /build

# Portal shell
COPY package*.json ./
RUN npm ci
COPY src/ ./src/
COPY index.html vite.config.ts tsconfig*.json ./
COPY public/ ./public/
RUN npm run build

# Reporte DevOps frontend
COPY REPORTE_DEV_OPS/frontend/ ./REPORTE_DEV_OPS/frontend/
RUN cd REPORTE_DEV_OPS/frontend && npm ci && npm run build

# Job Matcher frontend
COPY JOB_MATCHER/frontend/ ./JOB_MATCHER/frontend/
RUN cd JOB_MATCHER/frontend && npm ci && npm run build

# Bandas Salariales frontend
COPY BANDAS_SALARIALES/bandas-frontend/ ./BANDAS_SALARIALES/bandas-frontend/
RUN cd BANDAS_SALARIALES/bandas-frontend && npm ci && npm run build

# Survey frontend
COPY SURVEY/survey-frontend/ ./SURVEY/survey-frontend/
RUN cd SURVEY/survey-frontend && npm ci && npm run build

# Audio a Texto frontend
COPY WS_A_TEXTO/web/frontend/ ./WS_A_TEXTO/web/frontend/
RUN cd WS_A_TEXTO/web/frontend && npm ci && npm run build

# ── Etapa 2: runtime Python ───────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# FFmpeg — requerido por pydub para convertir OGG/MP3/M4A a WAV
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Dependencias Python del gateway
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Dependencias de Audio a Texto (Whisper, anthropic, pydub)
COPY WS_A_TEXTO/requirements.txt ./requirements-ws.txt
RUN pip install --no-cache-dir -r requirements-ws.txt

# Código del gateway y módulo WS_A_TEXTO
COPY portal_server.py ./
COPY WS_A_TEXTO/ ./WS_A_TEXTO/

# Pre-descarga del modelo Whisper 'base' en la imagen
# (evita timeout de 2-5 min en el primer request de transcripción)
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('base')"

# Copiar los builds de frontend generados en etapa 1
COPY --from=frontend-builder /build/dist/                                    ./dist/
COPY --from=frontend-builder /build/REPORTE_DEV_OPS/frontend/dist/          ./REPORTE_DEV_OPS/frontend/dist/
COPY --from=frontend-builder /build/JOB_MATCHER/frontend/dist/              ./JOB_MATCHER/frontend/dist/
COPY --from=frontend-builder /build/BANDAS_SALARIALES/bandas-frontend/dist/ ./BANDAS_SALARIALES/bandas-frontend/dist/
COPY --from=frontend-builder /build/SURVEY/survey-frontend/dist/            ./SURVEY/survey-frontend/dist/
COPY --from=frontend-builder /build/WS_A_TEXTO/web/frontend/dist/           ./WS_A_TEXTO/web/frontend/dist/

EXPOSE 8080
CMD ["uvicorn", "portal_server:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
```

### `Dockerfile.reporte-devops`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY REPORTE_DEV_OPS/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY REPORTE_DEV_OPS/backend/ ./
EXPOSE 5000
CMD ["python", "app.py"]
```

### `Dockerfile.job-matcher`

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY JOB_MATCHER/backend/package*.json ./
RUN npm ci --omit=dev
COPY JOB_MATCHER/backend/ ./
EXPOSE 5002
CMD ["node", "server.js"]
```

### `Dockerfile.bandas`

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY BANDAS_SALARIALES/BandasSalariales.Web/ ./
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish ./
EXPOSE 5050
ENV ASPNETCORE_URLS=http://+:5050
ENTRYPOINT ["dotnet", "BandasSalariales.Web.dll"]
```

### `Dockerfile.survey`

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY SURVEY/SurveyApp.Web/ ./
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish ./
EXPOSE 5055
ENV ASPNETCORE_URLS=http://+:5055
ENTRYPOINT ["dotnet", "SurveyApp.Web.dll"]
```

---

## GitHub Actions Workflows

### `.github/workflows/deploy-gateway.yml`

```yaml
name: Deploy → portal-gateway

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'public/**'
      - 'index.html'
      - 'vite.config.ts'
      - 'package*.json'
      - 'portal_server.py'
      - 'requirements.txt'
      - 'WS_A_TEXTO/**'
      - 'REPORTE_DEV_OPS/frontend/**'
      - 'JOB_MATCHER/frontend/**'
      - 'BANDAS_SALARIALES/bandas-frontend/**'
      - 'SURVEY/survey-frontend/**'
      - 'Dockerfile.gateway'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login en Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Login en ACR
        run: az acr login --name ${{ secrets.ACR_NAME }}

      - name: Build y push imagen
        run: |
          IMAGE=${{ secrets.ACR_SERVER }}/portal-gateway
          docker build -f Dockerfile.gateway -t $IMAGE:${{ github.sha }} -t $IMAGE:latest .
          docker push $IMAGE:${{ github.sha }}
          docker push $IMAGE:latest

      - name: Deploy a Container Apps
        run: |
          az containerapp update \
            --name portal-gateway \
            --resource-group rg-portal-cfotech \
            --image ${{ secrets.ACR_SERVER }}/portal-gateway:${{ github.sha }}
```

### `.github/workflows/deploy-reporte-devops.yml`

```yaml
name: Deploy → reporte-devops-api

on:
  push:
    branches: [main]
    paths:
      - 'REPORTE_DEV_OPS/backend/**'
      - 'Dockerfile.reporte-devops'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login en Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Login en ACR
        run: az acr login --name ${{ secrets.ACR_NAME }}

      - name: Build y push imagen
        run: |
          IMAGE=${{ secrets.ACR_SERVER }}/reporte-devops-api
          docker build -f Dockerfile.reporte-devops -t $IMAGE:${{ github.sha }} -t $IMAGE:latest .
          docker push $IMAGE:${{ github.sha }}
          docker push $IMAGE:latest

      - name: Deploy a Container Apps
        run: |
          az containerapp update \
            --name reporte-devops-api \
            --resource-group rg-portal-cfotech \
            --image ${{ secrets.ACR_SERVER }}/reporte-devops-api:${{ github.sha }}
```

> Los workflows de `deploy-job-matcher.yml`, `deploy-bandas.yml` y `deploy-survey.yml` siguen el mismo patrón cambiando el Dockerfile, el nombre del Container App y los paths de trigger.

---

## Secrets requeridos en GitHub

Configurar en **Settings → Secrets and variables → Actions**:

| Secret | Descripción |
|--------|-------------|
| `AZURE_CREDENTIALS` | JSON del Service Principal (`az ad sp create-for-rbac`) |
| `ACR_NAME` | Nombre del Container Registry (ej: `cfotechacr`) |
| `ACR_SERVER` | Login server del ACR (ej: `cfotechacr.azurecr.io`) |

Los secretos de aplicación (`ANTHROPIC_API_KEY`, `AZURE_DEVOPS_PAT`, etc.) van en **Azure Key Vault** y se referencian desde los Container Apps — nunca pasan por GitHub.

---

## Simplificación de CORS y postMessage al migrar

Al tener un único dominio público, toda la complejidad de orígenes múltiples desaparece:

| Configuración | Local | Azure (Container Apps) |
|---------------|-------|------------------------|
| Dominio del portal | `http://localhost:5174` | `https://portal-cfotech.<region>.azurecontainerapps.io` |
| Orígenes de apps | `localhost:5001`, `:5173`, `:5003`, `:5176` | Mismo dominio del portal (same-origin) |
| `ALLOWED_APP_ORIGINS` en `App.tsx` | Lista de 4 localhost:puerto | Un único dominio Azure |
| `postMessage` targetOrigin | Puerto exacto por app | Dominio Azure único |
| CORS entre frontend y backend | Necesario (cross-origin) | Same-origin vía gateway — CORS solo para backends externos |

### Cambio en `src/App.tsx`

```typescript
// Antes (local):
const ALLOWED_APP_ORIGINS = [
  `http://${_H}:5001`,
  `http://${_H}:5173`,
  `http://${_H}:5003`,
  `http://${_H}:5176`,
  `http://${_H}:5009`,
]

// Después (soporta ambos):
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || `http://${_H}:5174`
const ALLOWED_APP_ORIGINS = [
  PORTAL_URL,                  // Azure: el gateway es same-origin con todas las apps
  `http://${_H}:5001`,         // local: RDO
  `http://${_H}:5173`,         // local: Bandas
  `http://${_H}:5003`,         // local: Job Matcher
  `http://${_H}:5176`,         // local: Survey
  `http://${_H}:5009`,         // local: Audio a Texto
]
```

En Azure, `VITE_PORTAL_URL` se setea a la URL del Container App durante el build en GitHub Actions.

---

## Recursos Azure a crear

```
Resource Group: rg-portal-cfotech (region: eastus)
│
├── Azure Container Registry: cfotechacr
│   └── admin account habilitada (para Container Apps pull)
│
├── Azure Key Vault: kv-portal-cfotech
│   ├── Secret: anthropic-api-key
│   ├── Secret: azure-devops-pat
│   └── Secret: surveymonkey-access-token
│
├── Log Analytics Workspace: law-portal-cfotech
│   └── (requerido por Container Apps Environment)
│
└── Container Apps Environment: env-portal-cfotech
    ├── Container App: portal-gateway     (externo, :8080, min 1 réplica)
    ├── Container App: reporte-devops-api (interno, :5000, min 0 réplicas)
    ├── Container App: job-matcher-api    (interno, :5002, min 0 réplicas)
    ├── Container App: bandas-api         (interno, :5050, min 0 réplicas)
    └── Container App: survey-api         (interno, :5055, min 0 réplicas)
```

> El `portal-gateway` tiene `min 1 réplica` (siempre disponible).
> Los backends tienen `min 0` (scale-to-zero cuando no hay tráfico → costo mínimo).

---

## Plan de implementación por fases

### Fase 1 — Infraestructura base (1–2 días)
- [ ] Crear Resource Group + ACR + Key Vault + Container Apps Environment
- [ ] Crear los 5 Container Apps vacíos con la configuración de ingress
- [ ] Cargar secretos en Key Vault
- [ ] Crear Service Principal para GitHub Actions (`az ad sp create-for-rbac`)
- [ ] Configurar secrets en GitHub

### Fase 2 — Cambio en `portal_server.py` (medio día)
- [ ] Agregar variable `_MANAGED` y `backend_managed_url` en la config de `APPS`
- [ ] Modificar `proxy_api()` para usar la URL managed cuando `_MANAGED=true`
- [ ] Verificar que el comportamiento local sigue sin cambios (`npm run dev` + `python portal_server.py`)
- [ ] Tests: `npm run test` (129 tests deben seguir en verde)

### Fase 3 — Dockerfiles (1 día)
- [ ] `Dockerfile.gateway` (multistage — el más complejo, incluye FFmpeg + Whisper)
- [ ] `Dockerfile.reporte-devops`
- [ ] `Dockerfile.job-matcher`
- [ ] `Dockerfile.bandas`
- [ ] `Dockerfile.survey`
- [ ] Build local de cada uno para verificar: `docker build -f Dockerfile.X .`

### Fase 4 — GitHub Actions (1 día)
- [ ] `.github/workflows/deploy-gateway.yml`
- [ ] `.github/workflows/deploy-reporte-devops.yml`
- [ ] `.github/workflows/deploy-job-matcher.yml`
- [ ] `.github/workflows/deploy-bandas.yml`
- [ ] `.github/workflows/deploy-survey.yml`

### Fase 5 — Variables de entorno y CORS (medio día)
- [ ] Actualizar `ALLOWED_APP_ORIGINS` en `src/App.tsx`
- [ ] Configurar `VITE_PORTAL_URL` como variable de build en los workflows
- [ ] Verificar `PORTAL_ORIGIN` / `AllowedOrigins` en cada backend apuntando al dominio Azure

### Fase 6 — Smoke test completo (medio día)
- [ ] Push a `main` → verificar que los 5 workflows corren en verde
- [ ] Abrir `https://portal-cfotech.<region>.azurecontainerapps.io`
- [ ] Verificar que cada app carga en su iframe
- [ ] Verificar que el botón "Salir" de cada app vuelve al portal
- [ ] Verificar Audio a Texto con un archivo OGG de prueba

---

## Decisiones técnicas

| Decisión | Razón |
|----------|-------|
| Container Apps en lugar de App Service | Soporta múltiples runtimes (Python + .NET + Node) en la misma plataforma. Backends privados sin exponer puertos. Scale-to-zero en idle. |
| Un único punto de entrada (portal-gateway) | Sin cambio de arquitectura del portal — el gateway sigue siendo el proxy central. Las apps no necesitan saber que están en Azure. |
| `PORTAL_MANAGED` como feature flag | El código local no cambia. Se activa solo en Azure. Los 129 tests siguen corriendo sin modificaciones. |
| Audio a Texto inline en el gateway | Ya está montado como router FastAPI. Extraerlo sería complejidad innecesaria. El gateway container incluye FFmpeg y Whisper. |
| Modelo Whisper pre-descargado en la imagen | Evita timeout de 2–5 minutos en el primer request de transcripción tras un deploy. El modelo está en la imagen, no en disco efímero. |
| backends en `min 0` réplicas | Scale-to-zero cuando no hay uso. El gateway (siempre en `min 1`) actúa como warm entry point. |
| Key Vault para secretos | Los secrets nunca aparecen en variables de entorno en texto plano ni en GitHub. Se referencian por URI. |
| Path filters en GitHub Actions | Solo se redeploya el servicio que cambió. Si cambia solo el backend de RDO, no se rebuilda la imagen del gateway (que tarda ~5 min por los npm builds). |

---

## Comandos de referencia — Azure CLI

```bash
# Crear el Service Principal para GitHub Actions
az ad sp create-for-rbac \
  --name sp-portal-cfotech-github \
  --role contributor \
  --scopes /subscriptions/{sub-id}/resourceGroups/rg-portal-cfotech \
  --json-auth
# Copiar el JSON completo → GitHub Secret: AZURE_CREDENTIALS

# Ver URL del portal-gateway
az containerapp show \
  --name portal-gateway \
  --resource-group rg-portal-cfotech \
  --query properties.configuration.ingress.fqdn -o tsv

# Ver logs en tiempo real del gateway
az containerapp logs show \
  --name portal-gateway \
  --resource-group rg-portal-cfotech \
  --follow

# Forzar restart del gateway (ej: tras actualizar Key Vault)
az containerapp revision restart \
  --name portal-gateway \
  --resource-group rg-portal-cfotech \
  --revision $(az containerapp revision list \
      --name portal-gateway \
      --resource-group rg-portal-cfotech \
      --query "[0].name" -o tsv)
```

---

*Documento generado el 2026-06-25 · Portal de Acceso CFOTech v1.x*
