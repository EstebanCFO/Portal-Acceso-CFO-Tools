# ARQUITECTURA.md — Portal de Acceso CFOTech

Referencia técnica de arquitectura. Complementa `CLAUDE.md` (contexto operativo diario).

---

## Ecosistema de apps

```
C:\Esteban CFOTech\Portal de Acceso\          ← repo git principal
├── portal_server.py         ← ★ Gateway FastAPI :5174 — punto de entrada único
├── REPORTE_DEV_OPS\         ← Flask :5000 + React/Vite :5001  → /apps/reporte-devops/
├── BANDAS_SALARIALES\       ← ASP.NET Core :5050 + React/Vite :5173 → /apps/bandas-salariales/
├── JOB_MATCHER\             ← Node.js/Express :5002 + React/Vite :5003 → /apps/job-matcher/
├── SURVEY\                  ← ASP.NET Core :5055 + React/Vite :5176 → /apps/survey/
├── WS_A_TEXTO\              ← FastAPI inline + React/Vite :5009 → /apps/sound-catch/
├── PROYECTOS_ACTIVOS\       ← FastAPI :5010 + React/Vite :5011 → /apps/proyectos-activos/
├── portal-launcher\         ← Flask :4999 (launcher legacy) + launcher_ui.py (tkinter)
└── src\                     ← Portal shell React 19 + Vite 8 (build → dist/)
```

| Componente | Puerto(s) | Stack | URL en gateway |
|------------|-----------|-------|----------------|
| **Gateway** | `:5174` | FastAPI + uvicorn | `http://localhost:5174` |
| Portal shell | `dist/` | React 19 + Vite 8 | `http://localhost:5174/` |
| Reporte DevOps | `:5001` / `:5000` | React 19 + Vite / Flask | `/apps/reporte-devops/` |
| Bandas Salariales | `:5173` / `:5050` | React 19 + Vite + CSS DS / ASP.NET Core | `/apps/bandas-salariales/` |
| Job Matcher | `:5003` / `:5002` | React 19 + Vite / Node.js + Express | `/apps/job-matcher/` |
| Survey Analytics | `:5176` / `:5055` | React 19 + Vite / ASP.NET Core 8 | `/apps/survey/` |
| Audio a Texto | `:5009` / inline | React 19 + Vite / FastAPI inline | `/apps/sound-catch/` |
| **Proyectos Activos** | `:5011` / `:5010` | React 19 + Vite + Recharts / FastAPI + SQLAlchemy + PostgreSQL | `/apps/proyectos-activos/` |
| Portal Launcher | `:4999` | Flask | legacy — `launcher_ui.py` ya no lo usa |

---

## APPS dict — `portal_server.py`

Config completa de todos los procesos que gestiona el gateway:

```python
APPS: dict[str, dict] = {
  'sound-catch': {
    'backend_inline':  True,           # router FastAPI montado inline en el gateway
    'frontend_cmd':    'npm run dev',
    'frontend_dir':    BASE_DIR / 'WS_A_TEXTO' / 'web' / 'frontend',
    'frontend_port':   5009,
    'frontend_dist':   BASE_DIR / 'WS_A_TEXTO' / 'web' / 'frontend' / 'dist',
  },
  'reporte-devops': {
    'backend_cmd':         '"python" app.py',
    'backend_dir':         BASE_DIR / 'REPORTE_DEV_OPS' / 'backend',
    'backend_port':        5000,
    'backend_health':      'http://localhost:5000/api/health',
    'frontend_cmd':        'npm run dev',
    'frontend_dir':        BASE_DIR / 'REPORTE_DEV_OPS' / 'frontend',
    'frontend_port':       5001,
    'frontend_dist':       BASE_DIR / 'REPORTE_DEV_OPS' / 'frontend' / 'dist',
  },
  'job-matcher': {
    'backend_cmd':         'node server.js',
    'backend_dir':         BASE_DIR / 'JOB_MATCHER' / 'backend',
    'backend_port':        5002,
    'backend_health':      'http://localhost:5002/api/health',
    'backend_path_prefix': '',         # rutas mixtas: /upload, /analyze, /ask-question…
    'frontend_cmd':        'npm run dev',
    'frontend_dir':        BASE_DIR / 'JOB_MATCHER' / 'frontend',
    'frontend_port':       5003,
    'frontend_dist':       BASE_DIR / 'JOB_MATCHER' / 'frontend' / 'dist',
  },
  'bandas-salariales': {
    'backend_cmd':         'dotnet run',
    'backend_dir':         BASE_DIR / 'BANDAS_SALARIALES' / 'BandasSalariales.Web',
    'backend_port':        5050,
    'backend_health':      'http://localhost:5050/api/health',
    'frontend_cmd':        'npm run dev',
    'frontend_dir':        BASE_DIR / 'BANDAS_SALARIALES' / 'bandas-frontend',
    'frontend_port':       5173,
    'frontend_dist':       BASE_DIR / 'BANDAS_SALARIALES' / 'bandas-frontend' / 'dist',
  },
  'survey': {
    'backend_cmd':         'dotnet run',
    'backend_dir':         BASE_DIR / 'SURVEY' / 'SurveyApp.Web',
    'backend_port':        5055,
    'backend_health':      'http://localhost:5055/api/health',
    'frontend_cmd':        'npm run dev',
    'frontend_dir':        BASE_DIR / 'SURVEY' / 'survey-frontend',
    'frontend_port':       5176,
    'frontend_dist':       BASE_DIR / 'SURVEY' / 'survey-frontend' / 'dist',
  },
  'proyectos-activos': {
    'backend_cmd':         f'"{_PY}" app.py',
    'backend_dir':         BASE_DIR / 'PROYECTOS_ACTIVOS' / 'backend',
    'backend_port':        5010,
    'backend_health':      'http://localhost:5010/api/health',
    'backend_timeout':     20,
    'backend_path_prefix': '',         # frontend llama /api/proyectos-activos/api/*
    'frontend_cmd':        'npm run dev',
    'frontend_dir':        BASE_DIR / 'PROYECTOS_ACTIVOS' / 'frontend',
    'frontend_port':       5011,
    'frontend_dist':       BASE_DIR / 'PROYECTOS_ACTIVOS' / 'frontend' / 'dist',
  },
}
```

### Agregar una app nueva al gateway

1. Agregar entrada en `APPS` en `portal_server.py`
2. Si el backend es FastAPI: `backend_inline: True` + `app.include_router(…, prefix='/api/{id}/api')`
3. Si el backend es subprocess: especificar `backend_cmd`, `backend_health`, `backend_port`, `backend_timeout`
4. Especificar `frontend_cmd`, `frontend_dir`, `frontend_port`, `frontend_dist`

---

## Gateway routes (`portal_server.py`)

| Ruta | Comportamiento |
|------|---------------|
| `/apps/{app_id}/{path}` | Dev: proxy al Vite dev server de la app. Prod: sirve `{APP_DIR}/dist/` |
| `/api/sound-catch/api/{path}` | Router FastAPI de WS_A_TEXTO montado inline — sin subprocess |
| `/api/{app_id}/{path}` | Proxy al backend de la app (Flask/dotnet/Node/FastAPI) |
| `/api/health` | Health check del gateway |
| `/api/shutdown-portal` | Para subprocesos + `os._exit(0)` tras 600ms |
| `/{path}` (catch-all) | Dev: proxy al portal Vite `:5175`. Prod: sirve `dist/index.html` |

**Headers de caché:**
- `index.html` (portal y apps): `Cache-Control: no-cache, no-store, must-revalidate`
- `assets/*.js`, `assets/*.css`: `Cache-Control: public, max-age=31536000, immutable`

**Crítico:** Cada app debe tener `base: '/apps/{id}/'` en `vite.config.ts`. Si existe `vite.config.js` en el mismo directorio, Vite lo prioriza — **borrar cualquier `.js` legacy sin `base` configurado**.

---

## Layout y alturas (crítico para el iframe)

```
#root → .portal-root (100vh, flex-col)
├── .portal-header (48px, flex-shrink: 0)
└── .portal-body (flex: 1, overflow: hidden, position: relative)
    ├── activeApp === null → <Dashboard> (height:100%, overflow-y:auto)
    └── activeApp !== null → <AppFrame> (position:absolute, inset:0)
            ├── spinner (mientras carga)
            └── <iframe> (flex:1, 100% height)
```

**Regla:** `.portal-body` tiene `position: relative` + `overflow: hidden`.
`AppFrame` usa `position: absolute; inset: 0`.

### AppFrame — Gateway mode vs. direct URL

```typescript
const isGatewayUrl = app.url.startsWith('/apps/')
```

- **Gateway URL** (`/apps/...`): preflight sin `no-cors` (same-origin), detecta 503 via `response.ok`.
- **URL directa** (`http://localhost:XXXX`): preflight con `mode: 'no-cors'` (cross-origin), ignora status code.

---

## Protocolo postMessage — apps ↔ portal

### El problema
Las apps corren en iframes cross-origin. `window.confirm()`, `window.close()` y `window.location` quedan bloqueados o silenciados.

### La solución

**Desde la app embebida:**
```typescript
const portalUrl = import.meta.env.VITE_PORTAL_URL || 'http://localhost:5174'
window.parent.postMessage(
  { type: 'portal:goHome', appId: 'proyectos-activos' },
  portalUrl,
)
```

**El portal escucha en `App.tsx`:**
```typescript
const _H = import.meta.env.VITE_HOST ?? 'localhost'

const ALLOWED_APP_ORIGINS = [
  `http://${_H}:5001`,   // Reporte DevOps
  `http://${_H}:5173`,   // Bandas Salariales
  `http://${_H}:5003`,   // Job Matcher
  `http://${_H}:5176`,   // Survey Analytics
  `http://${_H}:5009`,   // Audio a Texto
  `http://${_H}:5011`,   // Proyectos Activos
]
```

### Detección de modo iframe (todas las apps)

```typescript
const IN_PORTAL = window.self !== window.top  // evaluación estática, módulo-level
```

- `IN_PORTAL = true` → ocultar header propio, usar postMessage para salir
- `IN_PORTAL = false` → modo standalone, usar `window.close()`

---

## App Proyectos Activos — Arquitectura específica

### Stack

| Capa | Tecnología | Puerto |
|------|-----------|--------|
| Base de datos | PostgreSQL 16 | `:5432` |
| Backend API | FastAPI + SQLAlchemy 2.x + psycopg2 | `:5010` |
| ETL / Ingesta | Python + pandas + openpyxl | CLI + `POST /api/ingest` |
| Frontend | React 19 + Vite 8 + TypeScript + Recharts | `:5011` |

### Flujo de navegación

```
App "Proyectos Activos"
  ├── SemaforoGeneral (default)
  │     ├── Filterbar: selector período + toggle ACUMULADO/MENSUAL + [📤 Subir Excel]
  │     ├── Tabla proyectos (clickable → drill-down)
  │     └── Métricas DC (bench, recursos, resultado comercial)
  └── EjercicioEconomico (click en fila)
        ├── Back bar (← Semáforo General)
        ├── Resumen Financiero (badge resultado + grid)
        ├── Tabla Recursos (costos mensuales)
        └── Historial (LineChart Recharts + tabla)
```

### ETL via API — `POST /api/ingest`

```
Frontend: botón [📤 Subir Excel]
  → file picker (.xlsx)
  → FormData { file }
  → POST /api/proyectos-activos/api/ingest
  → gateway proxy → backend :5010/api/ingest
  → tempfile → ingest_from_file(path)
  → IngestResult { period, solapas_real, recursos_total, semaforo_matched, ... }
  → banner verde/rojo + recarga automática de períodos
```

### Prefijo de API en tests

Vitest carga `.env` → `VITE_API_URL=/api/proyectos-activos` → `API_BASE=/api/proyectos-activos/api`.
Los tests verifican URLs completas con el prefijo del gateway (no `/api/...` directo).

### Setup inicial PostgreSQL

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso\PROYECTOS_ACTIVOS"
python setup_db.py --password MiPassword123
# Crea DB, aplica schema.sql, escribe backend/.env

cd etl
python ingest.py --file "..\Proyectos Activos 2026.xlsx"
# Carga datos en PostgreSQL
```

---

## Decisiones técnicas

| Decisión | Razón |
|----------|-------|
| Sin React Router | Un `useState` es suficiente con una sola "ruta activa". Se agrega Router cuando haya rutas anidadas reales. |
| Nav pills en header (no sidebar) | UX compacta — no consume espacio horizontal. |
| CSS plano (sin Tailwind/MUI) | DS propio ya define clases. MUI solo en apps que lo heredan. |
| Sin backend en el portal shell | El portal es puro shell estático. |
| postMessage (no shared state) | Único canal cross-origin disponible para iframes. |
| `position: absolute; inset: 0` en AppFrame | Más robusto que flex encadenado sin sidebar. |
| Vitest 4.x (no 2.x) | @vitejs/plugin-react v6 es ESM-only; Vitest 2.x lo carga con `require()` y falla. |
| `VITE_HOST` en lugar de `VITE_*_URL` por app | Una variable controla todos los puertos. |
| Launcher en `0.0.0.0` | Acceso desde red sin cambiar código — solo `.env`. |
| Backend inline (WS_A_TEXTO) | Router FastAPI montado en el gateway, elimina un subprocess y un puerto. |
| `??` vs `\|\|` en env vars de cliente | `"" ?? fallback` = `""` (bug). `"" \|\| fallback` = fallback (fix). Usar siempre `\|\|`. |
| `Cache-Control: no-cache` en `index.html` | Evita browser caché obsoleto tras rebuild. Assets con hash: `max-age=31536000, immutable`. |
| `/api/shutdown-portal` en gateway | Único endpoint que para subprocesos Y apaga uvicorn con `os._exit()`. |
| PostgreSQL (no SQLite) para Proyectos Activos | `NUMERIC(15,2)` con precisión garantizada. Compatibilidad futura con servidor compartido. |
| ETL via `POST /api/ingest` | El usuario sube el Excel desde la app, sin CLI. Stats de ingesta visibles en el frontend. |
