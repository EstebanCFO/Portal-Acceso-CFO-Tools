# CLAUDE.md — Portal de Acceso CFOTech

Guía de contexto para futuras sesiones de Claude Code en este proyecto.

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
├── CLAUDE.md                      ← este archivo
├── DESIGN_SYSTEM.md               ← DS del portal
├── package.json                   ← react ^19.2.7, vite ^8.0.16, vitest ^4.1.8
├── vite.config.ts                 ← port 5174
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── index.html
├── .env                           ← VITE_HOST, VITE_PORTAL_PORT, VITE_LAUNCHER_PORT (gitignore)
├── .env.example                   ← plantilla pública del .env raíz
├── START.bat                      ← abre la UI flotante del launcher (pythonw)
├── STOP.bat                       ← mata :5174
│
├── portal_server.py               ← ★ Gateway FastAPI/uvicorn :5174 — sirve portal + apps
│
├── portal-launcher\               ← Servicio local de lanzamiento
│   ├── launcher.py                ← Flask :4999 — POST /api/launch, GET /api/status, POST /api/stop
│   ├── launcher_ui.py             ← UI flotante tkinter — arranca portal_server.py, muestra estado
│   ├── run_ui.vbs                 ← lanza launcher_ui.py sin ventana DOS (llamado por START.bat)
│   ├── requirements.txt
│   └── .env                       ← PORT, APP_HOST, PORTAL_PORT, ALLOWED_ORIGINS, AUTOSTART_APPS
│
├── REPORTE_DEV_OPS\               ← App Reporte DevOps (Flask :5000 + React :5001)
├── BANDAS_SALARIALES\             ← App Bandas Salariales (ASP.NET :5050 + React :5173)
├── JOB_MATCHER\                   ← App Job Matcher (Node.js :5002 + React Vite :5003)
│   ├── backend\                   ← API Node.js/Express :5002
│   ├── frontend\                  ← React 19 + Vite :5003 (FASE 3)
│   ├── start.bat / stop.bat
│   └── CLAUDE.md
│
└── src\
    ├── main.tsx
    ├── index.css                  ← variables DS + todas las clases del portal
    ├── vite-env.d.ts              ← tipos Vite (VITE_HOST, VITE_PORTAL_PORT, VITE_LAUNCHER_PORT)
    ├── App.tsx                    ← activeApp state + postMessage handler + ALLOWED_APP_ORIGINS
    ├── registry\
    │   └── apps.ts                ← ★ REGISTRO CENTRAL — editar aquí para agregar apps
    ├── components\
    │   ├── Header.tsx             ← logo + nav pills + category label + btn Salir
    │   └── AppFrame.tsx           ← <iframe> con loading / error / coming-soon / link
    ├── api\
    │   └── launcher.ts            ← cliente HTTP del Portal Launcher
    ├── pages\
    │   └── Dashboard.tsx          ← banner + grilla de AppCards
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
| Git | cualquiera | `git --version` |

> Python debe estar en PATH. Si se instaló desde Microsoft Store puede no estarlo.

---

### 1 — Clonar el repositorio

```powershell
git clone https://github.com/EstebanCFO/Portal-Acceso-CFO-Tools.git "C:\Esteban CFOTech\Portal de Acceso"
cd "C:\Esteban CFOTech\Portal de Acceso"
```

---

### 2 — Dependencias del portal shell

```powershell
npm install
```

---

### 3 — Dependencias del launcher Python

```powershell
cd portal-launcher
pip install -r requirements.txt
cd ..
```

Paquetes instalados: `flask`, `flask-cors`, `requests`.

---

### 4 — Variables de entorno del portal

Copiar la plantilla y ajustar si se necesita (en local no es necesario cambiar nada):

```powershell
copy .env.example .env
```

Contenido por defecto (funciona en local sin cambios):

```
VITE_HOST=localhost
VITE_PORTAL_PORT=5174
VITE_LAUNCHER_PORT=4999
```

---

### 5 — Variables de entorno del launcher

Copiar la plantilla:

```powershell
copy portal-launcher\.env.example portal-launcher\.env
```

> `portal-launcher\.env` ya existe con valores correctos para local si se clonó el repo.

---

### 6 — Variables de entorno de cada app

Cada app tiene su propio `.env` con secretos (API keys, PATs, tokens). Estos **no se guardan en git**. El equipo los comparte por canal seguro (LastPass, Vault, etc.).

| App | Archivo | Variables clave |
|-----|---------|-----------------|
| Reporte DevOps | `REPORTE_DEV_OPS/backend/.env` | `AZURE_DEVOPS_PAT`, `AZURE_DEVOPS_ORGS`, `FRONTEND_URL`, `PORTAL_ORIGIN` |
| Job Matcher | `JOB_MATCHER/backend/.env` | `ANTHROPIC_API_KEY`, `PORT=5002`, `CORS_ORIGINS` |
| Survey | `SURVEY/SurveyApp.Web/appsettings.Development.json` | `SurveyMonkey:AccessToken` |
| Bandas | sin secretos | CORS se configura en `appsettings.json` |

Cada frontend tiene `.env.example` como referencia:

```powershell
# Ejemplo para Reporte DevOps frontend
copy REPORTE_DEV_OPS\frontend\.env.example REPORTE_DEV_OPS\frontend\.env
# Editar VITE_PORTAL_URL si el portal no corre en localhost:5174
```

---

### 7 — Dependencias npm de cada app frontend

El launcher instala dependencias automáticamente si detecta que falta `node_modules`. Para instalar manualmente:

```powershell
cd REPORTE_DEV_OPS\frontend  ; npm install ; cd ..\..
cd JOB_MATCHER\frontend      ; npm install ; cd ..\..
cd BANDAS_SALARIALES\bandas-frontend ; npm install ; cd ..\..
cd SURVEY\survey-frontend    ; npm install ; cd ..\..
```

---

### 8 — Verificar que todo funciona

```powershell
# Tests del portal shell (deben pasar 127/127)
npm run test

# Levantar el portal completo (doble clic o PowerShell)
.\START.bat
```

El `START.bat` abre la **UI flotante del launcher** (ventana verde CFOTech) que:
1. Libera el puerto `:5174`
2. Instala dependencias Python si faltan (`uvicorn`, `fastapi`, `httpx`, `python-dotenv`)
3. Arranca `portal_server.py` (gateway FastAPI en `:5174`)
4. Abre el browser automáticamente cuando `/api/health` responde

---

## Cómo levantar el portal

### Opción A — Doble clic (recomendada)

`START.bat` → abre UI flotante → arranca `portal_server.py` → abre browser en `:5174`

La UI flotante muestra spinner mientras espera que el gateway responda en `/api/health`.
- **×** — cierra la ventana sin bajar los servicios (siguen corriendo en background)

### Opción B — Terminal (gateway)

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso"
python portal_server.py   # gateway en http://localhost:5174
```

El gateway arranca todos los backends y frontends automáticamente.

### Opción C — Dev mode (portal shell solo)

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso"
npm install       # solo la primera vez
npm run dev       # → portal Vite en http://localhost:5175 (dev)
npm run build     # build de producción en dist/
npm run test      # suite Vitest (127 tests)
```

> En dev, el gateway (`portal_server.py`) sigue siendo necesario en `:5174` para servir las apps. El portal Vite corre en `:5175`.

---

## Variables de entorno y configuración de entorno

### Portal shell (`.env` raíz)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `VITE_HOST` | Host donde corren el portal y las apps (sin protocolo ni puerto) | `localhost` |
| `VITE_PORTAL_PORT` | Puerto del portal Vite | `5174` |
| `VITE_LAUNCHER_PORT` | Puerto del launcher Flask | `4999` |

Estas variables se inyectan en el bundle por Vite. En el código TypeScript se leen como `import.meta.env.VITE_*`.

### Portal Launcher (`portal-launcher/.env`)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del launcher Flask | `4999` |
| `APP_HOST` | Host del servidor (para abrir el browser) | `localhost` |
| `PORTAL_PORT` | Puerto del portal (para abrir el browser) | `5174` |
| `ALLOWED_ORIGINS` | Orígenes CORS permitidos (CSV, sin espacios) | `http://localhost:5174` |
| `AUTOSTART_APPS` | Si `true`, lanza todas las apps al iniciar | `false` |

### Frontends de apps (`<app>/frontend/.env`)

| Variable | Descripción | Default en código |
|----------|-------------|-------------------|
| `VITE_PORTAL_URL` | URL completa del portal — destino del postMessage al salir | `http://localhost:5174` |

Referencia: cada frontend tiene `.env.example` con la plantilla lista para copiar.

### Backends de apps

| App | Variable | Propósito |
|-----|----------|-----------|
| Reporte DevOps | `PORTAL_ORIGIN` | Origen CORS del portal (`http://localhost:5174`) |
| Job Matcher | `CORS_ORIGINS` | CSV de orígenes permitidos (frontend + portal) |
| Bandas | `AllowedOrigins` en `appsettings.json` | CSV de orígenes CORS |
| Survey | `AllowedOrigins` en `appsettings.json` | CSV de orígenes CORS |

---

## Despliegue en red interna o servidor

Para que el portal sea accesible desde otras máquinas (no solo `localhost`):

### Paso 1 — Portal shell

Editar `.env` en la raíz del portal:

```
VITE_HOST=192.168.1.100        # IP o hostname del servidor
VITE_PORTAL_PORT=5174
VITE_LAUNCHER_PORT=4999
```

Luego rebuildar:
```powershell
npm run build      # genera dist/
npm run preview    # sirve dist/ en http://0.0.0.0:5174
```

### Paso 2 — Launcher

Editar `portal-launcher/.env`:

```
APP_HOST=192.168.1.100
PORTAL_PORT=5174
ALLOWED_ORIGINS=http://192.168.1.100:5174
AUTOSTART_APPS=true            # recomendado en servidor: arranca todo al iniciar
```

El launcher escucha en `0.0.0.0` — ya acepta conexiones desde la red.

### Paso 3 — Backends (CORS)

**Reporte DevOps** (`REPORTE_DEV_OPS/backend/.env`):
```
FRONTEND_URL=http://192.168.1.100:5001
PORTAL_ORIGIN=http://192.168.1.100:5174
```

**Job Matcher** (`JOB_MATCHER/backend/.env`):
```
CORS_ORIGINS=http://192.168.1.100:5003,http://192.168.1.100:5174
```

**Bandas Salariales** (`BANDAS_SALARIALES/BandasSalariales.Web/appsettings.json`):
```json
"AllowedOrigins": "http://192.168.1.100:5173,http://192.168.1.100:5174"
```

**Survey Analytics** (`SURVEY/SurveyApp.Web/appsettings.json`):
```json
"AllowedOrigins": "http://192.168.1.100:5176,http://192.168.1.100:5174"
```

### Paso 4 — Frontends de apps (postMessage)

Crear `.env` en cada frontend copiando su `.env.example`:

```
VITE_PORTAL_URL=http://192.168.1.100:5174
```

> **Nota sobre Vite en red:** Por defecto Vite escucha solo en `localhost`. Para hacerlo accesible desde la red, agregar `--host` al script en `package.json`:
> ```json
> "dev": "vite --host 0.0.0.0"
> ```
> O configurar `server.host: true` en `vite.config.ts` de cada frontend.

### Tabla resumen — cambios por entorno

| Archivo | Localhost | Red interna |
|---------|-----------|-------------|
| `.env` (raíz) | `VITE_HOST=localhost` | `VITE_HOST=192.168.1.100` |
| `portal-launcher/.env` | `APP_HOST=localhost` | `APP_HOST=192.168.1.100` |
| `portal-launcher/.env` | `ALLOWED_ORIGINS=http://localhost:5174` | `ALLOWED_ORIGINS=http://192.168.1.100:5174` |
| `REPORTE_DEV_OPS/backend/.env` | `PORTAL_ORIGIN=http://localhost:5174` | `PORTAL_ORIGIN=http://192.168.1.100:5174` |
| `JOB_MATCHER/backend/.env` | `CORS_ORIGINS=...:5003,...:5174` | `CORS_ORIGINS=...<IP>:5003,...<IP>:5174` |
| `*/appsettings.json` | `"AllowedOrigins": "...:5173,...:5174"` | `"AllowedOrigins": "...<IP>:5173,...<IP>:5174"` |
| Cada `frontend/.env` | `VITE_PORTAL_URL=http://localhost:5174` | `VITE_PORTAL_URL=http://192.168.1.100:5174` |

---

## Registro de apps (`src/registry/apps.ts`)

Archivo central para declarar todas las apps del portal.
**Agregar una app nueva = agregar un objeto al array `APP_REGISTRY`.**

Las URLs se construyen con `_H` (leído de `VITE_HOST` en `.env`):

```typescript
const _H = import.meta.env.VITE_HOST ?? 'localhost'

export const APP_REGISTRY: App[] = [
  {
    id:          'bandas-salariales',
    name:        'Bandas Salariales',
    description: 'Gestión y análisis de bandas salariales por posición y nivel',
    icon:        '📊',
    url:         `http://${_H}:5173`,   // ← sin localhost hardcodeado
    type:        'iframe',
    iconBg:      '#EEF2F8',
    iconColor:   '#0A1F44',
    tags:        ['RRHH', 'Compensaciones'],
    status:      'active',
    category:    'Recursos Humanos',
    startCmd:    'BANDAS_SALARIALES\\START.bat',
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

## Protocolo postMessage — apps ↔ portal

### El problema
Las apps corren en iframes cross-origin. `window.confirm()`, `window.close()` y `window.location` quedan bloqueados o silenciados.

### La solución: postMessage
Cada app envía un mensaje al portal cuando el usuario quiere salir:

```typescript
// Desde la app embebida — VITE_PORTAL_URL viene de frontend/.env
const portalUrl = import.meta.env.VITE_PORTAL_URL ?? 'http://localhost:5174'
window.parent.postMessage(
  { type: 'portal:goHome', appId: 'job-matcher' },
  portalUrl,
)
```

El portal escucha en `App.tsx`. Los orígenes se construyen con `VITE_HOST`:
```typescript
const _H = import.meta.env.VITE_HOST ?? 'localhost'

const ALLOWED_APP_ORIGINS = [
  `http://${_H}:5001`,   // Reporte DevOps
  `http://${_H}:5173`,   // Bandas Salariales
  `http://${_H}:5003`,   // Job Matcher (React frontend)
  `http://${_H}:5176`,   // Survey Analytics
]
```

**Al agregar una nueva app** que usa postMessage: añadir su origen a `ALLOWED_APP_ORIGINS`.

### Detección de modo iframe en cada app

Todas las apps propias detectan si corren dentro del portal:
```typescript
const IN_PORTAL = window.self !== window.top  // evaluación estática, módulo-level
```

- `IN_PORTAL = true` → ocultar header propio, usar postMessage para salir
- `IN_PORTAL = false` → modo standalone, usar `window.close()` para salir

---

## Portal Launcher (`portal-launcher/launcher.py`)

Servicio Flask en `:4999` que levanta backend + frontend de cada app.
Escucha en `0.0.0.0` — accesible desde la red.

### Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/launch/<app_id>` | Lanza backend + frontend en hilos. Idempotente si ya está corriendo. |
| GET  | `/api/status/<app_id>` | Estado actual: `pending / launching / ready / error` por componente |
| POST | `/api/stop/<app_id>`   | Termina procesos, mata puertos por número, limpia estado |
| POST | `/api/stop-all`        | Detiene todos los procesos corrientes |
| GET  | `/api/health`          | Health check del launcher |

### Auto-start (`AUTOSTART_APPS=true`)

Cuando el launcher arranca, lanza en background todas las apps de `APP_CONFIGS` sin esperar al usuario. Ideal para servidores donde se quiere que todo esté listo al llegar al portal.

### Configuración `APPS` en `portal_server.py` (config actual — reemplaza `launcher.py`)

```python
APPS: dict[str, dict] = {
  'sound-catch': {
    # Backend: router FastAPI montado inline (sin subprocess ni puerto extra)
    'backend_inline':  True,
    'frontend_cmd':    'npm run dev',
    'frontend_dir':    APPS_ROOT / 'Sound Catch' / 'web' / 'frontend',
    'frontend_port':   5009,
    'frontend_dist':   APPS_ROOT / 'Sound Catch' / 'web' / 'frontend' / 'dist',
  },
  'reporte-devops': {
    'backend_cmd':     '"python" app.py',      'backend_dir':     BASE_DIR / 'REPORTE_DEV_OPS' / 'backend',
    'backend_port':    5000,                   'backend_health':  'http://localhost:5000/api/health',
    'frontend_cmd':    'npm run dev',          'frontend_dir':    BASE_DIR / 'REPORTE_DEV_OPS' / 'frontend',
    'frontend_port':   5001,                   'frontend_dist':   BASE_DIR / 'REPORTE_DEV_OPS' / 'frontend' / 'dist',
  },
  'job-matcher': {
    'backend_cmd':     'node server.js',       'backend_dir':     BASE_DIR / 'JOB_MATCHER' / 'backend',
    'backend_port':    5002,                   'backend_health':  'http://localhost:5002/api/health',
    'backend_path_prefix': '',                 # rutas mixtas: /upload, /analyze, /ask-question…
    'frontend_cmd':    'npm run dev',          'frontend_dir':    BASE_DIR / 'JOB_MATCHER' / 'frontend',
    'frontend_port':   5003,                   'frontend_dist':   BASE_DIR / 'JOB_MATCHER' / 'frontend' / 'dist',
  },
  'bandas-salariales': {
    'backend_cmd':     'dotnet run',           'backend_dir':     BASE_DIR / 'BANDAS_SALARIALES' / 'BandasSalariales.Web',
    'backend_port':    5050,                   'backend_health':  'http://localhost:5050/api/health',
    'frontend_cmd':    'npm run dev',          'frontend_dir':    BASE_DIR / 'BANDAS_SALARIALES' / 'bandas-frontend',
    'frontend_port':   5173,                   'frontend_dist':   BASE_DIR / 'BANDAS_SALARIALES' / 'bandas-frontend' / 'dist',
  },
  'survey': {
    'backend_cmd':     'dotnet run',           'backend_dir':     BASE_DIR / 'SURVEY' / 'SurveyApp.Web',
    'backend_port':    5055,                   'backend_health':  'http://localhost:5055/api/health',
    'frontend_cmd':    'npm run dev',          'frontend_dir':    BASE_DIR / 'SURVEY' / 'survey-frontend',
    'frontend_port':   5176,                   'frontend_dist':   BASE_DIR / 'SURVEY' / 'survey-frontend' / 'dist',
  },
}
```

> `portal_server.py` reemplaza `launcher.py` como gestor de procesos. El launcher Flask legacy (:4999) queda como fallback (raramente usado).

### Agregar una app nueva al gateway

1. Agregar entrada en `APPS` en `portal_server.py`
2. Si el backend es FastAPI: usar `backend_inline: True` + `app.include_router(…, prefix='/api/{id}/api')`
3. Si el backend es subprocess: especificar `backend_cmd`, `backend_health`, `backend_port`, `backend_timeout`
4. Especificar `frontend_cmd`, `frontend_dir`, `frontend_port`, `frontend_dist`

---

## Apps del ecosistema CFOTech

```
C:\Esteban CFOTech\Portal de Acceso\          ← repo git principal
├── portal_server.py         ← ★ Gateway FastAPI :5174 — punto de entrada único
├── REPORTE_DEV_OPS\         ← Flask API :5000 + React/Vite :5001 → /apps/reporte-devops/
├── BANDAS_SALARIALES\       ← ASP.NET Core :5050 + React/Vite/CSS-DS :5173 → /apps/bandas-salariales/
├── JOB_MATCHER\             ← Node.js/Express :5002 + React/Vite :5003 → /apps/job-matcher/
│   ├── backend\             ← API pura (FASE 3: express.static removido)
│   └── frontend\            ← React 19 + Vite :5003 (migrado en FASE 3)
├── SURVEY\                  ← ASP.NET Core :5055 + React/Vite :5176 → /apps/survey/
├── portal-launcher\         ← Flask :4999 (launcher legacy) + launcher_ui.py
└── src\                     ← Portal shell React 19 + Vite 8 (build → dist/)

C:\Esteban CFOTech\Sound Catch\               ← repo separado (fuera del portal git)
└── web\
    ├── backend\             ← FastAPI/Whisper — router.py montado INLINE en el gateway
    │                           (sin subprocess, sin puerto extra en prod)
    └── frontend\            ← React 19 + Vite :5009 → /apps/sound-catch/
```

| Componente | Puerto(s) | Stack | URL en gateway |
|------------|-----------|-------|----------------|
| **Gateway** | `:5174` | FastAPI + uvicorn | `http://localhost:5174` |
| Portal shell | `dist/` (build) | React 19 + Vite 8 | `http://localhost:5174/` |
| Reporte DevOps | `:5001` front / `:5000` API | React 19 + Vite 8 / Flask | `/apps/reporte-devops/` |
| Bandas Salariales | `:5173` front / `:5050` API | React 19 + Vite 8 + CSS DS / ASP.NET Core | `/apps/bandas-salariales/` |
| Job Matcher + JD Generator | `:5003` front / `:5002` API | React 19 + Vite 8 / Node.js + Express | `/apps/job-matcher/` |
| Survey Analytics | `:5176` front / `:5055` API | React 19 + Vite 8 / ASP.NET Core 8 | `/apps/survey/` |
| **Sound Catch** | `:5009` front / inline API | React 19 + Vite 8 / FastAPI inline en gateway | `/apps/sound-catch/` |
| Portal Launcher | `:4999` | Flask | legacy — `launcher_ui.py` ya no lo usa |

### Gateway routes (`portal_server.py`)

| Ruta | Comportamiento |
|------|---------------|
| `/apps/{app_id}/{path}` | Dev: proxy al Vite dev server de la app. Prod: sirve `{APP_DIR}/dist/` con `Cache-Control` apropiado |
| `/api/sound-catch/api/{path}` | Router FastAPI de Sound Catch montado inline (`include_router`) — sin subprocess |
| `/api/{app_id}/{path}` | Proxy al backend de la app (Flask/dotnet/Node) |
| `/api/health` | Health check del gateway |
| `/api/shutdown-portal` | Detiene todos los subprocesos + apaga uvicorn con `os._exit(0)` tras 600ms |
| `/{path}` (catch-all) | Dev: proxy al portal Vite `:5175`. Prod: sirve `dist/index.html` con `Cache-Control: no-cache` |

**Headers de caché:**
- `index.html` (portal y apps): `Cache-Control: no-cache, no-store, must-revalidate` — el browser siempre re-valida antes de usar.
- `assets/*.js`, `assets/*.css`: `Cache-Control: public, max-age=31536000, immutable` — nombre con hash de contenido, válido 1 año.

**Crítico:** Cada app debe tener `base: '/apps/{id}/'` en `vite.config.ts` para que los assets se sirvan correctamente. Si existe `vite.config.js` en el mismo directorio, Vite lo prioriza sobre `vite.config.ts` — **borrar cualquier `.js` legacy que no tenga `base` configurado**.

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

`AppFrame.tsx` detecta si la app se sirve a través del gateway:

```typescript
const isGatewayUrl = app.url.startsWith('/apps/')
```

- **Gateway URL** (`/apps/...`): preflight sin `no-cors` (es same-origin), detecta 503 via `response.ok`.
- **URL directa** (`http://localhost:XXXX`): preflight con `mode: 'no-cors'` (cross-origin), ignora status code.

Las apps registradas con `url: '/apps/{id}/'` en `apps.ts` usan el gateway. Las registradas con `http://` hacen preflight cross-origin clásico.

---

## Design System

**Leer `DESIGN_SYSTEM.md` antes de crear cualquier pantalla o componente.**

Tokens clave:
- Header: 48px, `#0B1526`, `border-bottom: 3px solid #1C2E48`
- Logo: 32×32px, `background: #00A878`, r-8, "CFO" blanco 11px bold
- Fondo: `#F4F6F9` (--gray1)
- Acento: `#4FD1B2` (--green-a)
- Botón principal: `#0A1F44` (--navy)
- Sin gradientes · Sin sombras pesadas

### Spec vigente del Header

| Atributo | Valor |
|----------|-------|
| Altura | 48px |
| Fondo | `#0B1526` (--navy-dark) |
| Border-bottom | `3px solid #1C2E48` |
| Logo (badge) | 32×32px, r-8, `#00A878`, "CFO" 11px bold |
| Marca | "CFOTech" blanco 13px bold / "IT Tools" `#4FD1B2` 11px bold — 2 líneas |
| Divisor | 1px `rgba(255,255,255,.12)`, 22px alto |
| Nav pills | h-32px, r-20px — inactiva: `rgba(255,255,255,.07)` — activa: `#1B3F8A` |
| Category label | 12px, `rgba(255,255,255,.45)` |
| Botón Salir | pill r-20px, border `rgba(255,255,255,.22)` |

---

## Convenciones de código

- **TypeScript estricto**: `strict: true`. No usar `any`.
- **Componentes funcionales** con tipado explícito de props.
- **CSS plano**: clases del DS, no inline styles salvo valores dinámicos.
- **Imports**: paths relativos (no aliases `@/`).
- **Naming**: PascalCase para componentes, camelCase para utils/hooks.
- **No hardcodear URLs**: siempre desde `app.url` del registry, `import.meta.env` o config.
- **Tests**: agregar invariante en `registry.test.ts` por cada app nueva en `APP_REGISTRY`.

---

## Cómo extender

### Agregar una nueva app al portal

1. `src/registry/apps.ts` → agregar objeto al array `APP_REGISTRY` con URL usando `` `http://${_H}:PUERTO` ``
2. `portal-launcher/launcher.py` → agregar entrada en `APP_CONFIGS`
3. `src/App.tsx` → agregar `` `http://${_H}:PUERTO` `` en `ALLOWED_APP_ORIGINS`
4. `src/__tests__/registry.test.ts` → agregar invariante de la nueva app
5. En la app: implementar `IN_PORTAL` detection + postMessage para salir
6. En cada backend nuevo: configurar CORS para aceptar `PORTAL_ORIGIN` / `AllowedOrigins`

**Sin reinicio necesario en desarrollo** — Vite recarga automáticamente.

### Checklist de integración de cada nueva app

- [ ] Backend expone `GET /api/health` y `POST /api/shutdown` (o `/api/salir`)
- [ ] Frontend detecta `IN_PORTAL = window.self !== window.top`
- [ ] Header propio oculto cuando `IN_PORTAL === true`
- [ ] Botón Salir usa `const portalUrl = import.meta.env.VITE_PORTAL_URL ?? 'http://localhost:5174'` como target del postMessage
- [ ] `frontend/.env.example` creado con `VITE_PORTAL_URL=http://localhost:5174`
- [ ] CORS del backend incluye variable configurable para el origen del portal
- [ ] Entrada en `APP_CONFIGS` del launcher con backend/frontend cmd + health URL + timeout
- [ ] Origen `` `http://${_H}:PUERTO` `` en `ALLOWED_APP_ORIGINS` del portal `App.tsx`
- [ ] Invariante de test en `registry.test.ts`
- [ ] `.gitignore` con `node_modules/`, `dist/`, `.env`

---

## Decisiones técnicas

| Decisión | Razón |
|----------|-------|
| Sin React Router | Un `useState` es suficiente con una sola "ruta activa". Se agrega Router cuando haya rutas anidadas reales. |
| Nav pills en header (no sidebar) | UX compacta — no consume espacio horizontal. |
| CSS plano (sin Tailwind/MUI) | DS propio ya define clases. MUI solo en apps que lo heredan (Bandas). |
| Sin backend en el portal | El portal es puro shell estático. |
| postMessage (no shared state) | Único canal cross-origin disponible para iframes. |
| `position: absolute; inset: 0` en AppFrame | Más robusto que flex encadenado sin sidebar. |
| Vitest 4.x (no 2.x) | @vitejs/plugin-react v6 es ESM-only; Vitest 2.x lo carga con `require()` y falla. |
| `VITE_HOST` en lugar de `VITE_*_URL` por app | Una sola variable controla todos los puertos. Menos configuración en `.env`. |
| Launcher en `0.0.0.0` | Permite acceso desde red sin cambiar código — solo config en `.env`. |
| Health checks en `localhost` dentro del launcher | El launcher verifica sus propios procesos locales; `APP_HOST` es solo para el browser externo. |
| `AUTOSTART_APPS=false` por defecto | En desarrollo lanzar todo al inicio ralentiza el arranque. En servidor se activa explícitamente. |
| Backend inline (Sound Catch) | El router FastAPI de Sound Catch se monta dentro del gateway (`app.include_router(router, prefix='/api/sound-catch/api')`). Elimina un subprocess y un puerto extra. Válido cuando el backend es Python/FastAPI y puede importarse como módulo. |
| `??` vs `||` en env vars de cliente | `VITE_API_URL=` en `.env` produce `""` en el bundle. `"" ?? fallback` = `""` (bug). `"" \|\| fallback` = fallback (fix). Usar siempre `\|\|` para valores que pueden ser string vacío. |
| `Cache-Control: no-cache` en index.html | Evita que el browser sirva el HTML obsoleto tras un rebuild. Los assets con hash son inmutables y se cachean 1 año. Elimina la necesidad de Ctrl+Shift+R después de actualizar. |
| Limpieza de caché en startup | `launcher_ui.py` borra `__pycache__` y `node_modules/.vite/` antes de arrancar el gateway — garantiza código fresco sin mantenimiento manual. |
| `/api/shutdown-portal` en gateway | Único endpoint que para subprocesos Y apaga el propio uvicorn. Necesario porque uvicorn no puede terminar el proceso padre desde un endpoint normal sin `os._exit()`. |

---

## Historial de versiones

| Fecha | Cambio |
|-------|--------|
| 2026-06-10 | v0.1: Proyecto iniciado. CLAUDE.md + DESIGN_SYSTEM.md. Estructura base. |
| 2026-06-10 | v0.2: Portal shell construido. Nav pills, AppFrame, Dashboard, 4 apps en registry. |
| 2026-06-11 | **FASE 0:** Portal Launcher (`portal-launcher/launcher.py`) — Flask :4999, `APP_CONFIGS`, launch/status/stop, `_kill_port()`, `.env` con `ALLOWED_ORIGINS`. |
| 2026-06-11 | **FASE 1:** Integración Bandas Salariales en iframe. `IN_PORTAL` en Layout.tsx (oculta AppBar + Drawer). `handleConfirmSalir` con postMessage. `CssBaseline` condicional en App.tsx. CORS ASP.NET. |
| 2026-06-11 | **FASE 1:** Salir Reporte DevOps — `handleSalir` reemplaza `window.confirm()` + `window.close()` con `apiSalir()` + postMessage. |
| 2026-06-11 | **FASE 1:** Job Matcher vanilla — `IN_PORTAL` script en `index.html` oculta `.hdr`. `doExit()` usa postMessage. |
| 2026-06-11 | **FASE 2:** React 19.2.7 + Vite 8.0.16 + @vitejs/plugin-react 6.0.2 en portal y Reporte DevOps. Vitest 4.1.8 (fix incompatibilidad ESM). Tests: 82/82. |
| 2026-06-12 | **FASE 3:** Job Matcher migrado de vanilla HTML+JS a React 19 + Vite. Nueva app en `JOB_MATCHER/frontend/` puerto :5003. Backend queda API pura en :5002 (`express.static` removido). Launcher actualizado (dos procesos). `ALLOWED_APP_ORIGINS` :5002 → :5003. |
| 2026-06-12 | **FASE 4:** Bandas Salariales — MUI completamente eliminado (`@mui/material`, `@mui/icons-material`, `@emotion/*`). Todos los componentes migrados a HTML + CSS plano DS. `index.css` reescrito con tokens DS y clases reutilizables. `theme.ts` simplificado. `tsc --noEmit` + `vite build` limpios. 55 paquetes MUI/Emotion removidos. |
| 2026-06-12 | **FASE 5:** Vitest 4.x añadido a las 3 apps del ecosistema. Reporte DevOps: `header.test.tsx` (17 tests) + `client.test.ts` (26 tests) = **43/43**. Job Matcher: `stepbar.test.tsx` (26 tests) + `uploadzone.test.tsx` (31 tests) = **57/57**. Bandas Salariales: `theme.test.ts` (51 tests) + `components.test.tsx` (45 tests) = **96/96**. Total ecosistema: **196 tests** (82 portal + 43 RDO + 57 JM + 96 BS). |
| 2026-06-12 | **FASE 6:** Survey Analytics construida. ASP.NET Core :5055 + React 19 Vite :5176. SurveyMonkey API v3 (Bearer token). Dashboard KPIs + buscador + SurveyCards. SurveyDetail con BarChart recharts. Vitest: `header.test.tsx` (20) + `surveycard.test.tsx` (17) = **37/37**. Survey `status: 'active'` en registry. Portal: 111/111 tests. Total ecosistema: **315 tests**. |
| 2026-06-12 | **FASE 7:** Hosted deployment — eliminación de `localhost` hardcodeado en todos los paths. `VITE_HOST` controla host en portal shell (registry, launcher client, ALLOWED_APP_ORIGINS). `VITE_PORTAL_URL` en cada frontend de app para destino de postMessage. CORS configurable vía env vars en todos los backends. Launcher escucha en `0.0.0.0`. `AUTOSTART_APPS` lanza todas las apps al iniciar. UI flotante (`launcher_ui.py`) lee `PORTAL_URL` del `.env`. `.env.example` añadido a todos los frontends. 24 archivos · 111/111 tests. |
| 2026-06-12 | **RDO orgs dinámicas + Consultar:** Reporte DevOps — `/api/organizaciones` consulta Azure DevOps en tiempo real (perfil PAT → cuentas). Fallback a `AZURE_DEVOPS_ORGS` en `.env`. Orgs se cargan automáticamente al activarse la app (`loadingOrgs=true` al montar). `/api/organizaciones/refresh` eliminado. Botón **[Consultar]** a la derecha del dropdown de Proyectos (reemplaza auto-load al seleccionar). `apiOrgsRefresh` eliminado de `client.ts`. RDO tests: **42/42** (−1). |
| 2026-06-12 | **RDO sprint cards:** Nuevo endpoint `GET /api/sprints/<org>/<proyecto>` → `SprintsResult { current, anterior, futuros }`. Helpers: `ESTADOS_CERRADOS`, `_wiql_post` (charset UTF-8, sin `[System.TeamProject]`), `get_resumen_sprint`, `get_tc_ids_por_iteracion`, `get_testplan_progress` (paginación `x-ms-continuationtoken`). Frontend: componente `SprintCard` + 3 tarjetas (Sprint Actual verde, Sprint Anterior naranja, Sprints Futuros). Nuevas interfaces TS: `WorkItemsResumen`, `TestPlanProgress`, `SprintData`, `SprintsResult`. `apiSprints()` en client.ts. Historial siempre visible; logs expandibles. Total ecosistema: **343 tests** (111+42+57+96+37). |
| 2026-06-16 | **Gateway + fix iframe:** `portal_server.py` (FastAPI/uvicorn) punto de entrada unificado en `:5174`. Apps servidas en `/apps/{id}/`. Fix bug crítico: `vite.config.js` en Bandas Salariales (sin `base`) overrideaba `vite.config.ts` con prioridad en resolución Vite — assets sin prefijo → gateway servía `index.html` del portal para los JS → `<script type="module">` rechazado por MIME → app no cargaba. Fix: eliminado `vite.config.js`, rebuild Bandas `dist/`. `AppFrame.tsx`: `isGatewayUrl = app.url.startsWith('/apps/')` para preflight same-origin sin `no-cors` y detección correcta de 503. `launcher_ui.py`: `_startup_sequence` reescrito para arrancar `portal_server.py` directamente y esperar `/api/health` (hasta 45s). 5 assertions RDO `client.test.ts` actualizadas a rutas `/api/reporte-devops/...`. **Total: 377/377 tests** (Portal 127 · Bandas 114 · RDO 42 · JM 57 · Survey 37). |
| 2026-06-19 | **Sound Catch integrado:** App de transcripción de audio multi-formato con IA (Whisper). Backend FastAPI montado **inline** en el gateway (`include_router` en `/api/sound-catch/api/`). Frontend React 19 + Vite :5009. `VITE_API_URL=` (vacío) + `??` causaba fetch a `/api/info` (sin prefijo) → 404. Fix: `\|\|` en client.ts. Proxy vite.config.ts corregido. `client.test.ts` (11 tests). `sound-catch` en `APP_REGISTRY` con `url: '/apps/sound-catch/'`. `ALLOWED_APP_ORIGINS` actualizado con `:5009`. |
| 2026-06-19 | **Fix bugs de usuario (6):** (1) Sound Catch — ver entrada anterior. (2) Survey "JSON inválido" → ASP.NET Core `UseResponseCompression` enviaba Brotli; `portal_server.py` excluye `accept-encoding` de headers reenviados — el gateway descomprime por su cuenta. (3) JM "JSON inválido" en upload → Node.js `compression()` middleware; mismo fix del gateway. (4) Bandas "no carga front" → `BrowserRouter` sin `basename`; Fix: `basename="/apps/bandas-salariales"`. (5) RDO — timing issue, sin cambio de código. (6) Pantalla de carga baja calidad en 4K → `windll.shcore.SetProcessDpiAwareness(2)` + fallback. Nuevos tests: `JM/client.test.ts` (24) + `Survey/client.test.ts` (25). **Total: 426/426 tests** (Portal 127 · Bandas 114 · RDO 42 · JM 81 · Survey 62). |
| 2026-06-19 | **UX: cards y botón Salir.** (1) Cards del Dashboard ya no abren la app al hacer click — solo el botón **Abrir →** abre. Eliminada clase `.app-card.clickable` de CSS. (2) Botón **Salir** del portal cierra todo: llama `/api/shutdown-portal` (detiene todos los subprocesos + `os._exit(0)` en el gateway) y luego `window.close()`. Eliminada función `stopAll()` de `App.tsx` (era huérfana). +1 test en `components.test.tsx`. `dist/` reconstruido. **Total: 128/128 tests**. |
| 2026-06-19 | **Cache HTTP + limpieza en startup.** `portal_server.py`: `index.html` se sirve con `Cache-Control: no-cache, no-store, must-revalidate` (portal y todas las apps) — el browser siempre re-valida sin necesitar Ctrl+Shift+R. Assets en `assets/` con hash de contenido: `Cache-Control: public, max-age=31536000, immutable`. `launcher_ui.py`: paso nuevo "Limpiando caché…" (#2 en secuencia) — borra `__pycache__/` en raíz + `portal-launcher/` y `node_modules/.vite/` antes de iniciar el gateway. `START_UNIFIED.bat` + `requirements_gateway.txt` committed. **Total: 128/128 tests** (Portal 128 · Bandas 114 · RDO 42 · JM 81 · Survey 62 = **427 total**). |
