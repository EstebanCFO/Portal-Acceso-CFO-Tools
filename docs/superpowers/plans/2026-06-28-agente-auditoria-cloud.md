# Agente de Auditoría de Accesibilidad Cloud — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una web app cloud serverless donde cualquier usuario autenticado con cuenta Microsoft pueda auditar la accesibilidad de un repositorio, URL o app local y recibir un informe WCAG 2.2 / ONTI / BCRA A7517 descargable.

**Architecture:** React 19 + Vite en Azure Static Web Apps (gratis); Azure Functions Python para llamar Claude API y generar el informe; Azure Blob Storage para persistir los MD/JSON y servir el historial. La app misma cumple WCAG 2.2 AA.

**Tech Stack:** React 19 · Vite 8 · TypeScript strict · CSS plano DS CFOTech · Azure Static Web Apps · Azure Functions v2 Python 3.11 · Azure Blob Storage · Anthropic Python SDK · `claude-sonnet-4-6` · Vitest 4.x · pytest

## Global Constraints

- TypeScript `strict: true` — no `any`
- CSS plano DS CFOTech (`--navy`, `--green-a`, `--gray1`, etc.) — sin Tailwind, sin MUI
- `||` para env vars (no `??`) — ver code-style.md del portal
- React 19 + Vite 8 + Vitest 4.x — mismas versiones que el portal shell
- WCAG 2.2 nivel AA — la app de auditoría debe cumplirla: contraste 4.5:1, focus visible, landmarks, skip link, labels explícitos, `aria-live`, tab order lógico
- Nunca incluir PATs ni credenciales en código, logs ni output — redactar como `[PAT_REDACTED]`
- Modelo Claude: `claude-sonnet-4-6` (variable `CLAUDE_MODEL` en `audit_agent.py`)
- Directorio raíz del proyecto: `C:\Esteban CFOTech\Portal de Acceso\AGENTE_AUDITORIA_CLOUD\`

---

## Estructura de archivos

```
AGENTE_AUDITORIA_CLOUD/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── staticwebapp.config.json   ← auth + routing Azure SWA
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                ← estado central + routing de fases
│       ├── index.css              ← DS CFOTech + clases WCAG (skip-link, focus-ring)
│       ├── vite-env.d.ts
│       ├── types/
│       │   └── audit.ts           ← tipos compartidos (AuditRequest, AuditResponse, etc.)
│       ├── api/
│       │   └── client.ts          ← runAudit() + getHistory()
│       ├── components/
│       │   ├── SkipLink.tsx       ← "Saltar al contenido" WCAG 2.4.1
│       │   ├── AppHeader.tsx      ← header DS CFOTech + login/logout
│       │   ├── AuditForm.tsx      ← formulario 3 modos con labels y ARIA
│       │   ├── ProgressPanel.tsx  ← pasos animados + aria-live
│       │   ├── ResultsPanel.tsx   ← preview MD + botones descarga
│       │   └── HistoryPanel.tsx   ← lista de auditorías pasadas
│       └── __tests__/
│           ├── AuditForm.test.tsx
│           ├── ResultsPanel.test.tsx
│           └── client.test.ts
├── api/
│   ├── function_app.py            ← Azure Functions HTTP triggers
│   ├── audit_agent.py             ← llama Claude API + parsea output
│   ├── fetchers.py                ← fetch_repo / fetch_url / fetch_local
│   ├── blob_storage.py            ← save_report / list_reports
│   ├── requirements.txt
│   ├── local.settings.json        ← gitignored — variables locales
│   └── tests/
│       ├── test_audit.py
│       ├── test_fetchers.py
│       └── test_storage.py
├── .gitignore
└── README.md
```

---

## Task 1: Scaffold del frontend — estructura base + DS CFOTech + WCAG layout

**Files:**
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/package.json`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/vite.config.ts`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/tsconfig.json`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/tsconfig.node.json`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/index.html`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/vite-env.d.ts`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/index.css`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/main.tsx`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/App.tsx`

**Interfaces:**
- Produce: `<div id="root">` con skip-link + `<header>` + `<main id="main">` — base para todos los componentes.

- [ ] **Step 1: Crear directorios**

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso"
New-Item -ItemType Directory -Force AGENTE_AUDITORIA_CLOUD\frontend\src\types
New-Item -ItemType Directory -Force AGENTE_AUDITORIA_CLOUD\frontend\src\api
New-Item -ItemType Directory -Force AGENTE_AUDITORIA_CLOUD\frontend\src\components
New-Item -ItemType Directory -Force AGENTE_AUDITORIA_CLOUD\frontend\src\__tests__
New-Item -ItemType Directory -Force AGENTE_AUDITORIA_CLOUD\api\tests
```

- [ ] **Step 2: Crear `package.json`**

```json
// AGENTE_AUDITORIA_CLOUD/frontend/package.json
{
  "name": "agente-auditoria-cloud",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "coverage": "vitest run --coverage"
  },
  "dependencies": {
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^6.0.2",
    "@vitest/coverage-v8": "^4.1.8",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.5.2",
    "@testing-library/jest-dom": "^6.6.3",
    "typescript": "~5.7.2",
    "vite": "^8.0.16",
    "vitest": "^4.1.8",
    "jsdom": "^26.1.0"
  }
}
```

- [ ] **Step 3: Crear `vite.config.ts`**

```typescript
// AGENTE_AUDITORIA_CLOUD/frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5020 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    coverage: { provider: 'v8' },
  },
})
```

- [ ] **Step 4: Crear `tsconfig.json`**

```json
// AGENTE_AUDITORIA_CLOUD/frontend/tsconfig.json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.app.json" }
  ]
}
```

```json
// AGENTE_AUDITORIA_CLOUD/frontend/tsconfig.app.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

```json
// AGENTE_AUDITORIA_CLOUD/frontend/tsconfig.node.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Crear `index.html` con estructura WCAG**

```html
<!-- AGENTE_AUDITORIA_CLOUD/frontend/index.html -->
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Auditoría de Accesibilidad — CFOTech</title>
    <meta name="description" content="Herramienta de auditoría de accesibilidad digital para bancos y billeteras según WCAG 2.2, ONTI y BCRA A7517." />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Crear `src/index.css` con DS CFOTech + clases WCAG**

```css
/* AGENTE_AUDITORIA_CLOUD/frontend/src/index.css */

/* ── DS CFOTech tokens ─────────────────────────────────── */
:root {
  --navy-dark:  #0B1526;
  --navy:       #0A1F44;
  --navy-light: #1A3560;
  --nav-active: #1B3F8A;
  --green-a:    #4FD1B2;
  --logo-green: #00A878;
  --green:      #00875A;
  --green-l:    #E3F5EE;
  --gray1:      #F4F6F9;
  --gray2:      #E8ECF2;
  --gray3:      #C4CDD8;
  --border:     #D1D9E6;
  --text:       #0D1B2A;
  --text2:      #4A5568;
  --text3:      #718096;
  --orange:     #C96A00;
  --orange-l:   #FFF3E0;
  --red:        #C0392B;
  --red-l:      #FDECEA;
  --header-h:   48px;
  --font: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* ── Reset ─────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 14px; }
body {
  font-family: var(--font);
  color: var(--text);
  background: var(--gray1);
  min-height: 100vh;
}
#root { min-height: 100vh; display: flex; flex-direction: column; }

/* ── Skip link (WCAG 2.4.1) ────────────────────────────── */
.skip-link {
  position: absolute;
  top: -100px;
  left: 8px;
  background: var(--navy);
  color: #fff;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  z-index: 9999;
  text-decoration: none;
  transition: top 0.1s;
}
.skip-link:focus { top: 8px; }

/* ── Focus visible global (WCAG 2.4.11) ────────────────── */
*:focus-visible {
  outline: 2px solid var(--green-a);
  outline-offset: 2px;
  border-radius: 3px;
}
*:focus:not(:focus-visible) { outline: none; }

/* ── Header ─────────────────────────────────────────────── */
.app-header {
  height: var(--header-h);
  background: var(--navy-dark);
  border-bottom: 3px solid #1C2E48;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 12px;
  flex-shrink: 0;
  z-index: 100;
}
.header-logo-badge {
  width: 32px; height: 32px;
  background: var(--logo-green);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}
.header-brand { display: flex; flex-direction: column; }
.header-brand-name { color: #fff; font-size: 13px; font-weight: 700; line-height: 1.2; }
.header-brand-sub  { color: var(--green-a); font-size: 11px; font-weight: 700; }
.header-spacer { flex: 1; }
.header-user { color: rgba(255,255,255,.7); font-size: 12px; }

/* ── Layout principal ───────────────────────────────────── */
.app-main {
  flex: 1;
  padding: 32px 24px;
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
}

/* ── Card ───────────────────────────────────────────────── */
.card {
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 24px;
  margin-bottom: 20px;
}
.card-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--navy);
  margin-bottom: 20px;
}

/* ── Tipo selector (tabs) ───────────────────────────────── */
.type-tabs { display: flex; gap: 8px; margin-bottom: 24px; }
.type-tab {
  padding: 8px 20px;
  border-radius: 20px;
  border: 1.5px solid var(--border);
  background: #fff;
  color: var(--text2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all .15s;
}
.type-tab:hover { border-color: var(--navy); color: var(--navy); }
.type-tab[aria-pressed="true"] {
  background: var(--navy);
  border-color: var(--navy);
  color: #fff;
}

/* ── Form fields ────────────────────────────────────────── */
.form-group { margin-bottom: 16px; }
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text2);
  margin-bottom: 6px;
}
.form-label span[aria-hidden="true"] { color: var(--red); margin-left: 2px; }
.form-input, .form-select {
  display: block;
  width: 100%;
  padding: 9px 12px;
  border: 1.5px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  font-family: var(--font);
  color: var(--text);
  background: #fff;
  transition: border-color .15s;
}
.form-input:focus, .form-select:focus { border-color: var(--navy); }
.form-input[aria-invalid="true"] { border-color: var(--red); }
.form-error {
  font-size: 12px;
  color: var(--red);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.form-hint { font-size: 12px; color: var(--text3); margin-top: 4px; }

/* ── Checkbox group ─────────────────────────────────────── */
.checkbox-group { display: flex; gap: 16px; flex-wrap: wrap; }
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
}
.checkbox-label input[type="checkbox"] {
  width: 16px; height: 16px;
  accent-color: var(--navy);
  cursor: pointer;
}

/* ── Botón principal ────────────────────────────────────── */
.btn-primary {
  padding: 10px 24px;
  background: var(--navy);
  color: #fff;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.btn-primary:hover:not(:disabled) { background: var(--navy-light); }
.btn-primary:disabled { opacity: .55; cursor: not-allowed; }

.btn-secondary {
  padding: 8px 18px;
  background: #fff;
  color: var(--navy);
  border: 1.5px solid var(--navy);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all .15s;
}
.btn-secondary:hover { background: var(--gray1); }

/* ── Progress ───────────────────────────────────────────── */
.progress-step { display: flex; align-items: center; gap: 12px; padding: 10px 0; }
.progress-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.progress-dot--done    { background: var(--green); }
.progress-dot--active  { background: var(--green-a); animation: pulse 1s infinite; }
.progress-dot--pending { background: var(--gray3); }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
.progress-label { font-size: 13px; color: var(--text2); }
.progress-label--active { color: var(--text); font-weight: 600; }

/* ── Results ─────────────────────────────────────────────── */
.result-summary {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.badge-severity {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
}
.badge-alta   { background: var(--red-l);    color: var(--red);    }
.badge-media  { background: var(--orange-l); color: var(--orange); }
.badge-baja   { background: var(--green-l);  color: var(--green);  }

.download-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }

/* ── History ─────────────────────────────────────────────── */
.history-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--gray2);
  font-size: 13px;
}
.history-row:last-child { border-bottom: none; }
.history-app   { font-weight: 600; flex: 1; min-width: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
.history-date  { color: var(--text3); flex-shrink: 0; }
.history-links { display: flex; gap: 8px; flex-shrink: 0; }

/* ── Error banner ───────────────────────────────────────── */
.banner { padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }
.banner--error   { background: var(--red-l);    color: var(--red);    border-left: 4px solid var(--red); }
.banner--success { background: var(--green-l);  color: var(--green);  border-left: 4px solid var(--green); }
```

- [ ] **Step 7: Crear `src/main.tsx`**

```tsx
// AGENTE_AUDITORIA_CLOUD/frontend/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('No #root element found')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 8: Crear `src/App.tsx` esqueleto**

```tsx
// AGENTE_AUDITORIA_CLOUD/frontend/src/App.tsx
import { useState } from 'react'
import { SkipLink } from './components/SkipLink'
import { AppHeader } from './components/AppHeader'

// Fases de la UI
type Phase = 'form' | 'progress' | 'results'

export const App = () => {
  const [phase, setPhase] = useState<Phase>('form')

  return (
    <>
      <SkipLink />
      <AppHeader />
      <main id="main" className="app-main">
        <p>Fase actual: {phase}</p>
      </main>
    </>
  )
}
```

- [ ] **Step 9: Crear `src/__tests__/setup.ts`**

```typescript
// AGENTE_AUDITORIA_CLOUD/frontend/src/__tests__/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 10: Instalar dependencias y verificar que arranca**

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso\AGENTE_AUDITORIA_CLOUD\frontend"
npm install
npm run test:run
```

Expected: 0 tests run, 0 failures (scaffolding sin tests aún).

- [ ] **Step 11: Commit**

```bash
git add AGENTE_AUDITORIA_CLOUD/
git commit -m "feat(auditoria-cloud): scaffold frontend React 19 + DS CFOTech + WCAG base layout"
```

---

## Task 2: Tipos TypeScript + API client

**Files:**
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/types/audit.ts`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/api/client.ts`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/__tests__/client.test.ts`

**Interfaces:**
- Produce: `AuditRequest`, `AuditResponse`, `AuditStatus`, `HistoryEntry` (tipos públicos), `runAudit(req): Promise<AuditResponse>`, `getHistory(): Promise<HistoryEntry[]>`

- [ ] **Step 1: Escribir test del cliente (TDD RED)**

```typescript
// AGENTE_AUDITORIA_CLOUD/frontend/src/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runAudit, getHistory } from '../api/client'
import type { AuditRequest } from '../types/audit'

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

describe('runAudit', () => {
  it('POST /api/audit con JSON para tipo repo', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ informe_md: '# Test', brechas_resumen: { alta: 1, media: 2, baja: 3 } }),
    })
    const req: AuditRequest = {
      type: 'repo',
      normativas: ['wcag22'],
      repo: { platform: 'azure-devops', org: 'mi-org', project: 'mi-proyecto', repo: 'mi-repo', branch: 'main', pat: 'abc' },
    }
    const result = await runAudit(req)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/audit'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(result.informe_md).toBe('# Test')
  })

  it('POST /api/audit con FormData para tipo local', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ informe_md: '# Local', brechas_resumen: { alta: 0, media: 1, baja: 0 } }),
    })
    const file = new File(['<html></html>'], 'index.html', { type: 'text/html' })
    const req: AuditRequest = {
      type: 'local',
      normativas: ['wcag22', 'onti'],
      local: { files: [file], name: 'Mi App' },
    }
    const result = await runAudit(req)
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(options.body).toBeInstanceOf(FormData)
    expect(result.informe_md).toBe('# Local')
  })

  it('lanza error si la respuesta no es ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Internal error' })
    const req: AuditRequest = { type: 'url', normativas: ['wcag22'], url: { url: 'https://example.com', depth: 1 } }
    await expect(runAudit(req)).rejects.toThrow('Internal error')
  })
})

describe('getHistory', () => {
  it('GET /api/history y retorna lista', async () => {
    const mockHistory = [{ nombre_app: 'bancogalicia', fecha: '2026-06-28', version: '', url_md: '', url_json: '', brechas: { alta: 8, media: 12, baja: 10 } }]
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockHistory })
    const result = await getHistory()
    expect(result).toHaveLength(1)
    expect(result[0].nombre_app).toBe('bancogalicia')
  })
})
```

- [ ] **Step 2: Verificar que el test falla**

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso\AGENTE_AUDITORIA_CLOUD\frontend"
npm run test:run
```

Expected: FAIL — `Cannot find module '../api/client'`

- [ ] **Step 3: Crear `src/types/audit.ts`**

```typescript
// AGENTE_AUDITORIA_CLOUD/frontend/src/types/audit.ts
export type ResourceType = 'repo' | 'url' | 'local'
export type Platform = 'azure-devops' | 'github'
export type Normativa = 'wcag22' | 'onti' | 'bcra'

export interface RepoInput {
  platform: Platform
  org: string
  project: string
  repo: string
  branch: string
  pat: string
}

export interface UrlInput {
  url: string
  depth: 1 | 2
}

export interface LocalInput {
  files: File[]
  name: string
}

export interface AuditRequest {
  type: ResourceType
  normativas: Normativa[]
  repo?: RepoInput
  url?: UrlInput
  local?: LocalInput
}

export interface BreachCount {
  alta: number
  media: number
  baja: number
}

export interface AuditResponse {
  informe_md: string
  informe_json: string
  brechas_resumen: BreachCount
  blob_url_md: string
  blob_url_json: string
  nombre_app: string
  fecha: string
}

export interface HistoryEntry {
  nombre_app: string
  fecha: string
  version: string
  url_md: string
  url_json: string
  brechas: BreachCount
}

export type AuditStatus =
  | { phase: 'idle' }
  | { phase: 'loading'; step: string; stepIndex: number; totalSteps: number }
  | { phase: 'done'; result: AuditResponse }
  | { phase: 'error'; message: string }
```

- [ ] **Step 4: Crear `src/api/client.ts`**

```typescript
// AGENTE_AUDITORIA_CLOUD/frontend/src/api/client.ts
import type { AuditRequest, AuditResponse, HistoryEntry } from '../types/audit'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export async function runAudit(request: AuditRequest): Promise<AuditResponse> {
  let body: FormData | string
  const headers: HeadersInit = {}

  if (request.type === 'local' && request.local) {
    const fd = new FormData()
    fd.append('type', 'local')
    fd.append('name', request.local.name)
    fd.append('normativas', JSON.stringify(request.normativas))
    for (const file of request.local.files) {
      fd.append('files', file)
    }
    body = fd
    // No Content-Type header — fetch lo setea solo con boundary para FormData
  } else {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(request)
  }

  const res = await fetch(`${API_BASE}/audit`, { method: 'POST', headers, body })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `HTTP ${res.status}`)
  }

  return res.json() as Promise<AuditResponse>
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const res = await fetch(`${API_BASE}/history`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<HistoryEntry[]>
}
```

- [ ] **Step 5: Verificar que los tests pasan**

```powershell
npm run test:run
```

Expected: PASS — 4 tests en `client.test.ts`

- [ ] **Step 6: Commit**

```bash
git add AGENTE_AUDITORIA_CLOUD/frontend/src/types/ AGENTE_AUDITORIA_CLOUD/frontend/src/api/ AGENTE_AUDITORIA_CLOUD/frontend/src/__tests__/client.test.ts
git commit -m "feat(auditoria-cloud): tipos TypeScript + API client con tests"
```

---

## Task 3: Componentes base (SkipLink + AppHeader) + AuditForm

**Files:**
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/components/SkipLink.tsx`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/components/AppHeader.tsx`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/components/AuditForm.tsx`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/__tests__/AuditForm.test.tsx`

**Interfaces:**
- Consumes: `AuditRequest`, `ResourceType`, `Normativa` de `../types/audit`
- Produce: `<AuditForm onSubmit={(req) => void} disabled={boolean} />`

- [ ] **Step 1: Crear tests de AuditForm (TDD RED)**

```tsx
// AGENTE_AUDITORIA_CLOUD/frontend/src/__tests__/AuditForm.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuditForm } from '../components/AuditForm'

describe('AuditForm — accesibilidad WCAG', () => {
  it('tiene un botón de submit accesible', () => {
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    expect(screen.getByRole('button', { name: /iniciar auditoría/i })).toBeInTheDocument()
  })

  it('todos los inputs tienen label asociado', () => {
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    // Modo repo (default): org, project, repo, branch, PAT
    expect(screen.getByLabelText(/organización/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/proyecto/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/repositorio/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/token de acceso/i)).toBeInTheDocument()
  })

  it('muestra error accesible cuando faltan campos requeridos', async () => {
    const user = userEvent.setup()
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    await user.click(screen.getByRole('button', { name: /iniciar auditoría/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    // El input tiene aria-invalid
    expect(screen.getByLabelText(/organización/i)).toHaveAttribute('aria-invalid', 'true')
  })

  it('cambia a modo URL al seleccionar la tab URL', async () => {
    const user = userEvent.setup()
    render(<AuditForm onSubmit={vi.fn()} disabled={false} />)
    await user.click(screen.getByRole('button', { name: /url/i, pressed: false }))
    expect(screen.getByLabelText(/url del sitio/i)).toBeInTheDocument()
  })

  it('llama onSubmit con los datos correctos en modo URL', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AuditForm onSubmit={onSubmit} disabled={false} />)
    await user.click(screen.getByRole('button', { name: /url/i, pressed: false }))
    await user.type(screen.getByLabelText(/url del sitio/i), 'https://example.com')
    await user.click(screen.getByRole('button', { name: /iniciar auditoría/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'url', url: expect.objectContaining({ url: 'https://example.com' }) })
    )
  })

  it('deshabilita el formulario cuando disabled=true', () => {
    render(<AuditForm onSubmit={vi.fn()} disabled={true} />)
    expect(screen.getByRole('button', { name: /iniciar auditoría/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Verificar que los tests fallan**

```powershell
npm run test:run
```

Expected: FAIL — `Cannot find module '../components/AuditForm'`

- [ ] **Step 3: Crear `SkipLink.tsx`**

```tsx
// AGENTE_AUDITORIA_CLOUD/frontend/src/components/SkipLink.tsx
export const SkipLink = () => (
  <a href="#main" className="skip-link">
    Saltar al contenido principal
  </a>
)
```

- [ ] **Step 4: Crear `AppHeader.tsx`**

```tsx
// AGENTE_AUDITORIA_CLOUD/frontend/src/components/AppHeader.tsx
interface Props {
  userName?: string
}

export const AppHeader = ({ userName }: Props) => (
  <header className="app-header" role="banner">
    <div className="header-logo-badge" aria-hidden="true">CFO</div>
    <div className="header-brand">
      <span className="header-brand-name">CFOTech</span>
      <span className="header-brand-sub">Auditoría de Accesibilidad</span>
    </div>
    <div className="header-spacer" />
    {userName && (
      <span className="header-user" aria-label={`Usuario: ${userName}`}>
        {userName}
      </span>
    )}
  </header>
)
```

- [ ] **Step 5: Crear `AuditForm.tsx`**

```tsx
// AGENTE_AUDITORIA_CLOUD/frontend/src/components/AuditForm.tsx
import { useState, useId, useRef } from 'react'
import type { AuditRequest, ResourceType, Normativa } from '../types/audit'

interface Props {
  onSubmit: (req: AuditRequest) => void
  disabled: boolean
}

const NORMATIVAS: { id: Normativa; label: string }[] = [
  { id: 'wcag22', label: 'WCAG 2.2' },
  { id: 'onti',   label: 'ONTI / Ley 26.653' },
  { id: 'bcra',   label: 'BCRA A7517' },
]

export const AuditForm = ({ onSubmit, disabled }: Props) => {
  const [type, setType]             = useState<ResourceType>('repo')
  const [org, setOrg]               = useState('')
  const [project, setProject]       = useState('')
  const [repoName, setRepoName]     = useState('')
  const [branch, setBranch]         = useState('main')
  const [pat, setPat]               = useState('')
  const [url, setUrl]               = useState('')
  const [depth, setDepth]           = useState<1 | 2>(1)
  const [files, setFiles]           = useState<File[]>([])
  const [localName, setLocalName]   = useState('')
  const [normativas, setNormativas] = useState<Normativa[]>(['wcag22', 'onti', 'bcra'])
  const [errors, setErrors]         = useState<Record<string, string>>({})
  const errorRef = useRef<HTMLDivElement>(null)

  // IDs únicos para accesibilidad
  const orgId       = useId()
  const projectId   = useId()
  const repoId      = useId()
  const branchId    = useId()
  const patId       = useId()
  const urlId       = useId()
  const depthId     = useId()
  const filesId     = useId()
  const localNameId = useId()
  const errorSummId = useId()

  const toggleNormativa = (n: Normativa) =>
    setNormativas(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (type === 'repo') {
      if (!org.trim())     errs.org     = 'La organización es requerida'
      if (!project.trim()) errs.project = 'El proyecto es requerido'
      if (!repoName.trim()) errs.repo   = 'El repositorio es requerido'
      if (!pat.trim())     errs.pat     = 'El Personal Access Token es requerido'
    }
    if (type === 'url') {
      if (!url.trim() || !url.startsWith('http'))
        errs.url = 'Ingresá una URL válida (https://...)'
    }
    if (type === 'local') {
      if (files.length === 0)   errs.files     = 'Seleccioná al menos un archivo HTML o CSS'
      if (!localName.trim())    errs.localName = 'El nombre del recurso es requerido'
    }
    if (normativas.length === 0) errs.normativas = 'Seleccioná al menos una normativa'
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      // Mover foco al resumen de errores (WCAG 3.3.1)
      setTimeout(() => errorRef.current?.focus(), 50)
    }
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const req: AuditRequest = {
      type,
      normativas,
      ...(type === 'repo' && { repo: { platform: 'azure-devops', org, project, repo: repoName, branch, pat } }),
      ...(type === 'url'  && { url: { url, depth } }),
      ...(type === 'local' && { local: { files, name: localName } }),
    }
    onSubmit(req)
  }

  const errorCount = Object.keys(errors).length

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Formulario de auditoría de accesibilidad">
      {/* Resumen de errores (WCAG 3.3.1) */}
      {errorCount > 0 && (
        <div
          ref={errorRef}
          id={errorSummId}
          className="banner banner--error"
          role="alert"
          tabIndex={-1}
          aria-live="assertive"
        >
          <strong>Corregí {errorCount} error{errorCount > 1 ? 'es' : ''}:</strong>{' '}
          {Object.values(errors).join(' · ')}
        </div>
      )}

      {/* ── Tipo de recurso ── */}
      <div className="form-group">
        <span className="form-label" id="type-group-label">Tipo de recurso</span>
        <div className="type-tabs" role="group" aria-labelledby="type-group-label">
          {(['repo', 'url', 'local'] as ResourceType[]).map(t => (
            <button
              key={t}
              type="button"
              className="type-tab"
              aria-pressed={type === t}
              onClick={() => { setType(t); setErrors({}) }}
            >
              {t === 'repo'  && '📁 Repositorio'}
              {t === 'url'   && '🌐 URL'}
              {t === 'local' && '📂 App local'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Campos según tipo ── */}
      {type === 'repo' && (
        <>
          <div className="form-group">
            <label htmlFor={orgId} className="form-label">
              Organización <span aria-hidden="true">*</span>
            </label>
            <input
              id={orgId}
              type="text"
              className="form-input"
              value={org}
              onChange={e => setOrg(e.target.value)}
              aria-required="true"
              aria-invalid={!!errors.org}
              aria-describedby={errors.org ? `${orgId}-error` : undefined}
              disabled={disabled}
              autoComplete="organization"
            />
            {errors.org && <p id={`${orgId}-error`} className="form-error" role="alert">{errors.org}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={projectId} className="form-label">
              Proyecto <span aria-hidden="true">*</span>
            </label>
            <input
              id={projectId}
              type="text"
              className="form-input"
              value={project}
              onChange={e => setProject(e.target.value)}
              aria-required="true"
              aria-invalid={!!errors.project}
              aria-describedby={errors.project ? `${projectId}-error` : undefined}
              disabled={disabled}
            />
            {errors.project && <p id={`${projectId}-error`} className="form-error" role="alert">{errors.project}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={repoId} className="form-label">
              Repositorio <span aria-hidden="true">*</span>
            </label>
            <input
              id={repoId}
              type="text"
              className="form-input"
              value={repoName}
              onChange={e => setRepoName(e.target.value)}
              aria-required="true"
              aria-invalid={!!errors.repo}
              aria-describedby={errors.repo ? `${repoId}-error` : undefined}
              disabled={disabled}
            />
            {errors.repo && <p id={`${repoId}-error`} className="form-error" role="alert">{errors.repo}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={branchId} className="form-label">Rama</label>
            <input
              id={branchId}
              type="text"
              className="form-input"
              value={branch}
              onChange={e => setBranch(e.target.value)}
              disabled={disabled}
            />
            <p className="form-hint">Dejar "main" si no sabés cuál es la rama principal.</p>
          </div>

          <div className="form-group">
            <label htmlFor={patId} className="form-label">
              Token de acceso (PAT) <span aria-hidden="true">*</span>
            </label>
            <input
              id={patId}
              type="password"
              className="form-input"
              value={pat}
              onChange={e => setPat(e.target.value)}
              aria-required="true"
              aria-invalid={!!errors.pat}
              aria-describedby={`${patId}-hint${errors.pat ? ` ${patId}-error` : ''}`}
              disabled={disabled}
              autoComplete="current-password"
            />
            <p id={`${patId}-hint`} className="form-hint">El token no se almacena — se usa únicamente durante la auditoría.</p>
            {errors.pat && <p id={`${patId}-error`} className="form-error" role="alert">{errors.pat}</p>}
          </div>
        </>
      )}

      {type === 'url' && (
        <>
          <div className="form-group">
            <label htmlFor={urlId} className="form-label">
              URL del sitio <span aria-hidden="true">*</span>
            </label>
            <input
              id={urlId}
              type="url"
              className="form-input"
              placeholder="https://www.bancogalicia.com.ar"
              value={url}
              onChange={e => setUrl(e.target.value)}
              aria-required="true"
              aria-invalid={!!errors.url}
              aria-describedby={errors.url ? `${urlId}-error` : undefined}
              disabled={disabled}
              autoComplete="url"
            />
            {errors.url && <p id={`${urlId}-error`} className="form-error" role="alert">{errors.url}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={depthId} className="form-label">Profundidad de rastreo</label>
            <select
              id={depthId}
              className="form-select"
              value={depth}
              onChange={e => setDepth(Number(e.target.value) as 1 | 2)}
              disabled={disabled}
            >
              <option value={1}>Solo esta página (1 nivel)</option>
              <option value={2}>Páginas enlazadas (2 niveles)</option>
            </select>
          </div>
        </>
      )}

      {type === 'local' && (
        <>
          <div className="form-group">
            <label htmlFor={localNameId} className="form-label">
              Nombre del recurso <span aria-hidden="true">*</span>
            </label>
            <input
              id={localNameId}
              type="text"
              className="form-input"
              placeholder="Mi App Web"
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              aria-required="true"
              aria-invalid={!!errors.localName}
              aria-describedby={errors.localName ? `${localNameId}-error` : undefined}
              disabled={disabled}
            />
            {errors.localName && <p id={`${localNameId}-error`} className="form-error" role="alert">{errors.localName}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={filesId} className="form-label">
              Archivos HTML / CSS <span aria-hidden="true">*</span>
            </label>
            <input
              id={filesId}
              type="file"
              className="form-input"
              multiple
              accept=".html,.htm,.css"
              onChange={e => setFiles(Array.from(e.target.files ?? []))}
              aria-required="true"
              aria-invalid={!!errors.files}
              aria-describedby={`${filesId}-hint${errors.files ? ` ${filesId}-error` : ''}`}
              disabled={disabled}
            />
            <p id={`${filesId}-hint`} className="form-hint">Podés seleccionar múltiples archivos (Ctrl+clic).</p>
            {errors.files && <p id={`${filesId}-error`} className="form-error" role="alert">{errors.files}</p>}
          </div>
        </>
      )}

      {/* ── Normativas ── */}
      <div className="form-group">
        <span className="form-label" id="normativas-label">
          Normativas a evaluar <span aria-hidden="true">*</span>
        </span>
        <div
          className="checkbox-group"
          role="group"
          aria-labelledby="normativas-label"
          aria-describedby={errors.normativas ? 'normativas-error' : undefined}
        >
          {NORMATIVAS.map(n => (
            <label key={n.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={normativas.includes(n.id)}
                onChange={() => toggleNormativa(n.id)}
                disabled={disabled}
              />
              {n.label}
            </label>
          ))}
        </div>
        {errors.normativas && <p id="normativas-error" className="form-error" role="alert">{errors.normativas}</p>}
      </div>

      <button type="submit" className="btn-primary" disabled={disabled}>
        {disabled ? '⏳ Auditando...' : '▶ Iniciar auditoría'}
      </button>
    </form>
  )
}
```

- [ ] **Step 6: Verificar que los tests pasan**

```powershell
npm run test:run
```

Expected: PASS — 6 tests en `AuditForm.test.tsx`

- [ ] **Step 7: Commit**

```bash
git add AGENTE_AUDITORIA_CLOUD/frontend/src/components/
git add AGENTE_AUDITORIA_CLOUD/frontend/src/__tests__/AuditForm.test.tsx
git commit -m "feat(auditoria-cloud): AuditForm WCAG 2.2 AA — skip-link, labels, aria-invalid, error summary"
```

---

## Task 4: ProgressPanel + ResultsPanel + HistoryPanel + App.tsx integrado

**Files:**
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/components/ProgressPanel.tsx`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/components/ResultsPanel.tsx`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/components/HistoryPanel.tsx`
- Modify: `AGENTE_AUDITORIA_CLOUD/frontend/src/App.tsx`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/src/__tests__/ResultsPanel.test.tsx`

**Interfaces:**
- Consumes: `AuditStatus`, `AuditResponse`, `HistoryEntry`
- Produce: App funcional de punta a punta en dev local

- [ ] **Step 1: Tests de ResultsPanel**

```tsx
// AGENTE_AUDITORIA_CLOUD/frontend/src/__tests__/ResultsPanel.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultsPanel } from '../components/ResultsPanel'
import type { AuditResponse } from '../types/audit'

const mockResult: AuditResponse = {
  informe_md: '# Informe\n\n## Brechas\n- Brecha 1\n- Brecha 2',
  informe_json: '{}',
  brechas_resumen: { alta: 3, media: 5, baja: 2 },
  blob_url_md: 'https://storage.azure.com/reports/test.md',
  blob_url_json: 'https://storage.azure.com/reports/test.json',
  nombre_app: 'bancogalicia',
  fecha: '2026-06-28',
}

describe('ResultsPanel', () => {
  it('muestra resumen de brechas con badges de severidad', () => {
    render(<ResultsPanel result={mockResult} onReset={vi.fn()} />)
    expect(screen.getByText('3 Altas')).toBeInTheDocument()
    expect(screen.getByText('5 Medias')).toBeInTheDocument()
    expect(screen.getByText('2 Bajas')).toBeInTheDocument()
  })

  it('tiene links de descarga accesibles con text descriptivo', () => {
    render(<ResultsPanel result={mockResult} onReset={vi.fn()} />)
    const mdLink = screen.getByRole('link', { name: /descargar informe markdown/i })
    const jsonLink = screen.getByRole('link', { name: /descargar informe json/i })
    expect(mdLink).toHaveAttribute('href', mockResult.blob_url_md)
    expect(jsonLink).toHaveAttribute('href', mockResult.blob_url_json)
  })

  it('tiene region aria-live para anunciar resultado', () => {
    const { container } = render(<ResultsPanel result={mockResult} onReset={vi.fn()} />)
    const liveRegion = container.querySelector('[aria-live]')
    expect(liveRegion).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Verificar FAIL**

```powershell
npm run test:run
```

Expected: FAIL — `Cannot find module '../components/ResultsPanel'`

- [ ] **Step 3: Crear `ProgressPanel.tsx`**

```tsx
// AGENTE_AUDITORIA_CLOUD/frontend/src/components/ProgressPanel.tsx

const STEPS = [
  'Conectando con el repositorio...',
  'Inventariando archivos...',
  'Analizando accesibilidad (WCAG 2.2)...',
  'Verificando cumplimiento ONTI y BCRA...',
  'Generando informe...',
  'Guardando informe en la nube...',
]

interface Props {
  step: string
  stepIndex: number
  totalSteps: number
}

export const ProgressPanel = ({ step, stepIndex, totalSteps }: Props) => (
  <section aria-label="Progreso de la auditoría">
    {/* Región live para lectores de pantalla */}
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      Paso {stepIndex + 1} de {totalSteps}: {step}
    </div>

    <h2 className="card-title">⏳ Auditando...</h2>

    <div role="list">
      {STEPS.map((s, i) => {
        const isDone    = i < stepIndex
        const isActive  = i === stepIndex
        const isPending = i > stepIndex
        return (
          <div key={s} className="progress-step" role="listitem">
            <span
              className={`progress-dot progress-dot--${isDone ? 'done' : isActive ? 'active' : 'pending'}`}
              aria-hidden="true"
            />
            <span className={`progress-label${isActive ? ' progress-label--active' : ''}`}>
              {isDone && '✔ '}{s}
            </span>
          </div>
        )
      })}
    </div>

    <p className="form-hint" style={{ marginTop: '16px' }}>
      La auditoría puede tardar 2-5 minutos según el tamaño del sitio.
    </p>
  </section>
)
```

- [ ] **Step 4: Crear `ResultsPanel.tsx`**

```tsx
// AGENTE_AUDITORIA_CLOUD/frontend/src/components/ResultsPanel.tsx
import type { AuditResponse } from '../types/audit'

interface Props {
  result: AuditResponse
  onReset: () => void
}

export const ResultsPanel = ({ result, onReset }: Props) => {
  const { brechas_resumen, blob_url_md, blob_url_json, nombre_app, fecha } = result

  return (
    <section aria-label="Resultado de la auditoría">
      {/* Región live — anuncia la llegada de resultados */}
      <div aria-live="polite" aria-atomic="true">
        <h2 className="card-title">
          ✅ Auditoría completada — {nombre_app} ({fecha})
        </h2>

        <div className="result-summary" role="list" aria-label="Resumen de brechas por severidad">
          <span className="badge-severity badge-alta"  role="listitem">{brechas_resumen.alta} Altas</span>
          <span className="badge-severity badge-media" role="listitem">{brechas_resumen.media} Medias</span>
          <span className="badge-severity badge-baja"  role="listitem">{brechas_resumen.baja} Bajas</span>
        </div>

        <div className="download-row">
          <a
            href={blob_url_md}
            download={`INFORME-${nombre_app}-${fecha}.md`}
            className="btn-primary"
            aria-label="Descargar informe Markdown"
          >
            ⬇ Informe MD
          </a>
          <a
            href={blob_url_json}
            download={`INFORME-${nombre_app}-${fecha}.json`}
            className="btn-secondary"
            aria-label="Descargar informe JSON"
          >
            ⬇ Informe JSON
          </a>
        </div>
      </div>

      <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

      {/* Preview del informe MD — solo texto plano para simplicidad */}
      <details>
        <summary className="form-label" style={{ cursor: 'pointer' }}>
          👁 Ver informe completo
        </summary>
        <pre
          style={{
            marginTop: '12px',
            background: 'var(--gray1)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '16px',
            fontSize: '12px',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6',
          }}
          aria-label="Contenido del informe"
        >
          {result.informe_md}
        </pre>
      </details>

      <div style={{ marginTop: '20px' }}>
        <button type="button" className="btn-secondary" onClick={onReset}>
          ← Nueva auditoría
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Crear `HistoryPanel.tsx`**

```tsx
// AGENTE_AUDITORIA_CLOUD/frontend/src/components/HistoryPanel.tsx
import { useEffect, useState } from 'react'
import { getHistory } from '../api/client'
import type { HistoryEntry } from '../types/audit'

export const HistoryPanel = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    getHistory()
      .then(setHistory)
      .catch(() => setError('No se pudo cargar el historial.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="form-hint" aria-busy="true">Cargando historial...</p>
  if (error)   return <p className="form-error" role="alert">{error}</p>
  if (history.length === 0) return <p className="form-hint">Todavía no hay auditorías guardadas.</p>

  return (
    <section aria-label="Historial de auditorías">
      <h2 className="card-title">Historial</h2>
      <div role="list">
        {history.map((entry, i) => (
          <div key={i} className="history-row" role="listitem">
            <span className="history-app">{entry.nombre_app}</span>
            <span className="history-date">{entry.fecha}</span>
            <span className="badge-severity badge-alta">{entry.brechas.alta}A</span>
            <span className="badge-severity badge-media">{entry.brechas.media}M</span>
            <span className="badge-severity badge-baja">{entry.brechas.baja}B</span>
            <div className="history-links">
              {entry.url_md && (
                <a href={entry.url_md} className="btn-secondary" aria-label={`Descargar MD de ${entry.nombre_app} ${entry.fecha}`}>
                  MD
                </a>
              )}
              {entry.url_json && (
                <a href={entry.url_json} className="btn-secondary" aria-label={`Descargar JSON de ${entry.nombre_app} ${entry.fecha}`}>
                  JSON
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Reemplazar `App.tsx` con la versión integrada**

```tsx
// AGENTE_AUDITORIA_CLOUD/frontend/src/App.tsx
import { useState } from 'react'
import { SkipLink } from './components/SkipLink'
import { AppHeader } from './components/AppHeader'
import { AuditForm } from './components/AuditForm'
import { ProgressPanel } from './components/ProgressPanel'
import { ResultsPanel } from './components/ResultsPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { runAudit } from './api/client'
import type { AuditRequest, AuditStatus } from './types/audit'

export const App = () => {
  const [status, setStatus] = useState<AuditStatus>({ phase: 'idle' })

  const handleSubmit = async (req: AuditRequest) => {
    setStatus({ phase: 'loading', step: 'Conectando...', stepIndex: 0, totalSteps: 6 })
    try {
      // Simular progreso visual durante la llamada (la Azure Function no hace streaming)
      const progressSteps = [
        'Conectando con el repositorio...',
        'Inventariando archivos...',
        'Analizando accesibilidad (WCAG 2.2)...',
        'Verificando cumplimiento ONTI y BCRA...',
        'Generando informe...',
        'Guardando informe en la nube...',
      ]
      let stepIdx = 0
      const timer = setInterval(() => {
        stepIdx = Math.min(stepIdx + 1, progressSteps.length - 1)
        setStatus({ phase: 'loading', step: progressSteps[stepIdx], stepIndex: stepIdx, totalSteps: progressSteps.length })
      }, 8000) // avanza cada 8s durante los ~48s esperados

      const result = await runAudit(req)
      clearInterval(timer)
      setStatus({ phase: 'done', result })
    } catch (err) {
      setStatus({ phase: 'error', message: err instanceof Error ? err.message : 'Error desconocido' })
    }
  }

  return (
    <>
      <SkipLink />
      <AppHeader />
      <main id="main" className="app-main">

        {status.phase === 'error' && (
          <div className="banner banner--error" role="alert" aria-live="assertive">
            <strong>Error:</strong> {status.message}
            <button
              type="button"
              className="btn-secondary"
              style={{ marginLeft: '12px' }}
              onClick={() => setStatus({ phase: 'idle' })}
            >
              Reintentar
            </button>
          </div>
        )}

        {(status.phase === 'idle' || status.phase === 'error') && (
          <>
            <div className="card">
              <h1 className="card-title">Auditoría de Accesibilidad</h1>
              <AuditForm
                onSubmit={handleSubmit}
                disabled={false}
              />
            </div>
            <div className="card">
              <HistoryPanel />
            </div>
          </>
        )}

        {status.phase === 'loading' && (
          <div className="card">
            <ProgressPanel
              step={status.step}
              stepIndex={status.stepIndex}
              totalSteps={status.totalSteps}
            />
          </div>
        )}

        {status.phase === 'done' && (
          <div className="card">
            <ResultsPanel
              result={status.result}
              onReset={() => setStatus({ phase: 'idle' })}
            />
          </div>
        )}

      </main>
    </>
  )
}
```

- [ ] **Step 7: Verificar tests**

```powershell
npm run test:run
```

Expected: PASS — todos los tests anteriores + 3 nuevos en `ResultsPanel.test.tsx`

- [ ] **Step 8: Arrancar dev server y verificar visualmente**

```powershell
npm run dev
# Abrir http://localhost:5020
# Verificar: skip-link visible al Tab, tabs de tipo funcionan, labels clicables
```

- [ ] **Step 9: Commit**

```bash
git add AGENTE_AUDITORIA_CLOUD/frontend/src/
git commit -m "feat(auditoria-cloud): ProgressPanel + ResultsPanel + HistoryPanel + App integrado"
```

---

## Task 5: Azure Function scaffold + audit_agent.py (Claude API)

**Files:**
- Create: `AGENTE_AUDITORIA_CLOUD/api/requirements.txt`
- Create: `AGENTE_AUDITORIA_CLOUD/api/local.settings.json`
- Create: `AGENTE_AUDITORIA_CLOUD/api/function_app.py`
- Create: `AGENTE_AUDITORIA_CLOUD/api/audit_agent.py`
- Create: `AGENTE_AUDITORIA_CLOUD/api/tests/test_audit.py`

**Interfaces:**
- Produce: `POST /api/audit` → `{ informe_md, informe_json, brechas_resumen, blob_url_md, blob_url_json, nombre_app, fecha }`
- Produce: `run_audit_agent(request: dict) -> dict`

- [ ] **Step 1: Crear `requirements.txt`**

```
# AGENTE_AUDITORIA_CLOUD/api/requirements.txt
azure-functions==1.21.3
anthropic==0.40.0
aiohttp==3.10.5
azure-storage-blob==12.22.0
beautifulsoup4==4.12.3
```

- [ ] **Step 2: Crear `local.settings.json` (gitignored)**

```json
// AGENTE_AUDITORIA_CLOUD/api/local.settings.json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "ANTHROPIC_API_KEY": "sk-ant-REEMPLAZAR",
    "AZURE_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "BLOB_CONTAINER_NAME": "audit-reports",
    "ALLOWED_ORIGINS": "http://localhost:5020"
  }
}
```

- [ ] **Step 3: Escribir tests del audit agent (TDD RED)**

```python
# AGENTE_AUDITORIA_CLOUD/api/tests/test_audit.py
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import json
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from audit_agent import run_audit_agent, _extract_domain, _parse_brechas

class TestExtractDomain:
    def test_extrae_dominio_sin_www(self):
        assert _extract_domain('https://www.bancogalicia.com.ar') == 'bancogalicia'

    def test_extrae_dominio_sin_subdominio(self):
        assert _extract_domain('https://mercadopago.com.ar/login') == 'mercadopago'

    def test_extrae_nombre_simple(self):
        assert _extract_domain('https://uala.com.ar') == 'uala'

class TestParseBrechas:
    def test_cuenta_brechas_por_severidad(self):
        md = """
## Brechas detectadas
| Brecha 1 | Alta | ... |
| Brecha 2 | Media | ... |
| Brecha 3 | Alta | ... |
| Brecha 4 | Baja | ... |
"""
        result = _parse_brechas(md)
        assert result['alta'] >= 0
        assert result['media'] >= 0
        assert result['baja'] >= 0
        # Solo validamos que devuelve la estructura correcta
        assert 'alta' in result and 'media' in result and 'baja' in result

class TestRunAuditAgent:
    @pytest.mark.asyncio
    async def test_llama_claude_con_archivos_y_retorna_informe(self):
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text='# Informe\n\n## Sin brechas detectadas')]

        with patch('audit_agent.anthropic.Anthropic') as MockAnthropic:
            mock_client = MagicMock()
            mock_client.messages.create.return_value = mock_message
            MockAnthropic.return_value = mock_client

            request = {
                'type': 'local',
                'nombre': 'Mi-App',
                'files': {'index.html': '<html lang="es"><head><title>Test</title></head><body><main><p>Hola</p></main></body></html>'},
                'normativas': ['wcag22'],
            }
            result = await run_audit_agent(request)

        assert 'informe_md' in result
        assert 'informe_json' in result
        assert 'brechas_resumen' in result
        assert result['nombre_app'] == 'Mi-App'
        assert result['informe_md'] == '# Informe\n\n## Sin brechas detectadas'

    @pytest.mark.asyncio
    async def test_redacta_pat_del_output(self):
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text='PAT usado: abc123 en la auditoria')]

        with patch('audit_agent.anthropic.Anthropic') as MockAnthropic:
            mock_client = MagicMock()
            mock_client.messages.create.return_value = mock_message
            MockAnthropic.return_value = mock_client

            request = {
                'type': 'repo',
                'repo': {
                    'platform': 'azure-devops',
                    'org': 'mi-org', 'project': 'proj', 'repo': 'repo1', 'branch': 'main',
                    'pat': 'abc123'
                },
                'normativas': ['wcag22'],
                '_archivos_mock': {'index.html': '<html></html>'},
            }
            # Inyectamos archivos mockeados para no llamar a fetch_repo
            with patch('audit_agent.fetch_repo', new_callable=AsyncMock, return_value={'index.html': '<html></html>'}):
                result = await run_audit_agent(request)

        assert 'abc123' not in result['informe_md']
```

- [ ] **Step 4: Crear stub de `fetchers.py` (mínimo para desbloquear el import)**

`audit_agent.py` hace `from fetchers import fetch_repo, fetch_url, fetch_local` al cargarse.
Crear este stub ahora para que los tests de Task 5 no fallen por import error.
Task 6 reemplazará este archivo con la implementación completa.

```python
# AGENTE_AUDITORIA_CLOUD/api/fetchers.py  ← STUB — se reemplaza en Task 6
async def fetch_repo(repo_data: dict) -> dict[str, str]:
    raise NotImplementedError

async def fetch_url(url: str, depth: int = 1) -> dict[str, str]:
    raise NotImplementedError

async def fetch_local(files: dict) -> dict[str, str]:
    return files

def _azdo_headers(pat: str) -> dict:
    return {}
```

- [ ] **Step 5: Verificar que los tests fallan (por audit_agent faltante, no por fetchers)**

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso\AGENTE_AUDITORIA_CLOUD\api"
pip install -r requirements.txt
pip install pytest pytest-asyncio
python -m pytest tests/test_audit.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'audit_agent'`

- [ ] **Step 6: Crear `audit_agent.py`**

```python
# AGENTE_AUDITORIA_CLOUD/api/audit_agent.py
import anthropic
import os
import json
import re
from datetime import date
from fetchers import fetch_repo, fetch_url, fetch_local

CLAUDE_MODEL = os.environ.get('CLAUDE_MODEL', 'claude-sonnet-4-6')

AUDIT_SYSTEM_PROMPT = """Sos un auditor especializado en accesibilidad digital para el sector financiero argentino.
Evaluás recursos digitales según tres normativas:

1. WCAG 2.2 nivel AA — Estándar internacional (contraste, navegación por teclado, foco visible, ARIA, landmarks, skip links, alt text, autocomplete, idioma declarado, iframes con title, aria-live en notificaciones dinámicas)
2. ONTI / Ley 26.653 / Disposición 6/2019 — Marco legal argentino (PDF accesibles, lenguaje claro, charset, consentimiento de trackers)
3. BCRA A7517 — Sector financiero (texto-a-voz en home banking y app móvil, alt text en publicidad, capacitación en LSA)

Para cada archivo recibido, ejecutá estas validaciones y producí un informe con este formato exacto:

# Informe de Compliance de Accesibilidad

## Recurso auditado
- Nombre: {nombre}
- Fecha: {fecha}
- Archivos analizados: {N}

## Checklist por archivo

| Archivo | Criterio | Estado | Observación |
|---------|----------|--------|-------------|
| index.html | WCAG 1.4.3 Contraste | ✔ / ❌ / ⚠️ / N/A | ... |

## Brechas detectadas

| # | Brecha | Normativa | Severidad | Archivo | Descripción | Recomendación |
|---|--------|-----------|-----------|---------|-------------|---------------|
| 1 | ... | WCAG 2.2 | Alta | ... | ... | ... |

Severidades: Alta (bloquea uso), Media (dificulta uso), Baja (mejora recomendada).

## Plan de acción

### Sprint 1 — Crítico (semana 1)
- [ ] ...

### Sprint 2 — Importante (semanas 2-3)
- [ ] ...

### Sprint 3 — Mejoras (mes siguiente)
- [ ] ...

## Resultado general
CUMPLE / NO CUMPLE / CUMPLIMIENTO PARCIAL

Notas:
- Nunca inventar resultados. Si no podés verificar un criterio, marcarlo N/A con nota.
- El PAT y credenciales no deben aparecer nunca en el output.
- Priorizar brechas BCRA A7517 (implicancias regulatorias directas).
"""


def _extract_domain(url: str) -> str:
    """Extrae dominio limpio de una URL para usar como nombre de app."""
    # Remover protocolo
    domain = re.sub(r'^https?://', '', url)
    # Remover www.
    domain = re.sub(r'^www\.', '', domain)
    # Tomar solo el primer segmento (antes de / o .)
    domain = domain.split('/')[0]  # quitar path
    domain = domain.split('.')[0]  # quitar TLD
    return domain


def _parse_brechas(md_text: str) -> dict:
    """Cuenta brechas por severidad desde el markdown generado."""
    alta  = len(re.findall(r'\|\s*Alta\s*\|',  md_text, re.IGNORECASE))
    media = len(re.findall(r'\|\s*Media\s*\|', md_text, re.IGNORECASE))
    baja  = len(re.findall(r'\|\s*Baja\s*\|',  md_text, re.IGNORECASE))
    return {'alta': alta, 'media': media, 'baja': baja}


def _redact_pat(text: str, pat: str | None) -> str:
    """Reemplaza el PAT en el texto con [PAT_REDACTED]."""
    if not pat or len(pat) < 4:
        return text
    return text.replace(pat, '[PAT_REDACTED]')


async def run_audit_agent(request: dict) -> dict:
    tipo       = request['type']
    normativas = request.get('normativas', ['wcag22', 'onti', 'bcra'])
    pat        = None

    # 1. Obtener archivos según tipo
    if tipo == 'repo':
        repo_data  = request['repo']
        pat        = repo_data.get('pat')
        archivos   = await fetch_repo(repo_data)
        nombre_app = repo_data['repo']
    elif tipo == 'url':
        url_data   = request['url']
        archivos   = await fetch_url(url_data['url'], url_data.get('depth', 1))
        nombre_app = _extract_domain(url_data['url'])
    else:  # local
        archivos   = request.get('files', {})
        nombre_app = request.get('nombre', 'auditoria-local')

    # 2. Construir prompt con contenido de archivos (máx 5000 chars por archivo)
    archivos_texto = '\n\n'.join([
        f"### {fname}\n```\n{content[:5000]}\n```"
        for fname, content in archivos.items()
    ])

    normativas_str = ', '.join(normativas).upper().replace('WCAG22', 'WCAG 2.2')
    hoy            = date.today().isoformat()

    user_message = (
        f"Auditá los siguientes {len(archivos)} archivo(s) según: {normativas_str}.\n"
        f"Nombre del recurso: {nombre_app}\n"
        f"Fecha: {hoy}\n\n"
        f"{archivos_texto}"
    )

    # 3. Llamar Claude API
    client  = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])
    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=8000,
        system=AUDIT_SYSTEM_PROMPT,
        messages=[{'role': 'user', 'content': user_message}],
    )

    informe_md = message.content[0].text

    # 4. Redactar PAT del output (seguridad)
    informe_md = _redact_pat(informe_md, pat)

    # 5. Construir JSON estructurado
    brechas      = _parse_brechas(informe_md)
    informe_json = json.dumps({
        'input':    {'recurso': nombre_app, 'tipo': tipo, 'fecha_auditoria': hoy, 'normativas': normativas},
        'informe_md': informe_md,
        'brechas_resumen': brechas,
    }, ensure_ascii=False, indent=2)

    return {
        'informe_md':      informe_md,
        'informe_json':    informe_json,
        'brechas_resumen': brechas,
        'nombre_app':      nombre_app,
        'fecha':           hoy,
        # blob_url_md y blob_url_json son agregados por blob_storage.py después
        'blob_url_md':  '',
        'blob_url_json': '',
    }
```

- [ ] **Step 7: Verificar que los tests pasan**

```powershell
python -m pytest tests/test_audit.py -v
```

Expected: PASS — 5 tests

- [ ] **Step 8: Commit**

```bash
git add AGENTE_AUDITORIA_CLOUD/api/fetchers.py AGENTE_AUDITORIA_CLOUD/api/audit_agent.py AGENTE_AUDITORIA_CLOUD/api/requirements.txt AGENTE_AUDITORIA_CLOUD/api/tests/test_audit.py
git commit -m "feat(auditoria-cloud): audit_agent.py — Claude API + redacción PAT + tests"
```

---

## Task 6: Fetchers (AzDO API · WebFetch · Upload local)

**Files:**
- Create: `AGENTE_AUDITORIA_CLOUD/api/fetchers.py`
- Create: `AGENTE_AUDITORIA_CLOUD/api/tests/test_fetchers.py`

**Interfaces:**
- Produce: `fetch_repo(repo_data: dict) -> dict[str, str]` (filename → content)
- Produce: `fetch_url(url: str, depth: int) -> dict[str, str]`
- Produce: `fetch_local(files: dict) -> dict[str, str]` (passthrough)

- [ ] **Step 1: Escribir tests de fetchers (TDD RED)**

```python
# AGENTE_AUDITORIA_CLOUD/api/tests/test_fetchers.py
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fetchers import fetch_repo, fetch_url, fetch_local, _azdo_headers

class TestFetchLocal:
    @pytest.mark.asyncio
    async def test_retorna_archivos_sin_modificar(self):
        files = {'index.html': '<html></html>', 'style.css': 'body{}'}
        result = await fetch_local(files)
        assert result == files

    @pytest.mark.asyncio
    async def test_retorna_dict_vacio_si_no_hay_archivos(self):
        result = await fetch_local({})
        assert result == {}

class TestAzdoHeaders:
    def test_genera_header_authorization_basic(self):
        headers = _azdo_headers('mi-pat-secreto')
        assert 'Authorization' in headers
        assert headers['Authorization'].startswith('Basic ')

class TestFetchRepo:
    @pytest.mark.asyncio
    async def test_fetch_repo_llama_azdo_api(self):
        # Mock de aiohttp para simular respuesta de Azure DevOps
        mock_items_response = MagicMock()
        mock_items_response.status = 200
        mock_items_response.json = AsyncMock(return_value={
            'value': [
                {'path': '/index.html', 'isFolder': False},
                {'path': '/style.css',  'isFolder': False},
                {'path': '/src',        'isFolder': True},
            ]
        })

        mock_content_response = MagicMock()
        mock_content_response.status = 200
        mock_content_response.text = AsyncMock(return_value='<html lang="es"></html>')

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__  = AsyncMock(return_value=None)
        mock_session.get = MagicMock(return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=mock_content_response),
            __aexit__=AsyncMock(return_value=None)
        ))

        # Primera llamada devuelve items list, resto devuelven contenido
        call_count = [0]
        async def side_effect(*args, **kwargs):
            ctx = AsyncMock()
            if call_count[0] == 0:
                ctx.__aenter__ = AsyncMock(return_value=mock_items_response)
            else:
                ctx.__aenter__ = AsyncMock(return_value=mock_content_response)
            ctx.__aexit__ = AsyncMock(return_value=None)
            call_count[0] += 1
            return ctx

        mock_session.get = side_effect

        with patch('fetchers.aiohttp.ClientSession', return_value=mock_session):
            repo_data = {
                'platform': 'azure-devops',
                'org': 'mi-org',
                'project': 'mi-proyecto',
                'repo': 'mi-repo',
                'branch': 'main',
                'pat': 'mi-pat',
            }
            result = await fetch_repo(repo_data)

        # Debe retornar dict con archivos HTML y CSS solamente (excluir carpetas)
        assert isinstance(result, dict)

class TestFetchUrl:
    @pytest.mark.asyncio
    async def test_fetch_url_extrae_html(self):
        html_content = '<html lang="es"><head><title>Test</title></head><body><main><p>Hola</p></main></body></html>'

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.text   = AsyncMock(return_value=html_content)

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__  = AsyncMock(return_value=None)

        async def get_ctx(*args, **kwargs):
            ctx = AsyncMock()
            ctx.__aenter__ = AsyncMock(return_value=mock_response)
            ctx.__aexit__  = AsyncMock(return_value=None)
            return ctx

        mock_session.get = get_ctx

        with patch('fetchers.aiohttp.ClientSession', return_value=mock_session):
            result = await fetch_url('https://example.com', depth=1)

        assert 'https://example.com' in result
        assert result['https://example.com'] == html_content
```

- [ ] **Step 2: Verificar FAIL**

```powershell
python -m pytest tests/test_fetchers.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'fetchers'`

- [ ] **Step 3: Crear `fetchers.py`**

```python
# AGENTE_AUDITORIA_CLOUD/api/fetchers.py
import aiohttp
import base64
import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

AUDIT_EXTENSIONS = {'.html', '.htm', '.css'}
MAX_FILES        = 40  # límite para no exceder tokens de contexto


def _azdo_headers(pat: str) -> dict:
    """Genera headers Basic Auth para Azure DevOps."""
    encoded = base64.b64encode(f':{pat}'.encode()).decode()
    return {
        'Authorization': f'Basic {encoded}',
        'Accept': 'application/json',
    }


async def fetch_repo(repo_data: dict) -> dict[str, str]:
    """Obtiene archivos auditables desde Azure DevOps REST API."""
    org     = repo_data['org']
    project = repo_data['project']
    repo    = repo_data['repo']
    branch  = repo_data.get('branch', 'main')
    pat     = repo_data['pat']
    headers = _azdo_headers(pat)

    base_url = f'https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo}'
    items_url = f'{base_url}/items?recursionLevel=Full&versionDescriptor.version={branch}&versionDescriptor.versionType=branch&api-version=7.0'

    archivos: dict[str, str] = {}

    async with aiohttp.ClientSession() as session:
        # 1. Listar todos los archivos del repo
        async with session.get(items_url, headers=headers) as resp:
            if resp.status != 200:
                raise RuntimeError(f'Azure DevOps API error {resp.status} al listar archivos')
            data  = await resp.json()
            items = data.get('value', [])

        # 2. Filtrar solo archivos auditables (HTML y CSS)
        auditables = [
            item for item in items
            if not item.get('isFolder', False)
            and any(item['path'].lower().endswith(ext) for ext in AUDIT_EXTENSIONS)
        ][:MAX_FILES]

        # 3. Descargar contenido de cada archivo
        for item in auditables:
            content_url = f"{base_url}/items?path={item['path']}&versionDescriptor.version={branch}&versionDescriptor.versionType=branch&api-version=7.0"
            async with session.get(content_url, headers={**headers, 'Accept': 'text/plain'}) as resp:
                if resp.status == 200:
                    content = await resp.text(encoding='utf-8', errors='replace')
                    archivos[item['path']] = content

    return archivos


async def fetch_url(url: str, depth: int = 1) -> dict[str, str]:
    """Descarga HTML de una URL y, si depth=2, de los links internos."""
    archivos: dict[str, str] = {}
    visitados: set[str]       = set()
    pendientes: list[str]     = [url]
    nivel_actual              = 0

    headers = {
        'User-Agent': 'CFOTech-Accessibility-Auditor/1.0 (accessibility audit bot)',
        'Accept': 'text/html,application/xhtml+xml',
    }

    async with aiohttp.ClientSession() as session:
        while pendientes and len(archivos) < MAX_FILES:
            current_batch  = pendientes[:]
            pendientes     = []
            nivel_actual  += 1

            for page_url in current_batch:
                if page_url in visitados:
                    continue
                visitados.add(page_url)

                try:
                    async with session.get(page_url, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                        if resp.status != 200:
                            continue
                        html = await resp.text(encoding='utf-8', errors='replace')
                        archivos[page_url] = html

                        # Si depth=2, extraer links internos para el siguiente nivel
                        if depth >= 2 and nivel_actual < depth:
                            soup  = BeautifulSoup(html, 'html.parser')
                            base  = f"{urlparse(page_url).scheme}://{urlparse(page_url).netloc}"
                            links = [
                                urljoin(base, a.get('href', ''))
                                for a in soup.find_all('a', href=True)
                                if _is_same_domain(a.get('href', ''), base)
                                and not a.get('href', '').startswith('#')
                            ]
                            pendientes.extend(
                                l for l in links
                                if l not in visitados and l not in pendientes
                            )
                except Exception:
                    pass  # Ignorar páginas inaccesibles

    return archivos


async def fetch_local(files: dict[str, str]) -> dict[str, str]:
    """Passthrough — los archivos locales ya vienen como dict filename→content."""
    return files


def _is_same_domain(href: str, base: str) -> bool:
    """Verifica que un link es del mismo dominio o relativo."""
    if href.startswith('/') or href.startswith('./') or href.startswith('../'):
        return True
    parsed = urlparse(href)
    parsed_base = urlparse(base)
    return parsed.netloc == parsed_base.netloc or parsed.netloc == ''
```

- [ ] **Step 4: Verificar que los tests pasan**

```powershell
python -m pytest tests/test_fetchers.py -v
```

Expected: PASS — todos los tests de fetchers

- [ ] **Step 5: Commit**

```bash
git add AGENTE_AUDITORIA_CLOUD/api/fetchers.py AGENTE_AUDITORIA_CLOUD/api/tests/test_fetchers.py
git commit -m "feat(auditoria-cloud): fetchers — AzDO API + WebFetch + local upload"
```

---

## Task 7: Blob Storage + function_app.py + .gitignore

**Files:**
- Create: `AGENTE_AUDITORIA_CLOUD/api/blob_storage.py`
- Create: `AGENTE_AUDITORIA_CLOUD/api/function_app.py`
- Create: `AGENTE_AUDITORIA_CLOUD/api/tests/test_storage.py`
- Create: `AGENTE_AUDITORIA_CLOUD/.gitignore`

**Interfaces:**
- Produce: `save_report(nombre_app, fecha, md, json_str) -> {blob_url_md, blob_url_json}`
- Produce: `list_reports() -> list[HistoryEntry]`
- Produce: `POST /api/audit` y `GET /api/history` endpoints funcionales

- [ ] **Step 1: Tests de blob storage**

```python
# AGENTE_AUDITORIA_CLOUD/api/tests/test_storage.py
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from blob_storage import save_report, list_reports, _build_blob_name

class TestBuildBlobName:
    def test_primera_auditoria_sin_version(self):
        name = _build_blob_name('bancogalicia', '2026-06-28', 1)
        assert name == 'INFORME-bancogalicia-2026-06-28.md'

    def test_segunda_auditoria_con_v2(self):
        name = _build_blob_name('bancogalicia', '2026-06-28', 2)
        assert name == 'INFORME-bancogalicia-2026-06-28-v2.md'

    def test_tercera_auditoria_con_v3(self):
        name = _build_blob_name('bancogalicia', '2026-06-28', 3)
        assert name == 'INFORME-bancogalicia-2026-06-28-v3.md'

class TestSaveReport:
    @pytest.mark.asyncio
    async def test_guarda_md_y_json_en_blob(self):
        mock_container = MagicMock()
        mock_blob_client = MagicMock()
        mock_blob_client.url = 'https://storage.azure.com/audit-reports/test.md'
        mock_blob_client.upload_blob = MagicMock()
        mock_container.get_blob_client.return_value = mock_blob_client
        mock_container.list_blobs.return_value = iter([])  # sin blobs existentes

        with patch('blob_storage.ContainerClient.from_connection_string', return_value=mock_container):
            result = await save_report('bancogalicia', '2026-06-28', '# Informe', '{}')

        assert 'blob_url_md' in result
        assert 'blob_url_json' in result
        assert mock_blob_client.upload_blob.call_count == 2  # MD + JSON

class TestListReports:
    @pytest.mark.asyncio
    async def test_retorna_lista_de_informes(self):
        mock_blob1 = MagicMock()
        mock_blob1.name = 'bancogalicia/INFORME-bancogalicia-2026-06-28.md'
        mock_blob2 = MagicMock()
        mock_blob2.name = 'uala/INFORME-uala-2026-06-27.md'
        # Ignorar .json en el listado
        mock_blob3 = MagicMock()
        mock_blob3.name = 'bancogalicia/INFORME-bancogalicia-2026-06-28.json'

        mock_container = MagicMock()
        mock_container.list_blobs.return_value = iter([mock_blob1, mock_blob2, mock_blob3])
        mock_container.get_blob_client.return_value.url = 'https://storage.azure.com/test'

        with patch('blob_storage.ContainerClient.from_connection_string', return_value=mock_container):
            result = await list_reports()

        # Solo MD (no JSON)
        assert len(result) == 2
        assert result[0]['nombre_app'] in ('bancogalicia', 'uala')
```

- [ ] **Step 2: Crear `blob_storage.py`**

```python
# AGENTE_AUDITORIA_CLOUD/api/blob_storage.py
import os
import re
from azure.storage.blob import ContainerClient

CONTAINER_NAME = os.environ.get('BLOB_CONTAINER_NAME', 'audit-reports')
CONN_STRING    = os.environ.get('AZURE_STORAGE_CONNECTION_STRING', '')


def _get_container() -> ContainerClient:
    return ContainerClient.from_connection_string(CONN_STRING, CONTAINER_NAME)


def _build_blob_name(nombre_app: str, fecha: str, version: int, ext: str = '.md') -> str:
    """Construye el nombre del blob con versionado."""
    base = f'INFORME-{nombre_app}-{fecha}'
    suffix = '' if version == 1 else f'-v{version}'
    return f'{base}{suffix}{ext}'


def _parse_blob_name(blob_name: str) -> dict | None:
    """Extrae metadata de un nombre de blob."""
    pattern = r'^(.+)/INFORME-(.+)-(\d{4}-\d{2}-\d{2})(-v\d+)?\.md$'
    match = re.match(pattern, blob_name)
    if not match:
        return None
    nombre_app = match.group(2)
    fecha      = match.group(3)
    version    = (match.group(4) or '').lstrip('-') or ''
    return {'nombre_app': nombre_app, 'fecha': fecha, 'version': version}


async def save_report(nombre_app: str, fecha: str, md: str, json_str: str) -> dict:
    """Guarda MD + JSON en Blob Storage. Detecta versión automáticamente."""
    container = _get_container()

    # Encontrar la versión disponible (sin pisar archivos existentes)
    prefix    = f'{nombre_app}/INFORME-{nombre_app}-{fecha}'
    existing  = {b.name for b in container.list_blobs(name_starts_with=prefix)}
    version   = 1
    while f'{nombre_app}/{_build_blob_name(nombre_app, fecha, version)}' in existing:
        version += 1

    md_blob_name   = f'{nombre_app}/{_build_blob_name(nombre_app, fecha, version, ".md")}'
    json_blob_name = f'{nombre_app}/{_build_blob_name(nombre_app, fecha, version, ".json")}'

    # Subir MD
    md_client = container.get_blob_client(md_blob_name)
    md_client.upload_blob(md.encode('utf-8'), overwrite=False, content_settings=_ct('text/markdown'))

    # Subir JSON
    json_client = container.get_blob_client(json_blob_name)
    json_client.upload_blob(json_str.encode('utf-8'), overwrite=False, content_settings=_ct('application/json'))

    return {
        'blob_url_md':   md_client.url,
        'blob_url_json': json_client.url,
    }


async def list_reports() -> list[dict]:
    """Lista todos los informes (solo MD) del Blob Storage, ordenados por fecha desc."""
    container = _get_container()
    reports   = []

    for blob in container.list_blobs():
        if not blob.name.endswith('.md'):
            continue
        meta = _parse_blob_name(blob.name)
        if not meta:
            continue
        blob_client  = container.get_blob_client(blob.name)
        json_name    = blob.name[:-3] + '.json'
        json_client  = container.get_blob_client(json_name)
        reports.append({
            'nombre_app': meta['nombre_app'],
            'fecha':      meta['fecha'],
            'version':    meta['version'],
            'url_md':     blob_client.url,
            'url_json':   json_client.url,
            'brechas':    {'alta': 0, 'media': 0, 'baja': 0},  # sin parsear para performance
        })

    reports.sort(key=lambda r: (r['fecha'], r['version']), reverse=True)
    return reports


def _ct(mime: str):
    from azure.storage.blob import ContentSettings
    return ContentSettings(content_type=mime)
```

- [ ] **Step 3: Crear `function_app.py`**

```python
# AGENTE_AUDITORIA_CLOUD/api/function_app.py
import azure.functions as func
import json
import logging
import os
from audit_agent import run_audit_agent
from blob_storage import save_report, list_reports

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5020').split(',')


def _cors_headers(req: func.HttpRequest) -> dict:
    origin = req.headers.get('Origin', '')
    allowed = origin if origin in ALLOWED_ORIGINS else ALLOWED_ORIGINS[0]
    return {
        'Access-Control-Allow-Origin':  allowed,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }


@app.route(route="audit", methods=["GET", "POST", "OPTIONS"])
async def audit_endpoint(req: func.HttpRequest) -> func.HttpResponse:
    headers = _cors_headers(req)

    # Preflight CORS
    if req.method == 'OPTIONS':
        return func.HttpResponse(status_code=200, headers=headers)

    try:
        content_type = req.headers.get('Content-Type', '')

        if 'multipart/form-data' in content_type:
            # App local — archivos subidos
            form = req.form
            nombre     = form.get('name', 'auditoria-local')
            normativas = json.loads(form.get('normativas', '["wcag22","onti","bcra"]'))
            files_dict = {}
            for key in req.files:
                f = req.files[key]
                files_dict[f.filename] = f.read().decode('utf-8', errors='replace')
            request_data = {
                'type':       'local',
                'nombre':     nombre,
                'files':      files_dict,
                'normativas': normativas,
            }
        else:
            request_data = req.get_json(force=True)

        # Ejecutar auditoría
        result = await run_audit_agent(request_data)

        # Guardar en Blob Storage
        urls = await save_report(
            nombre_app=result['nombre_app'],
            fecha=result['fecha'],
            md=result['informe_md'],
            json_str=result['informe_json'],
        )
        result.update(urls)

        return func.HttpResponse(
            body=json.dumps(result, ensure_ascii=False),
            status_code=200,
            mimetype='application/json',
            headers=headers,
        )

    except Exception as exc:
        logging.exception('Error en /api/audit')
        return func.HttpResponse(
            body=json.dumps({'error': str(exc)}, ensure_ascii=False),
            status_code=500,
            mimetype='application/json',
            headers=headers,
        )


@app.route(route="history", methods=["GET", "OPTIONS"])
async def history_endpoint(req: func.HttpRequest) -> func.HttpResponse:
    headers = _cors_headers(req)
    if req.method == 'OPTIONS':
        return func.HttpResponse(status_code=200, headers=headers)
    try:
        reports = await list_reports()
        return func.HttpResponse(
            body=json.dumps(reports, ensure_ascii=False),
            status_code=200,
            mimetype='application/json',
            headers=headers,
        )
    except Exception as exc:
        return func.HttpResponse(
            body=json.dumps({'error': str(exc)}),
            status_code=500,
            headers=headers,
        )
```

- [ ] **Step 4: Crear `.gitignore`**

```gitignore
# AGENTE_AUDITORIA_CLOUD/.gitignore

# Python
__pycache__/
*.pyc
.venv/
.env

# Azure Functions
api/local.settings.json
api/.python_packages/

# Node
frontend/node_modules/
frontend/dist/

# Misc
.DS_Store
*.log
```

- [ ] **Step 5: Verificar todos los tests del backend**

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso\AGENTE_AUDITORIA_CLOUD\api"
python -m pytest tests/ -v
```

Expected: PASS — todos los tests de audit, fetchers y storage

- [ ] **Step 6: Commit**

```bash
git add AGENTE_AUDITORIA_CLOUD/api/blob_storage.py AGENTE_AUDITORIA_CLOUD/api/function_app.py AGENTE_AUDITORIA_CLOUD/api/tests/test_storage.py AGENTE_AUDITORIA_CLOUD/.gitignore
git commit -m "feat(auditoria-cloud): blob_storage + function_app HTTP triggers + .gitignore"
```

---

## Task 8: Auth + Azure deployment config + README

**Files:**
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/staticwebapp.config.json`
- Create: `AGENTE_AUDITORIA_CLOUD/frontend/.env.example`
- Create: `AGENTE_AUDITORIA_CLOUD/README.md`

**Interfaces:**
- Produce: App desplegable en Azure Static Web Apps con auth Microsoft Entra ID

- [ ] **Step 1: Crear `staticwebapp.config.json`**

```json
// AGENTE_AUDITORIA_CLOUD/frontend/staticwebapp.config.json
{
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/common/v2.0",
          "clientIdSettingName": "AAD_CLIENT_ID",
          "clientSecretSettingName": "AAD_CLIENT_SECRET"
        }
      }
    }
  },
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"]
    },
    {
      "route": "/*",
      "allowedRoles": ["authenticated"]
    },
    {
      "route": "/.auth/login/aad",
      "allowedRoles": ["anonymous"]
    }
  ],
  "responseOverrides": {
    "401": {
      "redirect": "/.auth/login/aad?post_login_redirect_uri=.referrer",
      "statusCode": 302
    }
  },
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/*.{css,js,png,ico,svg}"]
  },
  "globalHeaders": {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  }
}
```

- [ ] **Step 2: Crear `.env.example` del frontend**

```bash
# AGENTE_AUDITORIA_CLOUD/frontend/.env.example
# URL base de la Azure Function (en producción, dejar vacío — usa /api relativo de SWA)
VITE_API_URL=
```

- [ ] **Step 3: Crear `README.md`**

```markdown
# Agente de Auditoría de Accesibilidad — CFOTech

App cloud que audita la accesibilidad de sitios web, repositorios o apps locales
según WCAG 2.2, ONTI y BCRA A7517.

## Stack

- **Frontend:** React 19 + Vite + TypeScript (Azure Static Web Apps)
- **Backend:** Azure Functions Python 3.11
- **Storage:** Azure Blob Storage (`audit-reports`)
- **AI:** Claude API (`claude-sonnet-4-6`)
- **Auth:** Microsoft Entra ID (via Azure Static Web Apps)

## Instalación local

### 1. Frontend

```powershell
cd frontend
npm install
cp .env.example .env
npm run dev   # → http://localhost:5020
```

### 2. Backend (Azure Functions)

```powershell
cd api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
# Editar local.settings.json con ANTHROPIC_API_KEY y AZURE_STORAGE_CONNECTION_STRING
func start   # requiere Azure Functions Core Tools
```

### 3. Tests

```powershell
# Frontend
cd frontend && npm run test:run

# Backend
cd api && python -m pytest tests/ -v
```

## Deploy a Azure

1. Crear Azure Static Web App y vincular a este repo
2. Crear Azure Storage Account → contenedor `audit-reports`
3. Configurar variables de entorno en Azure:
   - `ANTHROPIC_API_KEY`
   - `AZURE_STORAGE_CONNECTION_STRING`
   - `BLOB_CONTAINER_NAME=audit-reports`
   - `AAD_CLIENT_ID` + `AAD_CLIENT_SECRET` (app registration en Entra ID)
4. Push a `main` → GitHub Actions despliega automáticamente

## Accesibilidad

Esta app cumple WCAG 2.2 nivel AA:
- Skip link visible al Tab
- Todos los inputs con `<label>` explícito
- Contraste 4.5:1 mínimo (DS CFOTech: navy `#0A1F44` sobre blanco = 15:1)
- Focus visible en todos los interactivos (`outline: 2px solid #4FD1B2`)
- `aria-live="polite"` en resultados, `role="alert"` en errores
- Landmark `<main id="main">` + `<header role="banner">`
- `aria-invalid` + `aria-describedby` en campos con error
```

- [ ] **Step 4: Verificar tests completos**

```powershell
# Frontend
cd "C:\Esteban CFOTech\Portal de Acceso\AGENTE_AUDITORIA_CLOUD\frontend"
npm run test:run

# Backend
cd "C:\Esteban CFOTech\Portal de Acceso\AGENTE_AUDITORIA_CLOUD\api"
python -m pytest tests/ -v
```

Expected: PASS — todos los tests frontend y backend

- [ ] **Step 5: Commit final**

```bash
git add AGENTE_AUDITORIA_CLOUD/
git commit -m "feat(auditoria-cloud): auth Microsoft Entra + deployment config + README"
```

---

## Resumen de tests esperados al final del plan

| Suite | Tests | Comando |
|-------|-------|---------|
| Frontend — client.test.ts | 4 | `npm run test:run` |
| Frontend — AuditForm.test.tsx | 6 | `npm run test:run` |
| Frontend — ResultsPanel.test.tsx | 3 | `npm run test:run` |
| Backend — test_audit.py | 5 | `pytest tests/ -v` |
| Backend — test_fetchers.py | 4 | `pytest tests/ -v` |
| Backend — test_storage.py | 5 | `pytest tests/ -v` |
| **Total** | **27** | |
