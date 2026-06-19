# CLAUDE.md — Survey Analytics CFOTech

Guía de contexto para futuras sesiones de Claude Code en este proyecto.

---

## ¿Qué es este proyecto?

App web que conecta con la cuenta de **SurveyMonkey** del equipo CFOTech y muestra
analytics de feedback de clientes y proyectos.

**Flujo principal:**
1. El usuario abre la app desde el portal (o directamente en `:5176`).
2. La app lista todos los surveys de la cuenta SurveyMonkey (via API).
3. El usuario hace click en un survey para ver analytics por pregunta.
4. Para cada pregunta con opciones se muestra un BarChart horizontal con % de respuestas.
5. Para preguntas abiertas se informa el count de respuestas (el texto detallado se ve en SM).

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | **React 19** + **Vite 8** + TypeScript strict · CSS plano DS — puerto **:5176** |
| Backend API | **ASP.NET Core 8** (C#) — puerto **:5055** |
| Datos | API de SurveyMonkey v3 (Bearer token) |
| Charts | recharts — BarChart horizontal por pregunta |
| Tests | Vitest 4.x + @testing-library/react |
| Runtime | Windows 11 / PowerShell |

> Sin base de datos propia — todos los datos vienen de SurveyMonkey en tiempo real.

---

## Estructura de archivos

```
SURVEY\
├── CLAUDE.md                          ← este archivo
├── START.bat                          ← lanza backend (:5055) + frontend (:5176)
├── STOP.bat                           ← mata procesos en :5055 y :5176
│
├── SurveyApp.Web\                     ── ASP.NET Core 8 API (:5055) ─────────────
│   ├── SurveyApp.Web.csproj
│   ├── Program.cs                     ← HttpClient, CORS, camelCase JSON
│   ├── appsettings.json               ← SurveyMonkey:AccessToken + Urls: :5055
│   ├── .gitignore                     ← bin/, obj/, appsettings.Development.json
│   ├── Controllers\
│   │   ├── HealthController.cs        ← GET /api/health
│   │   └── SurveysController.cs      ← GET /api/surveys, /{id}, /{id}/analytics, POST /api/shutdown
│   ├── Models\
│   │   ├── SmModels.cs               ← DTOs SM API (snake_case JSON)
│   │   └── AppModels.cs              ← DTOs propios (camelCase al frontend)
│   └── Services\
│       └── SurveyMonkeyService.cs    ← HttpClient tipado, llamadas a SM API v3
│
└── survey-frontend\                   ── React 19 + Vite :5176 ──────────────────
    ├── package.json
    ├── vite.config.ts                 ← port 5176, proxy /api → :5055
    ├── vitest.config.ts
    ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
    ├── index.html
    └── src\
        ├── main.tsx
        ├── App.tsx                    ← IN_PORTAL + handleSalir + BrowserRouter + Routes
        ├── index.css                  ← variables DS + clases de Survey (.sv-*)
        ├── types.ts                   ← SurveyItem, QuestionAnalytics, ChoiceResult, etc.
        ├── api\client.ts              ← apiHealth, apiSurveys, apiSurvey, apiAnalytics, apiShutdown
        ├── components\
        │   ├── Header.tsx             ← DS Header 48px (inPortal prop = null render)
        │   └── SurveyCard.tsx         ← tarjeta con título, fecha, count de respuestas
        ├── pages\
        │   ├── Dashboard.tsx          ← lista surveys + KPIs + buscador
        │   └── SurveyDetail.tsx       ← analytics por pregunta con BarChart recharts
        └── __tests__\
            ├── setup.ts               ← jest-dom + fetch mock
            ├── header.test.tsx        ← 20 tests: badge, brand, appName, inPortal, Salir
            └── surveycard.test.tsx    ← 17 tests: render, fechas nulas, onClick, a11y
```

---

## Configuración del token de SurveyMonkey

El token va en `SurveyApp.Web/appsettings.json`:

```json
{
  "SurveyMonkey": {
    "AccessToken": "TU_TOKEN_AQUI"
  }
}
```

O bien en `appsettings.Development.json` (gitignoreado) para no commitear el token:

```json
{
  "SurveyMonkey": {
    "AccessToken": "TU_TOKEN_AQUI"
  }
}
```

### Cómo obtener el token
1. Ir a **https://developer.surveymonkey.com**
2. Crear o abrir una app
3. En la sección "Settings" → "Access Tokens" → generar un token
4. El token tiene formato `Bearer <hash largo>`; pegar solo el hash (sin "Bearer")

> Si el token no está configurado, el backend responderá con HTTP 401 y el frontend
> mostrará un mensaje de error con instrucciones.

---

## Cómo levantar

### Opción A — START.bat
```
SURVEY\START.bat → lanza backend (dotnet run) + frontend (npm run dev) → abre :5176
```

### Opción B — Terminal
```powershell
# Backend ASP.NET
cd "C:\Esteban CFOTech\Portal de Acceso\SURVEY\SurveyApp.Web"
dotnet run
# → API en http://localhost:5055

# Frontend React (otra terminal)
cd "C:\Esteban CFOTech\Portal de Acceso\SURVEY\survey-frontend"
npm install   # solo la primera vez
npm run dev
# → UI en http://localhost:5176
```

### Desde el portal (recomendado)
El Portal Launcher `:4999` lanza backend + frontend cuando el usuario hace click en "Survey Analytics".

---

## Endpoints API (:5055)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check — `{ ok: true }` |
| GET | `/api/surveys` | Lista surveys de SM (100 por página) con responseCount y fechas |
| GET | `/api/surveys/{id}` | Detalle con preguntas y choices |
| GET | `/api/surveys/{id}/analytics` | Rollups de SM + merge con textos de preguntas |
| POST | `/api/shutdown` | Apaga ASP.NET Core (delay 300ms) — para postMessage del portal |

---

## SurveyMonkey API v3 — endpoints utilizados

| Endpoint SM | Para qué |
|-------------|---------|
| `GET /surveys?include=response_count,date_created,date_modified` | Lista de surveys |
| `GET /surveys/{id}/details` | Detalle completo con pages/questions/choices |
| `GET /surveys/{id}/rollups` | Conteos por opción para cada pregunta |

El servicio `SurveyMonkeyService.GetAnalyticsAsync()` llama a `/details` y `/rollups` en paralelo y mergea los resultados.

---

## Integración con el portal

### IN_PORTAL detection
```typescript
// App.tsx — módulo-level
export const IN_PORTAL = window.self !== window.top
```

- `IN_PORTAL = true` → Header no se renderiza (Header.tsx retorna `null`).
- `IN_PORTAL = false` → Header completo con logo CFO, appName y botón Salir.

### Salir / postMessage
```typescript
async function handleSalir() {
  try { await apiShutdown() } catch {}
  if (IN_PORTAL) {
    window.parent.postMessage(
      { type: 'portal:goHome', appId: 'survey' },
      'http://localhost:5174',
    )
  } else {
    setTimeout(() => window.close(), 600)
  }
}
```

### CORS del backend
```csharp
// Program.cs — solo acepta llamadas desde frontend y portal
policy.WithOrigins(
    "http://localhost:5176",   // Survey frontend
    "http://localhost:5174"    // Portal shell
)
```

---

## Tests

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso\SURVEY\survey-frontend"
npm run test:run    # 62 tests — 62/62
npm run coverage    # con reporte de cobertura
```

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `header.test.tsx` | 20 | Header: badge, brand, appName, inPortal, onSalir |
| `surveycard.test.tsx` | 17 | Render, fechas nulas, onClick, teclado, a11y |
| `client.test.ts` | 25 | URLs correctas de todos los endpoints (`/api/survey/…`), exports, errores HTTP |

---

## Design System

Ver `C:\Esteban CFOTech\Portal de Acceso\DESIGN_SYSTEM.md` para tokens canónicos.

Los tokens DS están en `survey-frontend/src/index.css` como variables CSS (`--navy`, `--green-a`, etc.).
Clases propias usan el prefijo `.sv-*` para evitar colisiones.

---

## Historial de versiones

| Fecha | Cambio |
|-------|--------|
| 2026-06-12 | **FASE 6:** Survey Analytics construida desde cero. ASP.NET Core :5055 + React 19 + Vite :5176. SurveyMonkey API v3 (Bearer token). Dashboard con KPIs + buscador + SurveyCards. SurveyDetail con BarChart recharts por pregunta. Vitest 4.x: 37/37 tests. Integrado en portal (registry + launcher + ALLOWED_APP_ORIGINS). |
| 2026-06-19 | **Selector AÑO + ENCUESTA + Consultar.** Dashboard rediseñado: dropdown AÑO (valores en `config.ts` — editable sin tocar backend) + dropdown ENCUESTA + botón **[Consultar]**. Collector cards con KPIs de respuestas por collector. Nuevos tipos en `types.ts`: `SurveyForYearResponse`, `SurveyReportResponse`. Nuevos endpoints en `client.ts`: `apiSurveysForYear(year)`, `apiSurveyReport(id)`, `apiYears()`. Refactor: años vienen de `config.ts` local (sin dependencia del backend). Fix: muestra error descriptivo cuando backend no disponible. |
| 2026-06-19 | **Fix compresión + client tests.** Bug: ASP.NET Core `UseResponseCompression` enviaba Brotli; `httpx` sin paquete `brotli` no decodificaba; gateway stripeaba `Content-Encoding` pero pasaba bytes comprimidos → JSON parse fallaba. Fix en `portal_server.py`: excluir `accept-encoding` de headers reenviados. Nuevo `src/__tests__/client.test.ts` (25 tests): URLs correctas con prefijo `/api/survey/`, exports, errores HTTP. **Total: 62/62 tests** (header 20 + surveycard 17 + client 25). |
