# CLAUDE.md — Reporte DevOps CFOTech

Guía de contexto para futuras sesiones de Claude Code en este proyecto.

---

## ¿Qué es este proyecto?

App web que consulta **Azure DevOps** en tiempo real y permite:
- Visualizar métricas de proyectos (work items, épicas, user stories, avance %, sprints, headcount)
- Ver desvíos de sprint con semáforo de alertas (OK / DESVÍO / RIESGO)
- Ver estrategia de pruebas (test plans, suites, runs, pass rate)
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
        ├── index.css                ← variables DS + todos los estilos
        ├── types.ts                 ← interfaces TS (Org, Proyecto, Detalle, TestPlan…)
        ├── api\
        │   └── client.ts            ← wrappers fetch tipados para todos /api/*
        ├── components\
        │   └── Header.tsx           ← DS Header 48px (logo, API status, Salir)
        └── pages\
            └── ReporteDevOps.tsx    ← toda la lógica: orgs, proyectos, métricas, PDF, salir
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
  window.parent.postMessage(
    { type: 'portal:goHome', appId: 'reporte-devops' },
    'http://localhost:5174',
  )
  // El portal: llama launcher stop → mata :5000 y :5001 → vuelve al Dashboard
}
```

En modo standalone, el postMessage llega al mismo `window` (sin efecto visual) y la pestaña queda abierta — el usuario cierra manualmente. No se usa `window.close()` porque está bloqueado en contextos cross-origin.

### CORS del backend Flask
```python
# app.py
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5001')
CORS(app, origins=[FRONTEND_URL, 'http://localhost:5174'])
```

Variable en `.env`:
```
FRONTEND_URL=http://localhost:5001
```

---

## Endpoints API (backend :5000)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check — `{ ok: true }` |
| POST | `/api/generar` | Inicia pipeline (extraccion → procesamiento → PDF) en hilo separado |
| GET | `/api/estado` | Polling del estado (`corriendo`, `ok`, `error`) |
| GET | `/api/organizaciones` | Lista inmediata desde `.env` |
| GET | `/api/organizaciones/refresh` | Consulta dinámica a Azure DevOps API |
| GET | `/api/proyectos/<org>` | Proyectos de una org |
| GET | `/api/proyecto_info/<org>/<proyecto>` | Iteraciones + headcount |
| GET | `/api/proyecto/<org>/<proyecto>` | Métricas completas + desvíos de sprint |
| GET | `/api/testplans/<org>/<proyecto>` | Planes, suites y runs de test |
| GET | `/api/historial` | Lista de PDFs en `output/` (últimos 20) |
| GET | `/api/logs` | Lista de trace logs (últimos 30) |
| GET | `/api/logs/<nombre>` | Contenido de un log |
| GET | `/api/descargar/<nombre>` | Descarga de un PDF |
| GET | `/api/datos` | JSON de `datos_procesados.json` |
| POST | `/api/salir` | Shutdown del servidor Flask (delay 800ms) |

---

## Variables de entorno (`backend/.env`)

| Variable | Descripción |
|----------|-------------|
| `AZURE_DEVOPS_PAT` | Personal Access Token de Azure DevOps |
| `AZURE_DEVOPS_ORG` | URL de la org principal (fallback) |
| `AZURE_DEVOPS_ORGS` | Lista CSV de nombres de org |
| `OUTPUT_DIR` | Ruta absoluta donde se guardan los PDFs |
| `PROYECTOS_EXCLUIDOS` | CSV de proyectos a omitir (case-insensitive) |
| `FRONTEND_URL` | URL del frontend para CORS (`http://localhost:5001`) |

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

### Cambios aplicados en la refactorización (vs original)

| Elemento | Original (MS Fluent) | Nuevo (CFOTech DS) |
|----------|---------------------|-------------------|
| Header bg | `#004578` | `#0B1526` (--navy-dark) |
| Header alto | 52px | **48px** |
| Logo | verde oscuro 38px círculo | `#00A878` 32px r-8px "CFO" |
| Body bg | `#F3F2F1` | `#F4F6F9` (--gray1) |
| Card radius | 4px | **12px** |
| Btn principal | `#0078D4` (MS Blue) | `#0A1F44` (--navy) |
| Btn Salir | borde recto | **pill border-radius 20px** |

---

## Cómo extender

### Agregar una nueva org
Editar `AZURE_DEVOPS_ORGS` en `.env`.

### Agregar un nuevo endpoint
1. Agregar función en `app.py` con `@app.route('/api/nuevo')`
2. Agregar wrapper tipado en `frontend/src/api/client.ts`
3. Documentar en la tabla de endpoints de este CLAUDE.md

### Agregar un nuevo campo al PDF
1. Asegurarse que `procesamiento.py` lo calcule en `datos_procesados.json`
2. Agregar columna en `generar_pdf.py` → `mk_table()`

### Cambiar colores del PDF
Todos los colores están en la sección `# DS CFOTech IT Tools` al inicio de `generar_pdf.py`.

---

## Logs

Cada ejecución crea `logs/Trace_DD_MM_YYYY_HH_MM_SS.log`.
Se listan en `/api/logs` y se leen en `/api/logs/<nombre>`.

---

## Historial de versiones

| Fecha | Cambio |
|-------|--------|
| 2026-06-10 | v1: Refactorización desde `C:\CFOTechTools\InformeDevOps`. Design System CFOTech aplicado. |
| 2026-06-10 | v2: Backend Flask API pura (`/backend`). Frontend React 18 + Vite 5 + TypeScript (`/frontend`). Proxy Vite `/api` → `:5000`. |
| 2026-06-11 | **FASE 1 (portal):** Salir arreglado — `handleSalir` elimina `window.confirm()` / `window.close()` (bloqueados en iframe cross-origin). Ahora: `apiSalir()` + `postMessage({ type: 'portal:goHome' })`. Estado `saliendo` previene doble clic. |
| 2026-06-11 | **FASE 2:** Upgrade React 18 → **19.2.7**, Vite 5 → **8.0.16**, @vitejs/plugin-react → **6.0.2**. |
| 2026-06-12 | **FASE 5:** Tests añadidos. `vitest.config.ts` + `setup.ts` + `header.test.tsx` (17 tests) + `client.test.ts` (26 tests). **43/43** pasan. |
