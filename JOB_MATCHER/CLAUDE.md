# CLAUDE.md — Job Matcher + JD Generator CFOTech

Guía de contexto para futuras sesiones de Claude Code en este proyecto.

---

## ¿Qué es este proyecto?

Dos herramientas de IA integradas en una única app:

**Job Matcher:** sube un Job Description + CVs (y opcionalmente un documento de proyecto) → Claude analiza cada candidato contra el puesto → produce scores en 8 dimensiones, fortalezas, brechas, red flags, preguntas de entrevista + ChatJob (Q&A sobre el análisis).

**JD Generator:** sube una propuesta técnica → Claude detecta los perfiles necesarios → el usuario selecciona uno → Claude genera un Job Description en DOCX con el template corporativo.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | **React 19** + **Vite 8** + TypeScript strict — puerto `:5003` |
| Backend | Node.js + **Express** — puerto `:5002` (API pura, sin `express.static`) |
| IA | **Anthropic Claude** (`claude-sonnet-4-6`) vía API REST |
| Extracción de texto | `pdf-parse` (PDF), `mammoth` (DOCX), `officeparser` (PPTX) |
| Generación DOCX | `docxtemplater` + `pizzip` |
| CORS | `cors` — solo orígenes explícitos (`:5003` frontend + `:5174` portal) |
| Config | `dotenv` + `.env` |
| Proxy (dev) | Vite proxy: `/api`, `/upload`, `/analyze`, `/summarize`, `/ask-question` → `:5002` |
| Runtime | Windows 11 / PowerShell · Node.js 18+ |

> **FASE 3 (2026-06-12):** frontend migrado de vanilla HTML+JS a React 19 + Vite.
> El backend ya no sirve archivos estáticos — es API pura.

---

## Estructura de archivos

```
JOB_MATCHER\
├── CLAUDE.md                    ← este archivo
├── start.bat                    ← libera :5002 y :5003, lanza backend + frontend, abre :5003
├── stop.bat                     ← mata procesos en :5002 y :5003
│
├── backend\                     ── API Node.js/Express :5002 ─────────────────────
│   ├── server.js                ← entry point — todos los endpoints
│   ├── .env                     ← ANTHROPIC_API_KEY, PORT, CORS_ORIGINS
│   ├── package.json
│   ├── uploads\                 ← archivos temporales de multer (gitignore)
│   ├── templates\               ← templates DOCX guardados por el usuario
│   └── logs\                    ← trace logs por fecha
│
└── frontend\                    ── React 19 + Vite :5003 (FASE 3) ────────────────
    ├── index.html
    ├── package.json             ← react ^19.2.7, vite ^8.0.16
    ├── vite.config.ts           ← port 5003, proxy /api /upload /analyze /summarize /ask-question → :5002
    ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
    └── src\
        ├── main.tsx
        ├── vite-env.d.ts
        ├── App.tsx              ← tabs (matcher / jdgen), Salir modal, IN_PORTAL, postMessage
        ├── index.css            ← variables DS + todos los estilos de la app
        ├── types.ts             ← CandidateAnalysis, ScoresDetallados, JDAnalysis, JDProfile, Template
        ├── api\
        │   └── client.ts        ← wrappers tipados para todos los endpoints
        ├── components\
        │   ├── Header.tsx       ← DS Header 48px, API status (polling 10s), Salir
        │   ├── UploadZone.tsx   ← drag & drop, estados idle/loading/ready
        │   └── StepBar.tsx      ← barra de pasos done/active/pending
        └── pages\
            ├── JobMatcher.tsx   ← upload JD + Proyecto + CVs → análisis → resultados + ChatJob
            └── JDGenerator.tsx  ← upload propuesta → análisis perfiles → chat → generar DOCX
```

---

## Cómo levantar

### Opción A — start.bat
```
start.bat → libera :5002 y :5003 → instala deps si faltan → lanza backend + frontend → abre :5003
```

### Opción B — Terminal (dos procesos)
```powershell
# Backend API :5002
cd "C:\Esteban CFOTech\Portal de Acceso\JOB_MATCHER\backend"
npm install    # solo la primera vez
node server.js
# → API en http://localhost:5002

# Frontend React :5003 (otra terminal)
cd "C:\Esteban CFOTech\Portal de Acceso\JOB_MATCHER\frontend"
npm install    # solo la primera vez
npm run dev
# → UI en http://localhost:5003
```

### Desde el portal (recomendado)
El Portal Launcher `:4999` maneja ambos procesos automáticamente cuando el usuario hace clic en "Job Matcher" en el portal.

---

## Endpoints API (backend :5002)

### Job Matcher

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check — `{ status: 'ok' }` |
| POST | `/api/shutdown` | Apaga el servidor Node.js (delay 500ms) |
| POST | `/upload` | Extrae texto de PDF/DOCX/TXT (multer disk). Devuelve `{ success, text, summary, candidateName }` |
| POST | `/summarize` | Resume un texto con Claude. Body: `{ text, type: 'project'|'job'|'propuesta' }` → `{ success, summary }` |
| POST | `/analyze` | Analiza un candidato vs JD con Claude. Body: `{ candidateName, candidateText, jobText, projectText? }` → `{ success, analysis }` (analysis es JSON en string) |
| POST | `/ask-question` | Q&A con Claude sobre un análisis. Body: `{ question, analysisResult, projectContext?, jobDescription? }` → `{ success, answer }` |

### JD Generator

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/analyze` | Analiza propuesta técnica con Claude → detecta perfiles necesarios. Form: `propuesta` (file) + `contexto?` → `{ success, analysis: JDAnalysis }` |
| POST | `/api/generate` | Genera DOCX de Job Description. Form: `propuesta` + `cliente` + `rol` + `tipo_perfil` + `seniority` + `contexto?` + `respuestas_refinamiento?` + `template_id?` → binario DOCX |
| GET  | `/api/templates` | Lista templates guardados → `{ templates: Template[] }` |
| POST | `/api/templates` | Guarda un template DOCX. Form: `template` (file) + `nombre` + `perfil` |
| DELETE | `/api/templates/:id` | Elimina un template por ID |

---

## Variables de entorno (`backend/.env`)

| Variable | Descripción |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key de Anthropic — **NO commitear, rotar si se expone** |
| `PORT` | Puerto del backend (default: 5002) |
| `CORS_ORIGINS` | Orígenes CORS permitidos, CSV: `http://localhost:5003,http://localhost:5174` |

> ⚠️ Si la API key aparece en git, rotarla en [console.anthropic.com](https://console.anthropic.com) inmediatamente.

---

## Modelo IA

Claude `claude-sonnet-4-6` (último modelo Sonnet disponible).

Para cambiar el modelo, editar en `server.js`:
```javascript
model: 'claude-sonnet-4-6',  // actualizar aquí
```

---

## Tipos TypeScript principales (`src/types.ts`)

```typescript
interface CandidateAnalysis {
  compatibilidad_general: number           // 0-100
  nivel_match:            string           // 'Alto' | 'Medio' | 'Bajo'
  recomendacion:          string           // 'Contratar' | 'Evaluar' | 'Descartar'
  scores_detallados: {
    fit_tecnico:                   number
    fit_experiencia:               number
    fit_liderazgo:                 number
    fit_cultural:                  number
    fit_idiomas_comunicacion:      number
    fit_formacion_certificaciones: number
    fit_compensacion_expectativas: number
    red_flags_alertas:             number
  }
  fortalezas_criticas:          string[]
  fortalezas_adicionales:       string[]
  brechas_criticas:             string[]
  brechas_menores:              string[]
  red_flags:                    string[]
  puntos_validar_entrevista:    string[]
  analisis_tecnico_detallado:   string
  analisis_experiencia_liderazgo: string
  analisis_cultural_comunicacion: string
  justificacion_recomendacion:  string
}

interface JDAnalysis {
  proyecto:               string
  cliente:                string
  duracion:               string
  stack_principal:        string[]
  perfiles_identificados: JDProfile[]
  total_jds:              number
  observaciones:          string
}
```

---

## Integración con el portal

### IN_PORTAL detection
```typescript
// App.tsx — módulo-level, no cambia en runtime
const IN_PORTAL = window.self !== window.top
```

- `IN_PORTAL = true` → Header propio **no se renderiza** (el portal shell provee el suyo), Salir aparece en la tab bar.
- `IN_PORTAL = false` → Se renderiza el `<Header>` completo con DS, logo, API status y Salir.

### Salir / postMessage
```typescript
// App.tsx
async function handleSalir() {
  try { await apiShutdown() } catch {}   // apaga Node.js :5002
  if (IN_PORTAL) {
    window.parent.postMessage(
      { type: 'portal:goHome', appId: 'job-matcher' },
      'http://localhost:5174',
    )
    // El portal llama a launcher stop → mata :5002 y :5003
  } else {
    setTimeout(() => window.close(), 600)
  }
}
```

### CORS del backend
El backend en `:5002` debe aceptar llamadas desde:
- `:5003` — frontend Vite en dev
- `:5174` — portal (puede llamar a `/api/health`)

Configurado en `backend/.env`:
```
CORS_ORIGINS=http://localhost:5003,http://localhost:5174
```

---

## Proxy Vite (`frontend/vite.config.ts`)

```typescript
proxy: {
  '/api':          { target: 'http://localhost:5002', changeOrigin: true },  // /api/health, /api/shutdown, /api/analyze, /api/generate, /api/templates
  '/upload':       { target: 'http://localhost:5002', changeOrigin: true },  // extracción de texto
  '/analyze':      { target: 'http://localhost:5002', changeOrigin: true },  // Job Matcher: analizar candidato
  '/summarize':    { target: 'http://localhost:5002', changeOrigin: true },  // resumir JD/proyecto/propuesta
  '/ask-question': { target: 'http://localhost:5002', changeOrigin: true },  // ChatJob Q&A
}
```

Nota: `/api/analyze` (JD Generator) es capturado por la regla `/api`, no por `/analyze`.

---

## Design System

Ver `C:\Esteban CFOTech\Portal de Acceso\DESIGN_SYSTEM.md` para tokens canónicos.

Los tokens DS están en `src/index.css` como variables CSS y se usan en toda la app.
No usar colores hardcodeados — solo `var(--navy)`, `var(--green)`, etc.

---

## Cómo extender

### Agregar un endpoint nuevo al backend
1. Agregar la ruta en `server.js`
2. Agregar el wrapper tipado en `frontend/src/api/client.ts`
3. Si la ruta no empieza con `/api`, agregar entrada en el proxy de `vite.config.ts`
4. Documentar en la tabla de endpoints de este CLAUDE.md

### Agregar un nuevo modelo Claude
Cambiar la constante del modelo en `server.js`. El resto del código es agnóstico al modelo.

### Agregar soporte multi-idioma al JD
Agregar campo `idioma` al form de generación y pasarlo al prompt de Claude en `server.js`.

---

## Historial de versiones

| Fecha | Cambio |
|-------|--------|
| 2026-06-11 | v1 (pre-FASE 3): App vanilla HTML+JS. Express sirve frontend estático desde `/frontend`. Backend monolito en :5002. |
| 2026-06-11 | Integración portal FASE 1: `IN_PORTAL` en `index.html`, header oculto en iframe, `doExit()` con postMessage. |
| 2026-06-11 | Backend refactor: `dotenv`, CORS explícito, modelo `claude-sonnet-4-6`, logs, `/api/health`, `/api/shutdown`. |
| 2026-06-12 | **FASE 3:** Frontend migrado de vanilla HTML+JS a React 19 + Vite 8 + TypeScript. Backend separado: `express.static` removido, API pura en :5002. Nuevo frontend en `frontend/` puerto :5003. Proxy Vite para todos los endpoints. Launcher actualizado (2 procesos). Portal `ALLOWED_APP_ORIGINS` actualizado a :5003. |
| 2026-06-12 | **FASE 5:** Tests añadidos. `vitest.config.ts` + `setup.ts` + `stepbar.test.tsx` (26 tests) + `uploadzone.test.tsx` (31 tests). **57/57** pasan. |
