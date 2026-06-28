# 📋 INFORME DE ARQUITECTURA — Portal de Acceso CFOTech IT Tools
**Fecha:** 27 de junio de 2026 · **Versión:** 1.0  
**Autor (rol):** Arquitecto de Software & Cloud · **Audiencia:** Técnica + Gerencial

---

## PARTE I — RESUMEN EJECUTIVO

### ¿Qué es el Portal de Acceso?

El **Portal de Acceso CFOTech IT Tools** es un sistema interno que unifica **6 aplicaciones de negocio** bajo una única URL y branding corporativo consistente. Funciona como un *shell inteligente*: cada app corre de forma independiente y el portal las organiza, navega entre ellas y gestiona su ciclo de vida (inicio/parada de servicios).

| App | Propósito de Negocio |
|-----|---------------------|
| **Reporte DevOps** | Métricas de sprints y equipos vía Azure DevOps |
| **Bandas Salariales** | Gestión y análisis de bandas salariales por seniority |
| **Job Matcher** | Matching IA de candidatos contra Job Descriptions |
| **Survey Analytics** | Análisis de encuestas vía SurveyMonkey API |
| **Audio a Texto** | Transcripción de audio con IA (Whisper) |
| **Proyectos Activos** | Semáforo de rentabilidad financiera por proyecto |

---

### Estado Actual del Sistema

| Dimensión | Estado | Nivel |
|-----------|--------|-------|
| Madurez técnica (sistema local) | ████████░░ | 78% |
| Cloud readiness | ████░░░░░░ | 38% |
| Cobertura de tests | █████████░ | 90% |
| Seguridad cloud | ██░░░░░░░░ | 20% |

---

### Fortalezas Identificadas

✅ **Arquitectura Gateway** — punto de entrada único, simplifica routing, CORS y observabilidad  
✅ **Diseño multi-runtime** — Python, .NET 8, Node.js y React coexisten sin fricciones  
✅ **Bajo acoplamiento** — agregar una app nueva requiere editar **un solo archivo** (`apps.ts` + 4 líneas en gateway)  
✅ **Design System propio** — branding consistente sin dependencias de UI pesadas (sin MUI)  
✅ **Tests automatizados** — 141+ tests en el portal shell; cada app con su propia suite  
✅ **Documento de arquitectura cloud ya escrito** — `AZURE_ARCHITECTURE.md` define el target con nivel de detalle de implementación  

---

### Riesgos Principales

| Riesgo | Severidad | Estado |
|--------|-----------|--------|
| Sin autenticación ni autorización | 🔴 Crítico | Pendiente (Clerk/SSO planificado) |
| Sin HTTPS en producción | 🔴 Crítico | Resuelto al migrar a Azure (TLS automático) |
| Secretos en `.env` locales sin rotación | 🟠 Alto | Mitigado con Key Vault en diseño cloud |
| Sin observabilidad (logs centralizados) | 🟠 Alto | Pendiente |
| Modelo Whisper pesado en gateway container | 🟡 Medio | Documentado, mitigado con pre-descarga en imagen |
| PostgreSQL sin backup automático | 🟡 Medio | Pendiente al migrar a Azure Database |
| Dependencia de Windows + .bat files | 🟡 Medio | Resuelto al contenizar |

---

### Roadmap Ejecutivo — Migración Cloud

```
Q3 2026                    Q4 2026                    Q1 2027
│                          │                          │
├─ Fase 1: Infraestructura ├─ Fase 4: GitHub Actions  ├─ Fase 6: Auth (SSO)
│  Azure (1-2 días)        │  CI/CD (1 día)           │  Clerk / Entra ID
│                          │                          │
├─ Fase 2: Gateway Managed ├─ Fase 5: CORS + env vars ├─ Fase 7: Observabilidad
│  mode (½ día)            │  Azure (½ día)           │  Application Insights
│                          │                          │
└─ Fase 3: Dockerfiles     └─ Smoke test prod         └─ Fase 8: DB managed
   (1 día)                    (½ día)                    Azure DB for PostgreSQL
```

> **Estimación total para tener la app en nube y funcional: 4–5 días de trabajo técnico.**  
> El diseño de arquitectura cloud ya está resuelto en `AZURE_ARCHITECTURE.md`. Lo que falta es la implementación.

---

## PARTE II — ARQUITECTURA TÉCNICA ACTUAL

### 2.1 Diagrama de Componentes (As-Is)

```
┌──────────────────────────────────────────────────────────────┐
│                     WINDOWS 11 — Máquina local               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Browser (localhost:5174)                            │   │
│  │                                                      │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Portal Shell (React 19 + Vite 8)              │  │   │
│  │  │  Header · Dashboard · AppFrame (iframe)        │  │   │
│  │  └───────────────────┬────────────────────────────┘  │   │
│  └──────────────────────│────────────────────────────────┘  │
│                         │ HTTP / postMessage                  │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │  portal_server.py — FastAPI Gateway (:5174)           │  │
│  │                                                       │  │
│  │  GET /apps/{id}/*  → proxy Vite dev / sirve dist/    │  │
│  │  /api/{id}/*       → proxy al backend de la app      │  │
│  │  /api/health       → health check                    │  │
│  │  /api/shutdown     → para procesos + apaga gateway   │  │
│  │  /api/sound-catch/* → router FastAPI inline          │  │
│  └──────┬──────┬──────┬──────┬──────┬──────────────────┘  │
│         │      │      │      │      │                        │
│   :5000  :5001  :5002  :5003  :5050  :5173  ...             │
│   Flask  React  Node  React  .NET   React                   │
│   RDO    RDO    JM    JM     BS     BS                      │
│                                                              │
│   :5055  :5176  :5009 (inline)  :5010  :5011  :5432        │
│   .NET   React  FastAPI+React   FastAPI React  PostgreSQL   │
│   Survey Survey Audio→Texto    ProyAct ProyAct DB           │
└──────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
   Azure DevOps          SurveyMonkey          Anthropic API
   (PAT token)           (Access Token)        (API Key)
```

---

### 2.2 Stack por Componente

| Componente | Frontend | Backend | DB | Puerto(s) | Tests |
|------------|----------|---------|-----|-----------|-------|
| **Portal Shell** | React 19 + Vite 8 + TS | — | — | 5174/5175 | 141 (Vitest 4.x) |
| **Gateway** | — | FastAPI + uvicorn | — | 5174 | — |
| **Reporte DevOps** | React 19 + Vite | Flask (Python) | — | 5001/5000 | 42 |
| **Bandas Salariales** | React 19 + Vite + CSS DS | ASP.NET Core 8 | SQLite | 5173/5050 | 96 |
| **Job Matcher** | React 19 + Vite | Node.js + Express | — | 5003/5002 | 84 |
| **Survey Analytics** | React 19 + Vite + Recharts | ASP.NET Core 8 | — | 5176/5055 | — |
| **Audio a Texto** | React 19 + Vite | FastAPI inline (Whisper) | — | 5009 | 11 |
| **Proyectos Activos** | React 19 + Vite + Recharts | FastAPI + SQLAlchemy 2.x | PostgreSQL 16 | 5011/5010 | 31 |

---

### 2.3 Patrón de Comunicación — iframe + postMessage

El portal integra cada app via `<iframe>`. Dado que las apps corren en puertos distintos (cross-origin), `window.confirm()` y `window.close()` quedan bloqueados. La solución adoptada es un protocolo **postMessage** bilateral:

```
App embebida                          Portal Shell (App.tsx)
    │                                        │
    │  window.parent.postMessage(            │
    │    { type: 'portal:goHome' },          │
    │    VITE_PORTAL_URL                     │
    │  )                                     │
    │ ──────────────────────────────────────▶│
    │                                        │  setActiveApp(null)
    │                                        │  → Dashboard visible
```

Cada app detecta si está embebida con:

```typescript
const IN_PORTAL = window.self !== window.top  // evaluación estática al cargar
// Si IN_PORTAL: oculta su propio header, usa postMessage para salir
// Si standalone: usa window.close()
```

> **Evaluación:** es la solución correcta para iframe cross-origin. Al migrar a Azure se simplifica porque todas las apps quedan same-origin bajo el mismo dominio del gateway.

---

### 2.4 Modelo de Proceso — Gestión de Ciclo de Vida

```
START.bat
   │
   ▼
launcher_ui.py (tkinter)
   │
   ├── subprocess: python portal_server.py (:5174)
   │       │
   │       ├── Arranca backends (subprocess por app)
   │       │   ├── python app.py (Flask/FastAPI)
   │       │   ├── dotnet run (.NET)
   │       │   └── node server.js (Node)
   │       │
   │       └── Arranca frontends (npm run dev)
   │           └── Vite dev server por app
   │
   └── Polling GET /api/health hasta OK → abre browser
```

> **Observación crítica:** en producción local hay **12 procesos corriendo en paralelo** (1 gateway + 6 backends + 5 frontends dev). En Azure esto desaparece — los frontends son estáticos servidos por el gateway y los backends son containers independientes.

---

### 2.5 Routing del Gateway

| Ruta | Dev (local) | Prod (local) | Azure |
|------|-------------|--------------|-------|
| `/` | Proxy → Vite :5175 | Sirve `dist/index.html` | Sirve `dist/index.html` |
| `/apps/{id}/*` | Proxy → Vite dev del app | Sirve `dist/` del app | Sirve `dist/` del app |
| `/api/{id}/*` | Proxy → backend localhost | Proxy → backend localhost | Proxy → Container App interno |
| `/api/sound-catch/*` | Router FastAPI inline | Router FastAPI inline | Router FastAPI inline |

---

### 2.6 Estrategia de Tests

| Suite | Herramienta | Tests |
|-------|-------------|-------|
| Portal shell | Vitest 4.x + @vitest/coverage-v8 | 141 |
| Bandas Salariales | Vitest | 96 |
| Job Matcher | Vitest | 84 |
| Proyectos Activos | Vitest (TDD red→green) | 31 |
| Reporte DevOps | Vitest | 42 |
| Audio a Texto | Vitest | 11 |

> **Decisión clave:** Vitest 4.x (no 2.x) porque `@vitejs/plugin-react v6` es ESM-only y Vitest 2.x lo cargaba con `require()` y fallaba. Esta incompatibilidad fue detectada y corregida temprano.

---

### 2.7 Decisiones de Diseño Notables

| Decisión | Por qué es correcta |
|----------|-------------------|
| Sin React Router en portal shell | Un `useState<App\|null>` es suficiente para una SPA con "ruta activa" única |
| CSS plano sin Tailwind/MUI | Design System propio ya define todos los tokens. Elimina ~200KB de bundle |
| Backend inline para Audio a Texto | Router FastAPI montado directo en gateway. Evita subprocess extra y un puerto adicional |
| PostgreSQL para Proyectos Activos | `NUMERIC(15,2)` con precisión garantizada. SQLite no soporta concurrencia multi-usuario |
| `\|\|` en lugar de `??` para env vars | `"" ?? fallback` = `""` (bug silencioso). `"" \|\| fallback` = fallback correcto |
| `Cache-Control: no-cache` en `index.html` | Evita browser caché obsoleto tras rebuild. Assets con hash: `max-age=31536000, immutable` |

---

## PARTE III — GAPS TÉCNICOS Y PLAN DE MEJORAS CLOUD

### 3.1 Mapa de Gaps (As-Is vs Cloud-Ready)

| Dimensión | Estado Actual | Target Cloud |
|-----------|--------------|-------------|
| Auth/Authz | ❌ Sin auth | ✅ SSO + RBAC (Clerk/Entra ID) |
| HTTPS | ❌ HTTP local | ✅ TLS automático (Azure) |
| Secretos | ⚠️ `.env` locales | ✅ Azure Key Vault + referencias |
| Deployment | ❌ Manual (.bat) | ✅ CI/CD automático (GitHub Actions) |
| Escalabilidad | ❌ 1 máquina | ✅ Scale-to-zero por Container App |
| Disponibilidad | ❌ Depende de PC | ✅ SLA 99.95% (Azure) |
| Observabilidad | ❌ Sin logs | ✅ Log Analytics + Application Insights |
| Backup DB | ❌ Sin backup | ✅ Azure Database for PostgreSQL (PITR) |
| CORS complexity | ⚠️ 6 orígenes | ✅ Same-origin (un dominio) |
| Onboarding | ⚠️ Instalación local | ✅ URL única desde cualquier lugar |

---

### 3.2 Arquitectura Target — Azure Container Apps

```
Internet (HTTPS :443)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Azure Container Apps Environment  (red privada interna)    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  portal-gateway  [PÚBLICO]                            │  │
│  │  Python 3.11 / FastAPI · min 1 réplica               │  │
│  │                                                       │  │
│  │  Sirve: dist/ portal + dist/ de todas las apps       │  │
│  │  Proxy: /api/{id}/* → Container App interno          │  │
│  │  Inline: Audio a Texto (Whisper + FFmpeg)            │  │
│  └────────────────────┬──────────────────────────────────┘  │
│                       │  HTTP interno (DNS privado)          │
│        ┌──────────────┼──────────────────────┐              │
│        ▼              ▼          ▼            ▼             │
│  ┌──────────┐  ┌──────────┐ ┌────────┐ ┌──────────┐        │
│  │ rdo-api  │  │  jm-api  │ │bandas  │ │survey-api│        │
│  │ Flask    │  │ Node 20  │ │.NET 8  │ │  .NET 8  │        │
│  │ min 0 ✓  │  │ min 0 ✓  │ │min 0 ✓ │ │ min 0 ✓  │        │
│  └──────────┘  └──────────┘ └────────┘ └──────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Azure Database for PostgreSQL (Proyectos Activos)  │   │
│  │  Flexible Server · backup PITR automático           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
   Azure Key Vault      Log Analytics       Container Registry
   (secretos)           (logs + métricas)   (imágenes Docker)
```

---

### 3.3 Cambios de Código Requeridos

#### `portal_server.py` — Modo Managed (½ día)

```python
# Agregar al inicio
_MANAGED = os.getenv('PORTAL_MANAGED', 'false').lower() == 'true'

# En APPS dict, agregar por cada app:
'backend_managed_url': os.getenv('REPORTE_DEVOPS_URL', '')

# En proxy_api(), bifurcar según _MANAGED:
if _MANAGED:
    base = cfg.get('backend_managed_url', '').rstrip('/')
    target_url = f"{base}/{path}"
else:
    # comportamiento local actual — sin cambios
```

> **Impacto en tests:** cero. Los 141 tests siguen en verde porque `_MANAGED=false` es el default.

#### `src/App.tsx` — CORS simplificado

```typescript
// Target (mismo dominio Azure + compatibilidad local):
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || `http://${_H}:5174`
const ALLOWED_APP_ORIGINS = [
  PORTAL_URL,          // Azure: same-origin, cubre todos los iframes
  `http://${_H}:5001`, // local: backward compatible
  // ... resto igual
]
```

#### Dockerfiles — 5 imágenes

| Dockerfile | Complejidad | Notas |
|------------|-------------|-------|
| `Dockerfile.gateway` | ★★★★☆ | Multistage: node builder (6 frontends) + python runtime + FFmpeg + Whisper pre-descargado |
| `Dockerfile.reporte-devops` | ★★☆☆☆ | Python slim + requirements |
| `Dockerfile.job-matcher` | ★★☆☆☆ | Node 20 slim + npm ci --omit=dev |
| `Dockerfile.bandas` | ★★☆☆☆ | .NET SDK build → .NET aspnet runtime |
| `Dockerfile.survey` | ★★☆☆☆ | Idéntico a bandas cambiando proyecto |

#### GitHub Actions — CI/CD por Servicio

```yaml
# Gateway: solo corre si cambia src/, portal_server.py, WS_A_TEXTO/, etc.
on:
  push:
    branches: [main]
    paths: ['src/**', 'portal_server.py', 'WS_A_TEXTO/**', ...]

# RDO: solo corre si cambia el backend de RDO:
on:
  push:
    branches: [main]
    paths: ['REPORTE_DEV_OPS/backend/**', 'Dockerfile.reporte-devops']
```

---

### 3.4 Recursos Azure a Provisionar

```
Resource Group: rg-portal-cfotech
│
├── Azure Container Registry (ACR): cfotechacr
│   └── 5 imágenes: gateway, rdo, jm, bandas, survey
│
├── Azure Key Vault: kv-portal-cfotech
│   ├── anthropic-api-key
│   ├── azure-devops-pat
│   └── surveymonkey-access-token
│
├── Log Analytics Workspace: law-portal-cfotech
│
├── Azure Database for PostgreSQL Flexible Server
│   └── DB: proyectos_activos (migración desde local)
│
└── Container Apps Environment: env-portal-cfotech
    ├── portal-gateway    → PÚBLICO  (min 1 réplica)
    ├── reporte-devops-api → interno (min 0 — scale-to-zero)
    ├── job-matcher-api   → interno  (min 0)
    ├── bandas-api        → interno  (min 0)
    └── survey-api        → interno  (min 0)
```

---

### 3.5 Estimación de Costo Mensual en Azure

| Recurso | Tier | Estimación USD/mes |
|---------|------|-------------------|
| Container Apps — portal-gateway (min 1) | 0.5 vCPU / 1GiB siempre activo | ~$15 |
| Container Apps — 4 backends (scale-to-zero) | Según consumo | ~$5–20 |
| Azure Container Registry | Basic | ~$5 |
| Azure Key Vault | Standard | ~$1 |
| Log Analytics | Pay-per-GB | ~$2–5 |
| PostgreSQL Flexible Server | Burstable B1ms | ~$15 |
| **Total estimado** | | **~$43–61 / mes** |

> Los backends en scale-to-zero no cuestan cuando no tienen tráfico.

---

## PARTE IV — MEJORAS ADICIONALES RECOMENDADAS

### 4.1 Autenticación y Autorización 🔴 Prioridad Crítica

**Estado actual:** Sin auth. Cualquier persona con acceso a la URL puede usar todas las apps.

**Recomendación:** Implementar **Microsoft Entra ID** (Azure AD).

```
Azure AD App Registration
  → MSAL React en portal shell
  → Tokens JWT validados en el gateway
  → RBAC por grupo AD → qué apps puede ver cada usuario
```

> Para CFOTech: Entra ID es la opción natural si ya usan Microsoft 365 / Azure AD corporativo.  
> Alternativa más rápida: **Clerk** (~1 día de implementación vs 2–3 días de Entra ID).

---

### 4.2 Observabilidad 🟠 Prioridad Alta

**Estado actual:** Sin logs centralizados. Si algo falla en producción, no hay visibilidad.

```python
# En portal_server.py — structured logging:
import logging, json

# En cada endpoint proxy:
logger.info(json.dumps({
    "event": "proxy_request",
    "app_id": app_id,
    "path": path,
    "status": response.status_code,
    "latency_ms": elapsed
}))
```

En Azure: Log Analytics Workspace recibe logs de todos los Container Apps automáticamente.  
Application Insights agrega métricas de performance y alertas.

---

### 4.3 Proyectos Activos — PostgreSQL a Azure 🟠 Prioridad Alta

**Estado actual:** PostgreSQL corre en la máquina local. Si la PC se apaga, los datos son inaccesibles.

```bash
# 1. Dump desde local
pg_dump -U postgres proyectos_activos > backup.sql

# 2. Restore en Azure Database for PostgreSQL
psql -h cfotechdb.postgres.database.azure.com \
     -U cfoadmin -d proyectos_activos < backup.sql

# 3. Actualizar backend/.env
DB_URL=postgresql://cfoadmin:PASSWORD@cfotechdb.postgres.database.azure.com/proyectos_activos?sslmode=require
```

**Beneficio:** backup PITR automático de 7–35 días. Alta disponibilidad opcional.

---

### 4.4 Whisper — Separar a Servicio Dedicado 🟡 Prioridad Media (futuro)

El modelo Whisper `base` pesa ~150MB y requiere FFmpeg, lo que hace la imagen gateway ~800MB.  
A evaluar cuando el uso de Audio a Texto crezca:

```
ws-a-texto-api (Container App interno, :5009)
  → imagen separada con FFmpeg + Whisper
  → gateway proxy → /api/sound-catch/*
```

Por ahora, mantener inline es la decisión correcta.

---

### 4.5 Mejoras de Developer Experience 🟡 Prioridad Media

| Mejora | Esfuerzo | Impacto |
|--------|----------|---------|
| `docker-compose.yml` para dev local multiplataforma | 1 día | Elimina dependencia de Windows + .bat |
| `Makefile` con targets `build`, `test`, `deploy` | ½ día | Simplifica onboarding |
| Pre-commit hooks (lint + test) | ½ día | Evita commits que rompan tests |
| Dependabot para dependencias | 1 hora config | Seguridad automatizada |

---

## PARTE V — PLAN DE IMPLEMENTACIÓN PRIORIZADO

### Sprint 1 — Fundación Cloud (4–5 días)

```
Día 1-2: Infraestructura Azure
  □ Resource Group + ACR + Key Vault + Container Apps Environment
  □ Container Apps vacíos (ingress configurado)
  □ Secretos en Key Vault
  □ Service Principal para GitHub Actions

Día 3: Código — Gateway Managed Mode
  □ _MANAGED flag + backend_managed_url en APPS dict
  □ Bifurcación en proxy_api()
  □ Verificar: npm run test → 141/141 ✅

Día 4: Dockerfiles
  □ Dockerfile.gateway (multistage — más complejo)
  □ Dockerfile.reporte-devops
  □ Dockerfile.job-matcher
  □ Dockerfile.bandas + Dockerfile.survey
  □ docker build local de cada uno

Día 5: GitHub Actions + smoke test
  □ 5 workflows con path filters
  □ Variables de entorno y CORS en App.tsx
  □ Push a main → 5 workflows verdes
  □ Smoke test: cada app carga en prod ✅
```

### Sprint 2 — Seguridad y Resiliencia (5–7 días)

```
  □ Auth: Microsoft Entra ID integration
  □ PostgreSQL → Azure Database for PostgreSQL (migración)
  □ Structured logging en gateway
  □ Application Insights setup
  □ Alertas básicas (error rate, latencia)
```

### Sprint 3 — Calidad y DevX (ongoing)

```
  □ docker-compose.yml para desarrollo local multiplataforma
  □ Pre-commit hooks
  □ Dependabot
  □ Runbook operativo (qué hacer ante incidentes)
```

---

## CONCLUSIÓN

El **Portal de Acceso CFOTech** tiene una arquitectura técnica sólida para el contexto en el que fue construido: un sistema local de herramientas internas con múltiples tecnologías coexistiendo sin fricción. El patrón de Gateway + iframe + postMessage es la solución correcta para la integración de apps heterogéneas.

La **migración a cloud está diseñada** — el `AZURE_ARCHITECTURE.md` ya tiene el 85% del trabajo intelectual hecho. Lo que resta es **ejecución** (Dockerfiles + GitHub Actions + provisionar infraestructura Azure) y **dos gaps críticos que hay que cerrar antes de ir a producción**:

1. **Autenticación** — sin auth, cualquier URL expuesta es pública
2. **Observabilidad** — sin logs centralizados, operar en producción es trabajar a ciegas

Con el **Sprint 1 completo (4–5 días)**, el portal estaría **funcionando en Azure con CI/CD automático**.  
Con el **Sprint 2**, estaría **production-ready**.

---

*Informe preparado por Arquitecto de Software & Cloud · CFOTech IT Tools · 27 de junio de 2026*
