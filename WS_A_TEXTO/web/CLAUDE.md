# CLAUDE.md — Sound Catch CFOTech

Guía de contexto para futuras sesiones de Claude Code en este proyecto.

---

## ¿Qué es este proyecto?

App de **transcripción de audio con IA** (Whisper). El usuario sube un archivo de audio en cualquier formato (WAV, OGG, MP3, WhatsApp PTT, etc.) → el backend transcribe con Whisper → el frontend muestra el texto segmentado con timestamps, opción de exportar a SRT, y resumen ejecutivo generado por Claude.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | **React 19** + **Vite 8** + TypeScript strict — base `/apps/sound-catch/`, puerto dev **:5009** |
| Backend API | **FastAPI** + **Whisper** (Python) |
| Transcripción | OpenAI Whisper (modelo configurable: `tiny`, `base`, `small`, etc.) |
| Resumen | Anthropic Claude API (`claude-sonnet-4-6`) via SSE streaming |
| Streaming | SSE (Server-Sent Events) para progreso de transcripción y chunks de resumen |
| Tests | Vitest 4.x |
| Runtime | Windows 11 / Python 3.9+ · Node.js 18+ |

> **Sin base de datos.** El backend procesa en memoria y devuelve el resultado al frontend.

---

## Ubicación

```
C:\Esteban CFOTech\Sound Catch\      ← repo separado (fuera del portal git)
└── web\
    ├── CLAUDE.md                    ← este archivo
    ├── PORTAL_INTEGRATION.md        ← instrucciones para integrar en el portal
    ├── backend\
    │   ├── app.py                   ← servidor standalone en :5008 (para dev sin portal)
    │   └── router.py                ← router FastAPI montado INLINE en el gateway
    └── frontend\
        ├── package.json
        ├── vite.config.ts           ← port 5009, base /apps/sound-catch/, proxy /api/sound-catch → :5008
        ├── tsconfig.*.json
        ├── index.html
        └── src\
            ├── main.tsx
            ├── App.tsx              ← IN_PORTAL detection + tabs (transcribir / exportar)
            ├── index.css            ← variables DS + clases de Sound Catch
            ├── types.ts             ← Transcript, Segment, TranscribeOptions, ProgressEvent
            ├── api\
            │   └── client.ts        ← wrappers: apiFetchInfo, apiHealth, apiTranscribeStream,
            │                           apiSummarizeStream, formatDuration, transcriptToSrt
            └── __tests__\
                ├── setup.ts         ← fetch mock global
                └── client.test.ts   ← 11 tests: URLs /api/sound-catch/, formatDuration, transcriptToSrt
```

---

## Arquitectura de integración con el portal

Sound Catch usa un patrón **diferente** al resto de apps:

| Componente | Patrón |
|------------|--------|
| Backend (prod) | Router FastAPI montado **inline** en `portal_server.py` — `app.include_router(router, prefix='/api/sound-catch/api')` |
| Backend (dev standalone) | `python app.py` en `:5008` |
| Frontend (prod) | `dist/` servido por el gateway en `/apps/sound-catch/` |
| Frontend (dev) | `npm run dev` → Vite en `:5009` con `base: '/apps/sound-catch/'` |

El gateway proxea `/apps/sound-catch/` al Vite dev en `:5009` cuando no hay `dist/`.

> **Por qué inline:** El backend es Python/FastAPI puro — importable como módulo. Elimina un subprocess y un puerto extra. El gateway lo importa con `from web.backend.router import router` (ruta relativa desde `APPS_ROOT`).

---

## Cómo levantar

### Modo producción (recomendado — via portal)

```powershell
# Construir frontend (una vez o al actualizar)
cd "C:\Esteban CFOTech\Sound Catch\web\frontend"
npm run build

# Levantar el gateway (sirve todo: portal + sound catch + otras apps)
cd "C:\Esteban CFOTech\Portal de Acceso"
python portal_server.py
# → http://localhost:5174/apps/sound-catch/
```

### Modo dev standalone (sin portal)

```powershell
# Backend
cd "C:\Esteban CFOTech\Sound Catch\web\backend"
pip install -r requirements.txt   # solo la primera vez
python app.py
# → API en http://localhost:5008

# Frontend (otra terminal)
cd "C:\Esteban CFOTech\Sound Catch\web\frontend"
npm install    # solo la primera vez
npm run dev
# → UI en http://localhost:5009/apps/sound-catch/
# Vite proxea /api/sound-catch/ → http://localhost:5008
```

---

## Endpoints API

El prefijo base en producción es `/api/sound-catch/api/` (montado inline en el gateway).
En dev standalone con Vite proxy: misma ruta (proxy reescribe `/api/sound-catch` → `:5008`).

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check — `{ status: 'ok', model: 'base' }` |
| GET | `/api/info` | Formatos soportados, modelos disponibles, modelo/idioma por defecto |
| POST | `/api/transcribe/stream` | Transcripción SSE — form: `file`, `lang`, `model`, `min_confidence`, `diarize` |
| POST | `/api/summarize/stream` | Resumen Claude SSE — body JSON: `{ text, language }` |

---

## Cliente TypeScript (`src/api/client.ts`)

```typescript
// Prefijo unificado — IMPORTANTE: usar || no ?? (VITE_API_URL="" con ?? no hace fallback)
const API = import.meta.env.VITE_API_URL || '/api/sound-catch'

// Llamada real: fetch(`${API}/api/health`) = fetch('/api/sound-catch/api/health')
```

### Exports principales

| Función | Descripción |
|---------|-------------|
| `apiFetchInfo()` | Info del servidor: formatos, modelos, defaults |
| `apiHealth()` | Health check → boolean |
| `apiTranscribeStream(file, opts, onEvent)` | Transcripción con progreso SSE → `Transcript` |
| `apiSummarizeStream(text, lang, onChunk)` | Resumen Claude con streaming → void |
| `formatDuration(seconds)` | `45` → `'45s'`, `90` → `'1m 30s'` |
| `transcriptToSrt(transcript)` | Convierte segmentos al formato SRT estándar |
| `downloadText(content, filename, mime)` | Descarga un string como archivo |

---

## Tipos TypeScript (`src/types.ts`)

```typescript
interface Segment {
  start: number; end: number; text: string
  confidence: number; speaker: string | null
}

interface Transcript {
  language: string; language_probability: number
  duration: number; word_count: number; avg_confidence: number
  text: string; segments: Segment[]
}

interface TranscribeOptions {
  lang: string; model: string; minConfidence: number; diarize: boolean
}

// ProgressEvent.type: 'info' | 'progress' | 'done' | 'error'
interface ProgressEvent {
  type: string; message?: string; transcript?: Transcript; progress?: number
}
```

---

## Variables de entorno (frontend)

| Variable | Descripción | Default en código |
|----------|-------------|-------------------|
| `VITE_API_URL` | URL del backend de Sound Catch | `''` (vacío → usa `/api/sound-catch` via `\|\|`) |

> Dejar `VITE_API_URL=` vacío en `.env` es correcto — el fallback `|| '/api/sound-catch'` toma efecto.
> **Bug conocido:** Si se usara `??` en lugar de `||`, el string vacío no haría fallback (??  solo cubre `null`/`undefined`).

---

## Integración con el portal

### IN_PORTAL detection

```typescript
// App.tsx — módulo-level
const IN_PORTAL = window.self !== window.top
```

- `IN_PORTAL = true` → Header propio no se renderiza.
- `IN_PORTAL = false` → Header completo con logo CFO y botón Salir.

### Salir / postMessage

```typescript
const portalUrl = import.meta.env.VITE_PORTAL_URL ?? 'http://localhost:5174'
window.parent.postMessage(
  { type: 'portal:goHome', appId: 'sound-catch' },
  portalUrl,
)
```

---

## Tests

```powershell
cd "C:\Esteban CFOTech\Sound Catch\web\frontend"
npm run test        # watch mode
# o
npx vitest run      # una pasada
```

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `client.test.ts` | 11 | URLs `/api/sound-catch/api/…`, bug `??` vs `\|\|`, `formatDuration`, `transcriptToSrt` |

---

## Design System

Ver `C:\Esteban CFOTech\Portal de Acceso\DESIGN_SYSTEM.md` para tokens canónicos.

Los tokens DS están en `src/index.css` como variables CSS (`--navy`, `--green-a`, etc.).
El acento de Sound Catch usa `--green` (`#00A878`) — coherente con el iconBg `#E6FAF5` del registry.

---

## Decisiones técnicas

| Decisión | Razón |
|----------|-------|
| Backend inline (no subprocess) | FastAPI importable como módulo — elimina un proceso y un puerto, arranque inmediato |
| SSE para transcripción | Whisper puede tardar minutos — el usuario ve progreso en tiempo real |
| SSE para resumen Claude | Claude puede generar texto largo — se muestra mientras llega |
| `\|\|` en lugar de `??` para VITE_API_URL | `.env` vacío produce `""` → `??` no hace fallback; `\|\|` sí |
| `base: '/apps/sound-catch/'` en Vite | Necesario para que el gateway sirva assets con el prefijo correcto |

---

## Historial de versiones

| Fecha | Cambio |
|-------|--------|
| 2026-06-19 | v1: Sound Catch integrado en portal. Backend FastAPI/Whisper montado inline en gateway. Frontend React 19 + Vite :5009. SSE streaming para transcripción y resumen Claude. Fix `??` → `\|\|` en client.ts. Tests: 11/11. |
