# CLAUDE.md — Reporte DevOps CFOTech

Guía de contexto para futuras sesiones de Claude Code en este proyecto.

---

## ¿Qué es este proyecto?

App web que consulta **Azure DevOps** en tiempo real y permite:
- Ver los **sprints activos** de cualquier proyecto: work items (total/abiertas/cerradas por estado) y test plan progress (casos definidos, test points corridos, pass rate)
- Consultar el **sprint anterior** (PAST más reciente) con las mismas métricas
- Ver **sprints futuros** planificados (nombre + fechas)
- Generar un informe PDF consolidado de todas las orgs/proyectos
- Descargar PDFs del historial de ejecuciones

**Refactorizado desde** `C:\CFOTechTools\InformeDevOps` — mismo comportamiento, nuevo diseño CFOTech DS.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.x + Flask 3 + flask-cors (API pura, sin templates) |
| Frontend | **React 19** + **Vite 8** + TypeScript strict |
| CSS | CSS plano con variables DS (sin Tailwind, sin MUI) |
| Generación de PDF | ReportLab |
| API externa | Azure DevOps REST API v7.1 (auth PAT) |
| Config | `python-dotenv` + `.env` |
| Runtime | Windows 11 / Python + Node en PATH |

> **Sin base de datos.** Backend puro API: no sirve HTML, no usa Jinja2.
> En desarrollo: proxy Vite `/api` → `:5000` evita CORS. En prod: flask-cors permite `FRONTEND_URL`.

---

## Estructura de archivos

```
REPORTE_DEV_OPS\
├── CLAUDE.md                        ← este archivo
├── START.bat                        ← inicia backend (:5000) + frontend (:5001), abre browser
├── STOP.bat                         ← mata procesos en :5000 y :5001
│
├── backend\                         ── API Flask pura ──────────────────────────────
│   ├── app.py                       ← Flask + flask-cors, todos los /api/*
│   │                                   helpers: _wiql_post, get_resumen_sprint,
│   │                                   get_tc_ids_por_iteracion, get_testplan_progress
│   ├── extraccion.py                ← ETL: Azure DevOps → datos_raw.json
│   ├── procesamiento.py             ← métricas + desvíos → datos_procesados.json
│   ├── generar_pdf.py               ← PDF con ReportLab (paleta DS CFOTech)
│   ├── requirements.txt             ← flask, flask-cors, python-dotenv, requests, reportlab
│   ├── .env                         ← PAT, ORGS, OUTPUT_DIR, FRONTEND_URL
│   ├── output\                      ← PDFs generados (gitignore)
│   ├── logs\                        ← Trace_DD_MM_YYYY_HH_MM_SS.log
│   ├── datos_raw.json               ← generado por extraccion.py (gitignore)
│   └── datos_procesados.json        ← generado por procesamiento.py (gitignore)
│
└── frontend\                        ── React 19 + Vite 8 + TypeScript ──────────────
    ├── index.html
    ├── package.json                 ← react ^19.2.7, vite ^8.0.16
    ├── vite.config.ts               ← port 5001, proxy /api → :5000
    ├── tsconfig.json / tsconfig.*.json
    └── src\
        ├── main.tsx
        ├── vite-env.d.ts
        ├── App.tsx                  ← Header + página principal
        ├── index.css                ← variables DS + todos los estilos (incl. sprint cards)
        ├── types.ts                 ← interfaces TS — Org, Proyecto, SprintsResult,
        │                               WorkItemsResumen, TestPlanProgress, SprintData…
        ├── api\
        │   └── client.ts            ← wrappers fetch tipados para todos /api/*
        ├── components\
        │   └── Header.tsx           ← DS Header 48px (logo, API status, Salir)
        └── pages\
            └── ReporteDevOps.tsx    ← lógica principal: orgs→proyectos→Consultar→3 tarjetas
```

---

## Cómo levantar

### Opción A — Doble clic
`START.bat` → libera :5000 y :5001 → inicia Flask en `/backend` → inicia Vite en `/frontend` → abre `http://localhost:5001`

### Opción B — Terminal
```powershell
# Backend Flask
cd "C:\Esteban CFOTech\Portal de Acceso\REPORTE_DEV_OPS\backend"
pip install -r requirements.txt   # solo la primera vez
python app.py
# → API en http://localhost:5000

# Frontend React (otra terminal)
cd "C:\Esteban CFOTech\Portal de Acceso\REPORTE_DEV_OPS\frontend"
npm install   # solo la primera vez
npm run dev
# → UI en http://localhost:5001
```

### Desde el portal (recomendado)
El Portal Launcher `:4999` maneja ambos procesos automáticamente.

---

## Flujo de uso

```
App activa en el portal
  → dropdown ORGANIZACIÓN: "Cargando..." (consulta Azure: perfil → cuentas del PAT)
  → dropdown habilitado con todas las orgs del PAT

Seleccionar ORGANIZACIÓN
  → dropdown PROYECTOS: "Cargando..." (GET /api/proyectos/<org>)

Seleccionar PROYECTO + clic [Consultar]
  → spinner "Consultando Azure DevOps..."
  → GET /api/sprints/<org>/<proyecto>
  → aparecen las 3 tarjetas
```

---

## Las 3 tarjetas de sprint

### Tarjeta 1 — Sprint actual (CURRENT)
- Badge verde **SPRINT ACTUAL** + nombre + fechas (inicio → fin)
- Work items: total / abiertas (naranja) / cerradas (verde)
- Detalle por estado: dot color + nombre + qty + barra de proporción
- Test Plan:
  - Nombre del plan (estrategia: match por nombre sprint → fallback ID más alto)
  - Test Cases definidos en la iteración
  - Test Points corridos N/total + progress bar %
  - Pass Rate: pasados/corridos + progress bar (verde ≥80% / naranja ≥50% / rojo <50%)

### Tarjeta 2 — Sprint anterior (PAST más reciente)
- Badge naranja **SPRINT ANTERIOR** — misma estructura que Tarjeta 1

### Tarjeta 3 — Sprints futuros (FUTURE)
- Solo nombre + fechas por cada sprint planificado

---

## Integración con el portal (iframe)

### IN_PORTAL detection
```typescript
// ReporteDevOps.tsx o Header.tsx — módulo-level
const IN_PORTAL = window.self !== window.top
```

- `true` → Header propio no se renderiza (usa el del portal shell).
- `false` → Header completo con logo CFO, API status dot y botón Salir.

### Salir / postMessage
El botón "Salir" en `ReporteDevOps.tsx`:

```tsx
const [saliendo, setSaliendo] = useState(false)

const handleSalir = async () => {
  if (saliendo) return
  setSaliendo(true)
  try { await apiSalir() } catch {}  // llama POST /api/salir (Flask shutdown)
  const portalUrl = import.meta.env.VITE_PORTAL_URL ?? 'http://localhost:5174'
  window.parent.postMessage(
    { type: 'portal:goHome', appId: 'reporte-devops' },
    portalUrl,
  )
}
```

### CORS del backend Flask
```python
FRONTEND_URL  = os.getenv('FRONTEND_URL',  'http://localhost:5001')
PORTAL_ORIGIN = os.getenv('PORTAL_ORIGIN', 'http://localhost:5174')
CORS(app, origins=[FRONTEND_URL, PORTAL_ORIGIN])
```

---

## Endpoints API (backend :5000)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check — `{ ok: true }` |
| POST | `/api/generar` | Inicia pipeline (extraccion → procesamiento → PDF) en hilo separado |
| GET | `/api/estado` | Polling del estado (`corriendo`, `ok`, `error`) |
| GET | `/api/organizaciones` | Consulta Azure (perfil → cuentas del PAT). Fallback a `.env` si falla. |
| GET | `/api/proyectos/<org>` | Proyectos de una org (hasta 200, excluye `PROYECTOS_EXCLUIDOS`) |
| GET | `/api/proyecto_info/<org>/<proyecto>` | Iteraciones + headcount |
| GET | `/api/proyecto/<org>/<proyecto>` | Métricas completas + desvíos de sprint |
| GET | `/api/testplans/<org>/<proyecto>` | Planes, suites y runs de test |
| **GET** | **`/api/sprints/<org>/<proyecto>`** | **Sprint actual + anterior + futuros con work items y test plan progress** |
| GET | `/api/historial` | Lista de PDFs en `output/` (últimos 20) |
| GET | `/api/logs` | Lista de trace logs (últimos 30) |
| GET | `/api/logs/<nombre>` | Contenido de un log |
| GET | `/api/descargar/<nombre>` | Descarga de un PDF |
| GET | `/api/datos` | JSON de `datos_procesados.json` |
| POST | `/api/salir` | Shutdown del servidor Flask (delay 800ms) |

---

## Helpers de sprint (`app.py`)

```python
ESTADOS_CERRADOS = frozenset({
    'Closed', 'Done', 'Resolved', 'Completed',
    'Fixed', 'Removed', 'Resuelta', 'Finalizado',
})
```

| Función | Qué hace |
|---------|----------|
| `_wiql_post(org, project_ref, query)` | WIQL con `charset=utf-8`. Sin filtro `[System.TeamProject]` — evita errores con tildes en nombres de proyecto |
| `get_resumen_sprint(org, ref, iter_path)` | Work items de la iteración: total/abiertas/cerradas/estados. Batch de 200 IDs |
| `get_tc_ids_por_iteracion(org, ref, iter_path)` | IDs de Test Cases de la iteración (para filtrar test points) |
| `get_testplan_progress(org, ref, sprint_nombre, iter_path)` | Match plan por nombre → fallback ID más alto. Paginación via `x-ms-continuationtoken` |

---

## Tipos TypeScript principales (`src/types.ts`)

```typescript
// Sprint
interface WorkItemsResumen {
  total: number; abiertas: number; cerradas: number
  estados: Record<string, number>
}

interface TestPlanProgress {
  encontrado: boolean; planNombre: string; totalPlanes: number
  total: number; corridos: number; pasados: number
  pctCorridos: number; pctPass: number
}

interface SprintData {
  nombre: string; path: string; inicio: string; fin: string
  workitems: WorkItemsResumen
  testplan: TestPlanProgress
}

interface SprintsResult {
  current:  SprintData | null
  anterior: SprintData | null
  futuros:  Array<{ nombre: string; inicio: string; fin: string }>
}
```

---

## Variables de entorno (`backend/.env`)

| Variable | Descripción |
|----------|-------------|
| `AZURE_DEVOPS_PAT` | Personal Access Token de Azure DevOps |
| `AZURE_DEVOPS_ORG` | Org principal (fallback si API falla y no hay ORGS) |
| `AZURE_DEVOPS_ORGS` | CSV de nombres de org (fallback si API falla) |
| `OUTPUT_DIR` | Ruta absoluta donde se guardan los PDFs |
| `PROYECTOS_EXCLUIDOS` | CSV de proyectos a omitir (case-insensitive) |
| `FRONTEND_URL` | URL del frontend para CORS (`http://localhost:5001`) |
| `PORTAL_ORIGIN` | URL del portal para CORS (`http://localhost:5174`) |

---

## Pipeline de generación de PDF

```
POST /api/generar
  └─ hilo separado: ejecutar_scripts()
      ├─ 1. extraccion.py   → datos_raw.json
      ├─ 2. procesamiento.py → datos_procesados.json
      └─ 3. generar_pdf.py   → output/informe_YYYYMMDD.pdf

GET /api/estado (polling c/2s desde frontend)
  └─ devuelve: { corriendo, ultimo_estado, ultimo_mensaje, ultimo_pdf }
```

---

## Design System

**Leer `DESIGN_SYSTEM.md` del portal antes de modificar cualquier pantalla.**

Tokens clave usados en sprint cards: `--green` (cerradas/pass), `--orange` (abiertas/sprint anterior), `--red` (pass rate bajo), `--gray1` (fondo wi-card), `--navy` (tp-plan-name).

---

## Cómo extender

### Agregar una nueva org
Se carga automáticamente desde Azure. Si la API falla, editar `AZURE_DEVOPS_ORGS` en `.env`.

### Agregar un nuevo endpoint
1. Agregar función en `app.py` con `@app.route('/api/nuevo')`
2. Agregar wrapper tipado en `frontend/src/api/client.ts`
3. Documentar en la tabla de endpoints de este CLAUDE.md

### Agregar un nuevo campo al PDF
1. Asegurarse que `procesamiento.py` lo calcule en `datos_procesados.json`
2. Agregar columna en `generar_pdf.py` → `mk_table()`

---

## Logs

Cada ejecución crea `logs/Trace_DD_MM_YYYY_HH_MM_SS.log`.
Se listan en `/api/logs` y se leen en `/api/logs/<nombre>`.
En el frontend: botón "Ver logs" en el pie de página (expandible).

---

## Historial de versiones

| Fecha | Cambio |
|-------|--------|
| 2026-06-10 | v1: Refactorización desde `C:\CFOTechTools\InformeDevOps`. Design System CFOTech aplicado. |
| 2026-06-10 | v2: Backend Flask API pura (`/backend`). Frontend React 18 + Vite 5 + TypeScript (`/frontend`). Proxy Vite `/api` → `:5000`. |
| 2026-06-11 | **FASE 1 (portal):** Salir arreglado — `handleSalir` elimina `window.confirm()` / `window.close()`. Ahora: `apiSalir()` + `postMessage({ type: 'portal:goHome' })`. |
| 2026-06-11 | **FASE 2:** Upgrade React 18 → **19.2.7**, Vite 5 → **8.0.16**, @vitejs/plugin-react → **6.0.2**. |
| 2026-06-12 | **FASE 5:** Tests añadidos. `vitest.config.ts` + `setup.ts` + `header.test.tsx` (17 tests) + `client.test.ts` (26 tests). **43/43** pasan. |
| 2026-06-12 | **FASE 7 (hosted):** `VITE_PORTAL_URL` en frontend para postMessage. `PORTAL_ORIGIN` en backend para CORS. Sin localhost hardcodeado. |
| 2026-06-12 | **Sprint 1 perf:** `if app.debug` guard en request logger Flask. |
| 2026-06-12 | **UX dropdowns:** `/api/organizaciones` consulta Azure DevOps (perfil → cuentas) con fallback a `.env`. Orgs se cargan automáticamente al activarse la app. `/api/organizaciones/refresh` eliminado. Etiqueta "Proyecto" → "Proyectos". Botón [Consultar] a la derecha del dropdown de proyectos. `apiOrgsRefresh` eliminado de `client.ts`. Tests: **42/42** (−1 test de apiOrgsRefresh). |
| 2026-06-12 | **Sprint cards:** Nuevo endpoint `GET /api/sprints/<org>/<proyecto>` con helpers WIQL, resumen work items y test plan progress (lógica fiel al script PS de referencia). Frontend: 3 tarjetas (sprint actual, sprint anterior, sprints futuros) reemplazan la vista de KPIs+tabs. Nuevas interfaces TypeScript + `apiSprints()`. Historial siempre visible al pie; logs expandibles. |
| 2026-06-19 | **Rediseño de layout.** Historial de PDFs quitado de la vista principal — accesible desde footer. Botón **"Ver log"** expandible + botón **"Generar informe"** destacado. Layout más limpio centrado en la selección org/proyecto y las 3 tarjetas de sprint. |
| 2026-06-19 | **Fix compresión + mejoras de client.ts.** Bug: Flask `serve_forever` + ninguna compresión, pero gateway excluye `accept-encoding` uniformemente (fix preventivo). `client.ts`: prefijo unificado `/api/reporte-devops` — funciona en dev (proxy Vite) y prod (gateway). Invariantes de test actualizadas a rutas gateway. **Total: 42/42 tests** (header 17 + client 25). |
| 2026-06-19 | **Rediseño sprint report con filtro por año + risk calc.** Backend: 3 nuevos endpoints (`/api/orgs-for-year`, `/api/projects-for-year`, `/api/sprint-report`) con `ThreadPoolExecutor` para paralelizar checks; helpers `_project_first_sprint_in_year` y `get_sprint_items` (Task/Bug con id/title/state/type/assignedTo). Frontend: cascade Año→Org→Proyecto; 4 metric cards (Total tasks, % Avance, Velocidad, Riesgo BAJO/MEDIO/ALTO/N/A calculado por días hábiles lun-vie); barra de progreso con color dinámico; carpetas colapsables Task/Bug con React `useState`; avatares con iniciales + color determinista. Nuevas interfaces `WorkItem`, `SprintDetail`, `SprintReportResult`, `ProjectForYear`. Nuevas clases CSS `rdo-*`. **Total: 52/52 tests** (header 17 + client 35). |
