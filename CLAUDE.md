# CLAUDE.md — Portal de Acceso CFOTech

Guía operativa para sesiones de Claude Code. Arquitectura detallada → `ARQUITECTURA.md`.

---

## ¿Qué es este proyecto?

**Shell unificado** que expone todas las apps internas de CFOTech IT Tools desde un único punto de acceso.

El portal actúa como contenedor: renderiza cada app en un `<iframe>`. Las apps siguen viviendo en sus propias URLs y puertos; el portal solo las organiza, navega entre ellas y mantiene el branding corporativo consistente.

**Principio de diseño central:** agregar una nueva app requiere editar un único archivo de registro (`src/registry/apps.ts`) — no hay que tocar componentes ni rutas.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | **React 19** + **Vite 8** · TypeScript strict |
| Tests | **Vitest 4.x** + @vitest/coverage-v8 (requerido por Vite 8 + plugin-react v6 ESM) |
| Navegación | `useState<App | null>` en `App.tsx` — sin React Router |
| Estilos | CSS plano con variables del Design System (sin Tailwind, sin MUI) |
| Integración de apps | `<iframe>` + postMessage protocol |
| Comunicación portal ↔ apps | `window.parent.postMessage` / `window.addEventListener('message')` |
| Gateway | **FastAPI** (`portal_server.py`) en `:5174` — sirve portal + apps vía `/apps/{id}/` |
| Auth | No implementada — planificada con Clerk/Google SSO |
| Runtime | Windows 11 / PowerShell · Node.js 18+ · Python 3.9+ |
| Deploy | Gateway FastAPI + Vite builds estáticos |

> **Gateway unificado:** `portal_server.py` (FastAPI/uvicorn en `:5174`) sirve el portal shell en `/*` y cada app en `/apps/{app_id}/{path}`. En dev: proxied a Vite dev servers por puerto. En prod: sirve desde `dist/` de cada app.

---

## Estructura de archivos

```
Portal de Acceso\
├── CLAUDE.md                      ← este archivo (operativo)
├── ARQUITECTURA.md                ← referencia técnica — ecosistema, gateway, postMessage, decisiones
├── DESIGN_SYSTEM.md               ← DS del portal
├── package.json                   ← react ^19.2.7, vite ^8.0.16, vitest ^4.1.8
├── vite.config.ts                 ← port 5174
├── .env                           ← VITE_HOST, VITE_PORTAL_PORT, VITE_LAUNCHER_PORT (gitignore)
├── .env.example                   ← plantilla pública del .env raíz
├── START.bat                      ← abre la UI flotante del launcher (pythonw)
├── STOP.bat                       ← mata :5174
│
├── portal_server.py               ← ★ Gateway FastAPI/uvicorn :5174 — sirve portal + apps
│
├── portal-launcher\               ← Servicio local de lanzamiento
│   ├── launcher.py                ← Flask :4999 (legacy)
│   ├── launcher_ui.py             ← UI flotante tkinter — arranca portal_server.py
│   ├── run_ui.vbs                 ← lanza launcher_ui.py sin ventana DOS
│   ├── requirements.txt
│   └── .env
│
├── REPORTE_DEV_OPS\               ← Flask :5000 + React :5001
├── BANDAS_SALARIALES\             ← ASP.NET :5050 + React :5173
├── JOB_MATCHER\                   ← Node.js :5002 + React :5003
├── SURVEY\                        ← ASP.NET :5055 + React :5176
├── WS_A_TEXTO\                    ← FastAPI inline + React :5009
├── PROYECTOS_ACTIVOS\             ← FastAPI :5010 + React :5011 + PostgreSQL :5432
│   ├── backend\                   ← FastAPI + SQLAlchemy + psycopg2
│   ├── etl\                       ← ingest.py (pandas + openpyxl)
│   ├── frontend\                  ← React 19 + Vite :5011 + Recharts
│   └── setup_db.py                ← crea DB + schema + .env del backend
│
└── src\
    ├── main.tsx
    ├── index.css                  ← variables DS + todas las clases del portal
    ├── vite-env.d.ts
    ├── App.tsx                    ← activeApp state + postMessage handler + ALLOWED_APP_ORIGINS
    ├── registry\
    │   └── apps.ts                ← ★ REGISTRO CENTRAL — editar aquí para agregar apps
    ├── components\
    │   ├── Header.tsx
    │   └── AppFrame.tsx
    ├── api\
    │   └── launcher.ts
    ├── pages\
    │   └── Dashboard.tsx
    └── __tests__\
        ├── registry.test.ts       ← invariantes del registro
        └── components.test.tsx
```

---

## Instalación desde cero (primera vez)

### Requisitos previos

| Herramienta | Versión mínima | Verificar |
|-------------|----------------|-----------|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| Python | 3.9+ | `python --version` |
| .NET SDK | 8.0+ | `dotnet --version` |
| PostgreSQL | 16+ | `psql --version` |
| Git | cualquiera | `git --version` |

> Python debe estar en PATH. Si se instaló desde Microsoft Store puede no estarlo.

### 1 — Clonar

```powershell
git clone https://github.com/EstebanCFO/Portal-Acceso-CFO-Tools.git "C:\Esteban CFOTech\Portal de Acceso"
cd "C:\Esteban CFOTech\Portal de Acceso"
```

### 2 — Dependencias del portal shell

```powershell
npm install
```

### 3 — Dependencias del launcher Python

```powershell
cd portal-launcher ; pip install -r requirements.txt ; cd ..
```

### 4 — Variables de entorno del portal

```powershell
copy .env.example .env
```

Contenido por defecto (funciona en local sin cambios):
```
VITE_HOST=localhost
VITE_PORTAL_PORT=5174
VITE_LAUNCHER_PORT=4999
```

### 5 — Variables de entorno del launcher

```powershell
copy portal-launcher\.env.example portal-launcher\.env
```

### 6 — Variables de entorno de cada app

| App | Archivo | Variables clave |
|-----|---------|-----------------|
| Reporte DevOps | `REPORTE_DEV_OPS/backend/.env` | `AZURE_DEVOPS_PAT`, `AZURE_DEVOPS_ORGS`, `FRONTEND_URL`, `PORTAL_ORIGIN` |
| Job Matcher | `JOB_MATCHER/backend/.env` | `ANTHROPIC_API_KEY`, `PORT=5002`, `CORS_ORIGINS` |
| Survey | `SURVEY/SurveyApp.Web/appsettings.Development.json` | `SurveyMonkey:AccessToken` |
| Proyectos Activos | `PROYECTOS_ACTIVOS/backend/.env` | `DB_URL=postgresql://...` (generado por `setup_db.py`) |
| Bandas | sin secretos | CORS en `appsettings.json` |

### 7 — Setup Proyectos Activos (PostgreSQL)

```powershell
cd PROYECTOS_ACTIVOS
python setup_db.py --password MiPassword123
# Crea DB + schema + backend/.env
cd etl
python ingest.py --file "..\Proyectos Activos 2026.xlsx"
cd ..\..
```

### 8 — Dependencias npm de cada app frontend

```powershell
cd REPORTE_DEV_OPS\frontend         ; npm install ; cd ..\..
cd JOB_MATCHER\frontend             ; npm install ; cd ..\..
cd BANDAS_SALARIALES\bandas-frontend ; npm install ; cd ..\..
cd SURVEY\survey-frontend           ; npm install ; cd ..\..
cd PROYECTOS_ACTIVOS\frontend       ; npm install ; cd ..\..
```

### 9 — Verificar que todo funciona

```powershell
npm run test      # Portal shell: 141/141 tests
.\START.bat       # Levanta el portal completo
```

---

## Cómo levantar el portal

### Opción A — Doble clic (recomendada)

`START.bat` → abre UI flotante → arranca `portal_server.py` → abre browser en `:5174`

La UI flotante muestra spinner mientras espera `/api/health` (hasta 45s).

### Opción B — Terminal (gateway)

```powershell
python portal_server.py   # gateway en http://localhost:5174
```

### Opción C — Dev mode (portal shell solo)

```powershell
npm run dev       # → portal Vite en http://localhost:5175
npm run build     # build de producción en dist/
npm run test      # suite Vitest
```

> En dev, el gateway (`portal_server.py`) sigue siendo necesario en `:5174`.

---

## Variables de entorno

### Portal shell (`.env` raíz)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `VITE_HOST` | Host sin protocolo ni puerto | `localhost` |
| `VITE_PORTAL_PORT` | Puerto del portal | `5174` |
| `VITE_LAUNCHER_PORT` | Puerto del launcher Flask | `4999` |

### Portal Launcher (`portal-launcher/.env`)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del launcher Flask | `4999` |
| `APP_HOST` | Host para abrir el browser | `localhost` |
| `PORTAL_PORT` | Puerto del portal | `5174` |
| `ALLOWED_ORIGINS` | Orígenes CORS (CSV, sin espacios) | `http://localhost:5174` |
| `AUTOSTART_APPS` | Si `true`, lanza todo al iniciar | `false` |

### Frontends de apps

| Variable | Descripción | Default en código |
|----------|-------------|-------------------|
| `VITE_PORTAL_URL` | Destino del postMessage al salir | `http://localhost:5174` |
| `VITE_API_URL` | Prefijo de la API (solo apps con backend propio) | ver app |

> Cada frontend tiene `.env.example` con la plantilla.

---

## Despliegue en red interna

Para acceso desde otras máquinas, cambiar `VITE_HOST` en `.env` raíz y `APP_HOST` + `ALLOWED_ORIGINS` en `portal-launcher/.env`.
Ver tabla completa en `ARQUITECTURA.md`.

---

## Registro de apps (`src/registry/apps.ts`)

Archivo central para declarar todas las apps del portal.
**Agregar una app nueva = agregar un objeto al array `APP_REGISTRY`.**

```typescript
const _H = import.meta.env.VITE_HOST ?? 'localhost'

export const APP_REGISTRY: App[] = [
  {
    id:          'proyectos-activos',
    name:        'Proyectos Activos',
    description: 'Semáforo de rentabilidad y ejercicio económico por proyecto',
    icon:        '💼',
    url:         '/apps/proyectos-activos/',   // ← gateway URL
    type:        'iframe',
    iconBg:      '#EEF2F8',
    iconColor:   '#0A1F44',
    tags:        ['Finanzas', 'Proyectos', 'DC'],
    status:      'active',
    category:    'Delivery Center',
  },
]
```

### Tipos de integración

| `type` | Comportamiento |
|--------|---------------|
| `'iframe'` | La app se renderiza embebida vía `<iframe>` |
| `'link'` | Click en "Abrir" abre la app en nueva pestaña |

### Estados de una app

| `status` | Badge Dashboard | Nav pill | Comportamiento |
|----------|----------------|----------|----------------|
| `'active'` | 🟢 Activa | clickeable | Carga iframe |
| `'maintenance'` | 🟠 Mantenimiento | `.disabled` | Pantalla mantenimiento |
| `'coming-soon'` | ⚪ Próximamente | `.disabled` + badge | Pantalla coming-soon |

---

## postMessage y detección iframe

Ver `ARQUITECTURA.md` para protocolo completo, `ALLOWED_APP_ORIGINS` actualizada y código de referencia.

Resumen rápido:
- Apps → portal: `window.parent.postMessage({ type: 'portal:goHome', appId }, VITE_PORTAL_URL)`
- Detección: `const IN_PORTAL = window.self !== window.top` (módulo-level)
- Si `IN_PORTAL`: ocultar header propio. Botón Salir → postMessage.

---

## Portal Launcher — Gateway (`portal_server.py`)

Endpoints del gateway:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check del gateway |
| GET/POST | `/api/{app_id}/{path}` | Proxy al backend de la app |
| GET | `/apps/{app_id}/{path}` | Proxy al Vite dev / sirve `dist/` |
| POST | `/api/shutdown-portal` | Para subprocesos + `os._exit(0)` |
| POST | `/api/stop-all` | Para subprocesos (mantiene gateway vivo) |

Config completa `APPS` dict y gateway routes → `ARQUITECTURA.md`.

---

## Design System

**Leer `DESIGN_SYSTEM.md` antes de crear cualquier pantalla o componente.**

Tokens clave:
- Header: 48px, `#0B1526`, `border-bottom: 3px solid #1C2E48`
- Logo: 32×32px, `background: #00A878`, r-8, "CFO" blanco 11px bold
- Fondo: `#F4F6F9` (--gray1) · Acento: `#4FD1B2` (--green-a) · Botón: `#0A1F44` (--navy)
- Sin gradientes · Sin sombras pesadas

### Spec vigente del Header

| Atributo | Valor |
|----------|-------|
| Altura | 48px |
| Fondo | `#0B1526` (--navy-dark) |
| Border-bottom | `3px solid #1C2E48` |
| Logo (badge) | 32×32px, r-8, `#00A878`, "CFO" 11px bold |
| Marca | "CFOTech" blanco 13px bold / "IT Tools" `#4FD1B2` 11px bold |
| Nav pills | h-32px, r-20px — inactiva: `rgba(255,255,255,.07)` — activa: `#1B3F8A` |
| Botón Salir | pill r-20px, border `rgba(255,255,255,.22)` |

---

## Convenciones de código

- **TypeScript estricto**: `strict: true`. No usar `any`.
- **Componentes funcionales** con tipado explícito de props.
- **CSS plano**: clases del DS, no inline styles salvo valores dinámicos.
- **Imports**: paths relativos (no aliases `@/`).
- **Naming**: PascalCase para componentes, camelCase para utils/hooks.
- **No hardcodear URLs**: siempre desde `app.url`, `import.meta.env` o config.
- **`??` vs `||`**: Usar siempre `||` para env vars que pueden ser string vacío (`VITE_API_URL=`).
- **Tests**: agregar invariante en `registry.test.ts` por cada app nueva.

---

## Cómo extender

### Agregar una nueva app al portal

1. `src/registry/apps.ts` → agregar objeto en `APP_REGISTRY` (URL gateway: `'/apps/{id}/'`)
2. `portal_server.py` → agregar entrada en `APPS` dict
3. `src/App.tsx` → agregar `` `http://${_H}:PUERTO` `` en `ALLOWED_APP_ORIGINS`
4. `src/__tests__/registry.test.ts` → agregar invariante de la nueva app
5. En la app: implementar `IN_PORTAL` + postMessage + `vite.config.ts` con `base: '/apps/{id}/'`
6. Backend: configurar CORS para `PORTAL_ORIGIN`

### Checklist de integración

- [ ] Backend expone `GET /api/health`
- [ ] Frontend detecta `IN_PORTAL = window.self !== window.top`
- [ ] Header propio oculto cuando `IN_PORTAL === true`
- [ ] Botón Salir usa postMessage a `VITE_PORTAL_URL`
- [ ] `frontend/.env.example` con `VITE_PORTAL_URL=http://localhost:5174`
- [ ] `vite.config.ts` con `base: '/apps/{id}/'` (sin `vite.config.js` que lo override)
- [ ] CORS configurable vía env var
- [ ] Entrada en `APPS` dict en `portal_server.py`
- [ ] Origen en `ALLOWED_APP_ORIGINS` del portal `App.tsx`
- [ ] Invariante en `registry.test.ts`
- [ ] `.gitignore` con `node_modules/`, `dist/`, `.env`

---

## Historial de versiones

| Fecha | Cambio |
|-------|--------|
| 2026-06-10 | v0.1: Proyecto iniciado. CLAUDE.md + DESIGN_SYSTEM.md. Estructura base. |
| 2026-06-10 | v0.2: Portal shell construido. Nav pills, AppFrame, Dashboard, 4 apps en registry. |
| 2026-06-11 | **FASE 0:** Portal Launcher (`portal-launcher/launcher.py`) — Flask :4999, `APP_CONFIGS`, launch/status/stop, `_kill_port()`, `.env` con `ALLOWED_ORIGINS`. |
| 2026-06-11 | **FASE 1:** Integración Bandas Salariales + Reporte DevOps + Job Matcher en iframe. `IN_PORTAL` + postMessage en las 3 apps. CORS configurado. |
| 2026-06-11 | **FASE 2:** React 19.2.7 + Vite 8.0.16 + @vitejs/plugin-react 6.0.2. Vitest 4.1.8 (fix ESM). **82/82 tests**. |
| 2026-06-12 | **FASE 3:** Job Matcher migrado de vanilla a React 19 + Vite :5003. Backend API pura. |
| 2026-06-12 | **FASE 4:** Bandas Salariales — MUI eliminado completamente. Migrado a CSS plano DS. |
| 2026-06-12 | **FASE 5:** Vitest 4.x en 3 apps. RDO 43 · JM 57 · BS 96. **Total: 196 tests**. |
| 2026-06-12 | **FASE 6:** Survey Analytics. ASP.NET Core :5055 + React :5176. SurveyMonkey API v3. Recharts. **315 tests**. |
| 2026-06-12 | **FASE 7:** Hosted deployment. `VITE_HOST` reemplaza `localhost` hardcodeado. `VITE_PORTAL_URL` en cada frontend. Launcher en `0.0.0.0`. **111/111 tests**. |
| 2026-06-12 | **RDO orgs dinámicas + Consultar:** `/api/organizaciones` en tiempo real. Botón [Consultar] en dropdown Proyectos. **42/42 tests**. |
| 2026-06-12 | **RDO sprint cards:** `GET /api/sprints/<org>/<proyecto>` → `SprintsResult`. Componente `SprintCard`. **343 tests total**. |
| 2026-06-16 | **Gateway + fix iframe:** `portal_server.py` punto de entrada unificado :5174. Fix `vite.config.js` legacy (sin `base`) → assets roto en Bandas. `AppFrame`: `isGatewayUrl`. `launcher_ui.py` reescrito para arrancar gateway directo. **377/377 tests**. |
| 2026-06-19 | **Audio a Texto integrado:** Backend FastAPI inline en gateway. Frontend React :5009. Fix `??` → `\|\|` en client.ts. **11 tests**. |
| 2026-06-19 | **Fix bugs (6):** Survey Brotli, JM compression, Bandas `BrowserRouter basename`, DPI 4K. **426/426 tests**. |
| 2026-06-19 | **UX: cards + Salir:** Cards no abren al click (solo botón Abrir →). Salir: `stop-all` + overlay React. **433/433 tests**. |
| 2026-06-19 | **Cache HTTP + startup:** `index.html` no-cache, assets immutable. `launcher_ui.py` limpia `__pycache__` y `.vite/`. **427 total (433 portal)**. |
| 2026-06-19 | **Fix bugs (4):** JM timeout 300s, Survey tsconfig ES2022, WS_A_TEXTO primer build, Salir overlay. **433/433 tests**. |
| 2026-06-25 | **Rename Sound Catch → WS_A_TEXTO:** Carpeta + rutas + registry + sys.path. **129/129 tests**. |
| 2026-06-25 | **WA a Texto header fix:** `Header.tsx` con `if (IN_PORTAL) return null`. `category: ''` → test `present`. **129/129 tests**. |
| 2026-06-25 | **Audio a Texto (rename final):** `'WA a Texto'` → `'Audio a Texto'`. Logo `🎙`. **129/129 tests**. |
| 2026-06-25 | **Job Matcher fix tarjetas:** CSS `text-overflow: ellipsis` en `.uz-file`. `title={filename}`. **84/84 tests JM**. |
| 2026-06-26 | **Proyectos Activos — Fases 1-3 completas:** Fase 1: DB schema PostgreSQL + ETL CLI (`ingest.py`). Fase 2: Frontend React 19 completo — `SemaforoGeneral` (semáforo por proyecto + métricas DC + toggle ACUMULADO/MENSUAL) + `EjercicioEconomico` (drill-down por proyecto + Recharts LineChart historial). Fase 3: Integración portal — `apps.ts` `status: 'active'`, `portal_server.py` `APPS` dict :5010/:5011, `App.tsx` `ALLOWED_APP_ORIGINS` :5011, `registry.test.ts` invariant. ETL via API: `POST /api/ingest` (multipart `.xlsx` → `ingest_from_file()` → `IngestResult`) + botón **📤 Subir Excel** en frontend (spinner + banner verde/rojo + recarga automática de períodos). Vitest 31/31 (`client.test.ts`): TDD RED→GREEN reveló que `VITE_API_URL=/api/proyectos-activos` se carga en tests → URLs reales son `/api/proyectos-activos/api/*`. `ARQUITECTURA.md` creado — extrae ecosistema, gateway, postMessage, decisiones técnicas. **Portal: 141/141 · Proyectos Activos: 31/31**. |
