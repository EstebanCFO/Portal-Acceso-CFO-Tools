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
| Auth | No implementada — planificada con Clerk/Google SSO |
| Runtime | Windows 11 / PowerShell · Node.js 18+ |
| Deploy | Vite build estático → Vercel / IIS / cualquier CDN |

> No hay backend propio. El portal es 100% estático (SPA).

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
├── START.bat                      ← inicia Vite, abre :5174
├── STOP.bat                       ← mata :5174
│
├── portal-launcher\               ← ★ Servicio local de lanzamiento de apps
│   ├── launcher.py                ← Flask :4999 — POST /api/launch, GET /api/status, POST /api/stop
│   ├── requirements.txt
│   ├── .env                       ← PORT=4999, ALLOWED_ORIGINS
│   └── START.bat / STOP.bat
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
    ├── vite-env.d.ts              ← tipos Vite (CSS imports, env vars)
    ├── App.tsx                    ← activeApp state + postMessage handler + ALLOWED_APP_ORIGINS
    ├── registry\
    │   └── apps.ts                ← ★ REGISTRO CENTRAL — editar aquí para agregar apps
    ├── components\
    │   ├── Header.tsx             ← logo + nav pills + category label + btn Salir
    │   └── AppFrame.tsx           ← <iframe> con loading / error / coming-soon / link
    ├── pages\
    │   └── Dashboard.tsx          ← banner + grilla de AppCards
    └── __tests__\
        ├── registry.test.ts       ← invariantes del registro (82 tests totales)
        └── components.test.tsx
```

---

## Cómo levantar el portal

### Opción A — Doble clic
`START.bat` → lanza Vite → abre `http://localhost:5174`

### Opción B — Terminal
```powershell
cd "C:\Esteban CFOTech\Portal de Acceso"
npm install       # solo la primera vez
npm run dev       # → http://localhost:5174
npm run build     # build de producción en dist/
npm run preview   # sirve dist/ en http://localhost:5174
npm run test      # suite Vitest (82 tests)
```

> El portal corre en `:5174` para no colisionar con las apps.

---

## Registro de apps (`src/registry/apps.ts`)

Archivo central para declarar todas las apps del portal.
**Agregar una app nueva = agregar un objeto al array `APP_REGISTRY`.**

```typescript
export const APP_REGISTRY: App[] = [
  {
    id:          'bandas-salariales',
    name:        'Bandas Salariales',
    description: 'Gestión y análisis de bandas salariales por posición y nivel',
    icon:        '📊',
    url:         'http://localhost:5173',
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
// Desde la app embebida
window.parent.postMessage(
  { type: 'portal:goHome', appId: 'job-matcher' },
  'http://localhost:5174',
)
```

El portal escucha en `App.tsx`:
```typescript
const ALLOWED_APP_ORIGINS = [
  'http://localhost:5001',   // Reporte DevOps
  'http://localhost:5173',   // Bandas Salariales
  'http://localhost:5003',   // Job Matcher (React frontend)
]

useEffect(() => {
  const handleMessage = async (e: MessageEvent) => {
    if (!ALLOWED_APP_ORIGINS.includes(e.origin)) return
    if (e.data?.type !== 'portal:goHome') return
    const appId = e.data.appId as string | undefined
    if (appId) {
      await fetch(`http://localhost:4999/api/stop/${appId}`, { method: 'POST' })
        .catch(() => {})
    }
    setActiveApp(null)   // vuelve al Dashboard
  }
  window.addEventListener('message', handleMessage)
  return () => window.removeEventListener('message', handleMessage)
}, [])
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

Servicio Flask local en `:4999` que levanta backend + frontend de cada app.

### Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/launch/<app_id>` | Lanza backend + frontend en hilos. Idempotente si ya está corriendo. |
| GET  | `/api/status/<app_id>` | Estado actual: `pending / launching / ready / error` por componente |
| POST | `/api/stop/<app_id>`   | Termina procesos, mata puertos por número, limpia estado |
| GET  | `/api/health`          | Health check del launcher |

### Configuración `APP_CONFIGS` en `launcher.py`

```python
APP_CONFIGS = {
  'reporte-devops': {
    'backend':  { 'dir': 'REPORTE_DEV_OPS\\backend',  'cmd': 'python app.py',   'health': ':5000/api/health', 'timeout': 20 },
    'frontend': { 'dir': 'REPORTE_DEV_OPS\\frontend', 'cmd': 'npm run dev',      'url': ':5001',               'timeout': 30 },
  },
  'bandas-salariales': {
    'backend':  { 'dir': 'BANDAS_SALARIALES\\BandasSalariales.Web', 'cmd': 'dotnet run', 'health': ':5050/api/health', 'timeout': 40 },
    'frontend': { 'dir': 'BANDAS_SALARIALES\\bandas-frontend',      'cmd': 'npm run dev', 'url': ':5173',              'timeout': 30 },
  },
  'job-matcher': {
    'backend':  { 'dir': 'JOB_MATCHER\\backend',  'cmd': 'node server.js', 'health': ':5002/api/health', 'timeout': 15 },
    'frontend': { 'dir': 'JOB_MATCHER\\frontend', 'cmd': 'npm run dev',    'url': ':5003',               'timeout': 40 },
  },
}
```

**Patrón monolito (vacío en `cmd`):** si `frontend.cmd = ''`, el launcher no lanza proceso extra y el frontend se asume ya servido por el backend. Ya no aplica (job-matcher fue separado en FASE 3), pero el guard `if cfg['frontend'].get('cmd')` lo sigue soportando.

### Agregar una app nueva al launcher

1. Agregar entrada en `APP_CONFIGS` en `launcher.py`
2. El lanzador levanta backend → espera health → levanta frontend → espera URL
3. El stop mata procesos Popen rastreados + `_kill_port()` como fallback

---

## Apps del ecosistema CFOTech

```
Portal de Acceso\
├── REPORTE_DEV_OPS\         ← Flask API :5000 + React/Vite :5001
├── BANDAS_SALARIALES\       ← ASP.NET Core :5050 + React/Vite/CSS-DS :5173 (sin MUI)
├── JOB_MATCHER\             ← Node.js/Express :5002 + React/Vite :5003
│   ├── backend\             ← API pura (FASE 3: express.static removido)
│   └── frontend\            ← React 19 + Vite :5003 (migrado en FASE 3)
├── portal-launcher\         ← Flask :4999
└── src\                     ← Portal shell React 19 + Vite :5174
```

| App | Puertos | Stack | Estado |
|-----|---------|-------|--------|
| Portal shell | `:5174` | React 19 + Vite 8 | ✅ activo |
| Reporte DevOps | `:5001` front / `:5000` API | React 19 + Vite 8 / Flask | ✅ activo |
| Bandas Salariales | `:5173` front / `:5050` API | React 19 + Vite 8 + CSS plano DS / ASP.NET Core | ✅ activo |
| Job Matcher + JD Generator | `:5003` front / `:5002` API | React 19 + Vite 8 / Node.js + Express | ✅ activo (FASE 3) |
| Survey Analytics | `:5176` front / `:5055` API | React 19 + Vite 8 / ASP.NET Core 8 | ✅ activo (FASE 6) |
| Portal Launcher | `:4999` | Flask | ✅ activo |

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
- **No hardcodear URLs**: siempre desde `app.url` del registry o `import.meta.env`.
- **Tests**: agregar invariante en `registry.test.ts` por cada app nueva en `APP_REGISTRY`.

---

## Cómo extender

### Agregar una nueva app al portal

1. `src/registry/apps.ts` → agregar objeto al array `APP_REGISTRY`
2. `portal-launcher/launcher.py` → agregar entrada en `APP_CONFIGS`
3. `src/App.tsx` → agregar origen de la app en `ALLOWED_APP_ORIGINS`
4. `src/__tests__/registry.test.ts` → agregar invariante de la nueva app
5. En la app: implementar `IN_PORTAL` detection + postMessage para salir

**Sin reinicio necesario en desarrollo** — Vite recarga automáticamente.

### Checklist de integración de cada nueva app

- [ ] Backend expone `GET /api/health` y `POST /api/shutdown` (o `/api/salir`)
- [ ] Frontend detecta `IN_PORTAL = window.self !== window.top`
- [ ] Header propio oculto cuando `IN_PORTAL === true`
- [ ] Botón Salir envía `postMessage({ type: 'portal:goHome', appId: '...' }, 'http://localhost:5174')`
- [ ] CORS del backend permite `:5174` (portal) y su propio frontend
- [ ] Entrada en `APP_CONFIGS` del launcher con backend/frontend cmd + health URL + timeout
- [ ] Origen en `ALLOWED_APP_ORIGINS` del portal `App.tsx`
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
| 2026-06-12 | **FASE 6:** Survey Analytics construida. ASP.NET Core :5055 + React 19 Vite :5176. SurveyMonkey API v3 (Bearer token). Dashboard KPIs + buscador + SurveyCards. SurveyDetail con BarChart recharts. Vitest: `header.test.tsx` (20) + `surveycard.test.tsx` (17) = **37/37**. Survey `status: 'active'` en registry. Portal: 94/94 tests. Total ecosistema: **315 tests**. |
