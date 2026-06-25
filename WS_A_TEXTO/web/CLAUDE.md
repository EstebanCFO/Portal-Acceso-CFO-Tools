# CLAUDE.md — WA a Texto CFOTech

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
C:\Esteban CFOTech\Portal de Acceso\WS_A_TEXTO\   ← dentro del repo del portal
└── web\
    ├── CLAUDE.md                    ← este archivo
    ├── PORTAL_INTEGRATION.md        ← integración ya aplicada en el portal
    ├── backend\
    │   ├── app.py                   ← servidor standalone en :5008 (para dev sin portal)
    │   └── router.py                ← router FastAPI montado INLINE en el gateway
    └── frontend\
        ├── package.json
        ├── vite.config.ts           ← port 5009, base /apps/sound-catch/, proxy /api/sound-catch → :5008
        ├── tsconfig.*.json
        ├── index.html               ← title: "WA a Texto — Transcripción de Audio"
        └── src\
            ├── main.tsx
            ├── App.tsx              ← IN_PORTAL detection + transcripción + resumen
            ├── index.css            ← variables DS + clases de WA a Texto
            ├── types.ts             ← Transcript, Segment, TranscribeOptions, ProgressEvent
            ├── api\
            │   └── client.ts        ← wrappers: apiFetchInfo, apiHealth, apiTranscribeStream,
            │                           apiSummarizeStream, formatDuration, transcriptToSrt
            ├── components\
            │   ├── Header.tsx       ← logo WA, "WA a Texto" — return null cuando IN_PORTAL=true
            │   └── ...
            └── __tests__\
                ├── setup.ts         ← fetch mock global
                └── client.test.ts   ← 11 tests: URLs /api/sound-catch/, formatDuration, transcriptToSrt
```

---

## Arquitectura de integración con el portal

WA a Texto usa un patrón **diferente** al resto de apps:

| Componente | Patrón |
|------------|--------|
| Backend (prod) | Router FastAPI montado **inline** en `portal_server.py` — `app.include_router(router, prefix='/api/sound-catch/api')` |
| Backend (dev standalone) | `python app.py` en `:5008` |
| Frontend (prod) | `dist/` servido por el gateway en `/apps/sound-catch/` |
| Frontend (dev) | `npm run dev` → Vite en `:5009` con `base: '/apps/sound-catch/'` |

El gateway proxea `/apps/sound-catch/` al Vite dev en `:5009` cuando no hay `dist/`.

> **Por qué inline:** El backend es Python/FastAPI puro — importable como módulo. Elimina un subprocess y un puerto extra.

---

## Cómo levantar

### Modo producción (recomendado — via portal)

```powershell
# Construir frontend (una vez o al actualizar)
cd "C:\Esteban CFOTech\Portal de Acceso\WS_A_TEXTO\web\frontend"
npm run build

# Levantar el gateway (sirve todo: portal + WA a Texto + otras apps)
cd "C:\Esteban CFOTech\Portal de Acceso"
python portal_server.py
# → http://localhost:5174/apps/sound-catch/
```

### Modo dev standalone (sin portal)

```powershell
# Backend
cd "C:\Esteban CFOTech\Portal de Acceso\WS_A_TEXTO\web\backend"
pip install -r requirements.txt   # solo la primera vez
python app.py
# → API en http://localhost:5008

# Frontend (otra terminal)
cd "C:\Esteban CFOTech\Portal de Acceso\WS_A_TEXTO\web\frontend"
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

## Variables de entorno

### Backend (`web/backend/.env`)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | API key de Anthropic para Resumen Ejecutivo | `` (requerido para resumen) |
| `SC_MODEL` | Modelo Whisper | `base` |
| `SC_LANGUAGE` | Idioma por defecto | `` (auto-detect) |
| `SC_MIN_CONFIDENCE` | Confianza mínima de segmentos | `0.0` |
| `SC_SUMMARY_MODEL` | Modelo Claude para resumen | `claude-haiku-4-5-20251001` |

### Frontend (`web/frontend/.env`)

| Variable | Descripción | Default en código |
|----------|-------------|-------------------|
| `VITE_API_URL` | URL del backend | `''` (vacío → usa `/api/sound-catch` via `\|\|`) |

> Dejar `VITE_API_URL=` vacío en `.env` es correcto — el fallback `|| '/api/sound-catch'` toma efecto.
> **Bug conocido:** Si se usara `??` en lugar de `||`, el string vacío no haría fallback.

---

## Integración con el portal

### IN_PORTAL detection y header

```typescript
// Header.tsx — módulo-level
const IN_PORTAL = window.self !== window.top

export function Header() {
  // Dentro del portal: el portal ya tiene "← Volver" en su header — no duplicar.
  if (IN_PORTAL) return null

  function handleSalir() { window.close() }

  return (
    <header className="sc-header">
      <div className="sc-logo">WA</div>
      <span className="sc-header__name">WA a Texto</span>
      <button className="sc-btn-salir" onClick={handleSalir}>Salir</button>
    </header>
  )
}
```

- `IN_PORTAL = true` → Header retorna `null`. El portal provee su header con "← Volver".
- `IN_PORTAL = false` → Header completo con logo `WA`, nombre `WA a Texto` y botón "Salir".

### Registry entry (estado actual en `src/registry/apps.ts`)

```typescript
{
  id:       'sound-catch',      // gateway URL: /apps/sound-catch/ (no cambió)
  name:     'WA a Texto',
  url:      '/apps/sound-catch/',
  category: '',                 // sin categoría
  tags:     ['Audio', 'IA', 'Transcripcion', 'WhatsApp'],
  iconBg:   '#E6FAF5',
  iconColor:'#00A878',
}
```

---

## Tests

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso\WS_A_TEXTO\web\frontend"
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
El acento de WA a Texto usa `--green` (`#00A878`) — coherente con el `iconBg: '#E6FAF5'` del registry.

---

## Decisiones técnicas

| Decisión | Razón |
|----------|-------|
| Backend inline (no subprocess) | FastAPI importable como módulo — elimina un proceso y un puerto, arranque inmediato |
| SSE para transcripción | Whisper puede tardar minutos — el usuario ve progreso en tiempo real |
| SSE para resumen Claude | Claude puede generar texto largo — se muestra mientras llega |
| `\|\|` en lugar de `??` para VITE_API_URL | `.env` vacío produce `""` → `??` no hace fallback; `\|\|` sí |
| `base: '/apps/sound-catch/'` en Vite | Necesario para que el gateway sirva assets con el prefijo correcto |
| `IN_PORTAL → return null` en Header | El portal ya provee header con "← Volver" — no duplicar navegación |
| `category: ''` en registry | App transversal, no encaja en una categoría fija |

---

## Historial de versiones

| Fecha | Cambio |
|-------|--------|
| 2026-06-19 | v1: Integrado en portal. Backend FastAPI/Whisper montado inline en gateway. Frontend React 19 + Vite :5009. SSE streaming para transcripción y resumen Claude. Fix `??` → `\|\|` en client.ts. Tests: 11/11. |
| 2026-06-25 | **Rename:** Carpeta `Sound Catch` (repo separado) → `WS_A_TEXTO` (dentro del repo del portal). App ID mantiene `sound-catch` para no romper la URL del gateway. |
| 2026-06-25 | **WA a Texto:** nombre en registry `'WS a Texto'` → `'WA a Texto'`. Logo `WS` → `WA`. Título HTML actualizado. `category: ''` (sin categoría). |
| 2026-06-25 | **Header fix:** `IN_PORTAL=true` → `return null` (antes mostraba botón "Salir" en portal, ahora el portal provee "← Volver"). Standalone: header completo con "Salir" que hace `window.close()`. |
