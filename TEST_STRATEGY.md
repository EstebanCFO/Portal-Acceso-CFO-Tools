# Estrategia de Testing — CFOTech IT Tools Portal

> **Scope:** Portal de Acceso (`/`) + Reporte DevOps (`REPORTE_DEV_OPS/`)  
> **Fecha:** 2026-06-10 · **Stack:** Vitest + React Testing Library (frontend) · pytest (backend)

---

## 1. Pirámide de testing

```
             ┌──────────────┐
             │   E2E (*)    │  ← Playwright — flujos completos en browser
             │   ~10 casos  │    (*) infraestructura futura, casos documentados aquí
             ├──────────────┤
             │  Integración │  ← pytest con Flask test client + mock de Azure API
             │   ~35 casos  │    Vitest con RTL para componentes compuestos
             ├──────────────┤
             │  Unitarios   │  ← Vitest (registro, lógica pura)
             │   ~40 casos  │    pytest (procesamiento.py, extraccion.py)
             └──────────────┘
```

---

## 2. Herramientas y setup

### Portal (React + Vite + TypeScript)

| Herramienta | Rol |
|-------------|-----|
| **Vitest** | Test runner + coverage |
| **React Testing Library** | Render y query de componentes |
| **@testing-library/user-event** | Simulación de eventos de usuario |
| **jsdom** | Entorno DOM para Vitest |
| **@testing-library/jest-dom** | Matchers adicionales (`toBeInTheDocument`, etc.) |

```powershell
# Instalar
cd "C:\Esteban CFOTech\Portal de Acceso"
npm install

# Correr tests
npm run test:run        # modo CI (una pasada)
npm run test            # modo watch (desarrollo)
npm run test:ui         # UI interactiva en browser
npm run coverage        # con reporte de cobertura
```

### Backend Flask (REPORTE_DEV_OPS)

| Herramienta | Rol |
|-------------|-----|
| **pytest** | Test runner |
| **pytest-mock** | Fixtures de mocking |
| **responses** | Mock de llamadas HTTP (`requests`) |

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso\REPORTE_DEV_OPS\backend"
pip install -r requirements-test.txt
python -m pytest tests/ -v --tb=short

# Con coverage
python -m pytest tests/ --cov=. --cov-report=term-missing
```

### Todo en uno
```powershell
# Desde la raíz del portal
.\RUN_TESTS.bat
```

---

## 3. Tests por capa

### 3.1 Registro de apps (`src/registry/apps.ts`)

**Archivo:** `src/__tests__/registry.test.ts`

#### Camino feliz
| # | Test | Verifica |
|---|------|---------|
| 1 | `APP_REGISTRY` es array no vacío | La app arranca con al menos 1 app |
| 2 | Cada app tiene todos los campos requeridos | Contrato del tipo `App` |
| 3 | No hay IDs duplicados | Navegación única |
| 4 | No hay nombres duplicados | UX sin confusión |
| 5 | `type` es `'iframe'` o `'link'` | Enum válido |
| 6 | `status` es uno de los 3 valores permitidos | Badge correcto |
| 7 | Todas las URLs son `http(s)://` | iframe no falla silenciosamente |
| 8 | `getApp(id)` devuelve la app correcta | Lookup funciona |
| 9 | `activeApps` solo contiene apps `active` | Menú correcto |
| 10 | `reporte-devops` está activa en puerto 5001 | Invariante de negocio |

#### Manejo de errores
| # | Test | Verifica |
|---|------|---------|
| 11 | `getApp('id-inexistente')` → `undefined` | No rompe el portal |
| 12 | `getApp('')` → `undefined` | Edge case de string vacío |

---

### 3.2 Componente Header

**Archivo:** `src/__tests__/components.test.tsx`

#### Camino feliz
| # | Test |
|---|------|
| 13 | Logo renderiza "CFO" |
| 14 | Renderiza "CFOTech" e "IT Tools" |
| 15 | Una pill por cada app del registry |
| 16 | Pill de app activa tiene clase `.active` |
| 17 | Pills coming-soon tienen clase `.disabled` |
| 18 | Click en pill activa llama `onSelectApp(app)` |
| 19 | Click en logo llama `onSelectApp(null)` |
| 20 | Botón Salir está presente |

#### Manejo de errores
| # | Test |
|---|------|
| 21 | Click en pill disabled NO llama `onSelectApp` |
| 22 | Sin app activa, ninguna pill tiene clase `.active` |
| 23 | `activeAppId` desconocido no rompe el render |

---

### 3.3 Componente AppFrame (iframe + estados)

**Archivo:** `src/__tests__/components.test.tsx`

#### Camino feliz
| # | Test |
|---|------|
| 24 | App activa tipo `iframe` → renderiza `<iframe>` |
| 25 | `iframe.src` contiene la URL de la app |
| 26 | Spinner visible al montar (estado loading) |
| 27 | App tipo `link` → botón "Abrir en nueva pestaña", sin iframe |

#### Estados especiales
| # | Test |
|---|------|
| 28 | App `coming-soon` → pantalla `.frame-coming-soon`, sin iframe |
| 29 | Pantalla coming-soon muestra el nombre de la app |
| 30 | App `maintenance` → pantalla `.frame-error`, sin iframe |
| 31 | Al cambiar de app, el estado vuelve a loading |

---

### 3.4 Componente Dashboard

**Archivo:** `src/__tests__/components.test.tsx`

#### Camino feliz
| # | Test |
|---|------|
| 32 | Una card por cada app del registry |
| 33 | Apps activas tienen botón "Abrir →" habilitado |
| 34 | Apps coming-soon tienen botón "Próximamente" disabled |
| 35 | Click en "Abrir →" llama `onSelectApp` con app activa |
| 36 | Click en card activa llama `onSelectApp` |
| 37 | Texto de conteo refleja apps activas / total |

#### Manejo de errores
| # | Test |
|---|------|
| 38 | Click en card coming-soon NO llama `onSelectApp` |
| 39 | Sin apps activas, el componente no crashea |

---

### 3.5 API Flask — `/api/health`

**Archivo:** `backend/tests/test_api.py` · clase `TestHealth`

| # | Camino feliz | Esperado |
|---|-------------|---------|
| 40 | `GET /api/health` | 200, `{ ok: true, servicio: 'reporte-devops' }` |

| # | Error | Esperado |
|---|-------|---------|
| 41 | `POST /api/health` | 405 Method Not Allowed |

---

### 3.6 API Flask — Organizaciones

**Archivo:** `backend/tests/test_api.py` · clase `TestOrganizaciones`

#### Camino feliz
| # | Test | Esperado |
|---|------|---------|
| 42 | `GET /api/organizaciones` | Lista de orgs del `.env` |
| 43 | Cada org tiene `nombre` + `url` | Estructura correcta |
| 44 | URL incluye el nombre de la org | Formato `dev.azure.com/ORG` |
| 45 | `GET /api/organizaciones/refresh` con Azure OK | `{ ok: true, orgs: [...], total: N }` |

#### Manejo de errores
| # | Test | Esperado |
|---|------|---------|
| 46 | Refresh con Azure 401 | `{ ok: false, total: 0 }` (no rompe el endpoint) |
| 47 | Refresh con timeout de red | `{ ok: false }` |

---

### 3.7 API Flask — Proyectos

#### Camino feliz
| # | Test | Esperado |
|---|------|---------|
| 48 | `GET /api/proyectos/TestOrg1` | Lista de proyectos |
| 49 | `PROYECTOS_EXCLUIDOS` filtra correctamente | Proyecto ignorado no aparece |
| 50 | Cada proyecto tiene `id`, `nombre`, `estado` | Estructura correcta |
| 51 | `GET /api/proyecto_info/:org/:proj` | `{ total_sprints, headcount, fecha_inicio, ... }` |

#### Manejo de errores
| # | Test | Esperado |
|---|------|---------|
| 52 | Org no encontrada (404 Azure) | Lista vacía (no crash) |
| 53 | Timeout de Azure | Lista vacía |
| 54 | `proyecto_info` con error de red | Defaults: `total_sprints: 0`, `headcount: 0` |

---

### 3.8 API Flask — Detalle de proyecto

#### Camino feliz
| # | Test | Esperado |
|---|------|---------|
| 55 | Métricas con 2 items (1 Active, 1 Closed) | `avance_pct: 50`, `items_done: 1` |
| 56 | Suma de horas completadas y restantes | Valores correctos |
| 57 | Desvíos incluyen nombre y alerta | Array no vacío |
| 58 | Devuelve `proyecto` y `organizacion` | Campos de identificación |

#### Manejo de errores
| # | Test | Esperado |
|---|------|---------|
| 59 | Sin work items → `avance_pct: 0` | Sin división por cero |

---

### 3.9 API Flask — Test Plans

| # | Test | Esperado |
|---|------|---------|
| 60 | Retorna planes con suites y runs | Estructura correcta |
| 61 | Resumen calcula totales correctamente | `pasados + fallidos = ejecutados` |
| 62 | Sin planes → lista vacía | No crash |
| 63 | Error Azure → lista vacía | No crash |

---

### 3.10 API Flask — Generación de informe

#### Camino feliz
| # | Test | Esperado |
|---|------|---------|
| 64 | `POST /api/generar` inicia pipeline | `{ ok: true }` |
| 65 | Estado inicial es `idle` | `{ corriendo: false }` |
| 66 | Estado tiene todos los campos esperados | 6 campos presentes |

#### Manejo de errores
| # | Test | Esperado |
|---|------|---------|
| 67 | `POST /api/generar` con generación en curso | 409 + `{ ok: false }` |

---

### 3.11 API Flask — Historial, Logs, Descarga

| # | Test | Esperado |
|---|------|---------|
| 68 | `GET /api/historial` sin PDFs | Lista vacía |
| 69 | `GET /api/historial` con PDF creado | PDF aparece en lista |
| 70 | Máximo 20 PDFs en historial | No overflow |
| 71 | `GET /api/logs` lista archivos Trace_ | Lista con campos |
| 72 | `GET /api/logs/:nombre` retorna contenido | JSON con `contenido` |
| 73 | `GET /api/descargar/:nombre` descarga PDF | 200 + PDF |
| 74 | Descargar PDF inexistente | 404 |

---

### 3.12 Seguridad (path traversal)

| # | Test | Esperado |
|---|------|---------|
| 75 | `GET /api/logs/../app.py` | 404 |
| 76 | `GET /api/logs/.env` | 404 |
| 77 | `GET /api/descargar/../app.py` | 404 |
| 78 | CORS con origen permitido | Header `Access-Control-Allow-Origin` presente |

---

### 3.13 Procesamiento — lógica pura (pytest, sin HTTP)

| # | Test |
|---|------|
| 79 | `calcular_metricas` con items mixtos |
| 80 | `calcular_metricas` lista vacía → `avance_pct: 0` |
| 81 | `calcular_metricas` sin story points → `sp_total: 0` |
| 82 | Sprint actual sin desvío → alerta `OK` |
| 83 | Sprint vencido 10 días → alerta `RIESGO` |
| 84 | Sprint pasado (`timeFrame: 'past'`) → `desvio_dias: 0` |
| 85 | Desvío 1-7 días → alerta `DESVIO` |

---

### 3.14 Extracción — lógica pura (pytest, sin HTTP)

| # | Test |
|---|------|
| 86 | `get_orgs()` lee CSV de `AZURE_DEVOPS_ORGS` |
| 87 | `get_projects()` con Azure OK → lista de proyectos |
| 88 | `get_projects()` con HTTP 403 → lista vacía |
| 89 | `get_projects()` con timeout → lista vacía |
| 90 | `get_work_items()` retorna items |
| 91 | `get_work_items()` sin IDs → lista vacía |
| 92 | `get_iterations()` retorna sprints |

---

## 4. Análisis de logs y trazas

### Herramienta: `analizar_logs.py`

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso\REPORTE_DEV_OPS\backend"

# Analizar todos los logs
python analizar_logs.py

# Solo el más reciente + línea de tiempo
python analizar_logs.py --ultimo --timeline

# Exportar reporte HTML
python analizar_logs.py --html

# Archivo específico
python analizar_logs.py logs\Trace_10_06_2026_12_00_00.log
```

### Qué analiza

| Sección | Información extraída |
|---------|---------------------|
| **Resumen ejecutivo** | Total requests, errores, warnings, Azure calls, generaciones |
| **Errores** | Top errores por frecuencia + últimas 5 ocurrencias con contexto |
| **Warnings** | Top warnings agrupados |
| **Azure DevOps API** | Calls por org/endpoint, URLs con fallos, errores de conexión |
| **Generaciones** | Historial de ejecuciones (OK/ERROR), PDF generado, stderr de scripts |
| **Top endpoints** | Endpoints más llamados con conteo de errores 4xx/5xx |
| **Línea de tiempo** | Últimas N entradas del log con colores por nivel |

### Formato de traza (`Trace_DD_MM_YYYY_HH_MM_SS.log`)
```
10/06/2026 12:00:01 [INFO]  INICIO generacion de informe
10/06/2026 12:00:01 [INFO]  --- extraccion.py ---
10/06/2026 12:00:05 [DEBUG] AZ GET https://dev.azure.com/TestOrg1/_apis/projects... -> 200
10/06/2026 12:00:08 [INFO]  --- procesamiento.py ---
10/06/2026 12:00:09 [INFO]  --- generar_pdf.py ---
10/06/2026 12:00:10 [INFO]  FIN generacion
```

### Patrones de error a monitorear

| Patrón | Significado | Acción |
|--------|-------------|--------|
| `AZ GET ERROR ... Connection timeout` | Azure API no responde | Verificar PAT y red |
| `AZ GET ... -> 401` | PAT expirado o inválido | Renovar PAT en `.env` |
| `AZ GET ... -> 403` | Sin permisos en la org | Revisar permisos del PAT |
| `Error en generar_pdf.py` | Fallo en generación PDF | Ver stderr del script |
| `ERROR ... PDF no encontrado` | Pipeline completo pero sin output | Revisar OUTPUT_DIR |

---

## 5. Tests E2E (documentados — infraestructura futura)

Requieren servidor corriendo. Implementar con **Playwright** cuando haya CI/CD.

### Flujos a cubrir

#### Camino feliz — Portal

| # | Flujo |
|---|-------|
| E1 | Abrir `:5174` → Dashboard visible con todas las app cards |
| E2 | Click en pill "Reporte DevOps" → iframe de `:5001` carga |
| E3 | Click en logo CFO → vuelve al Dashboard |
| E4 | Click en "Abrir →" de card activa → carga la app |
| E5 | Pills coming-soon aparecen opacas y no responden al click |

#### Camino feliz — Reporte DevOps

| # | Flujo |
|---|-------|
| E6 | Seleccionar org → dropdown de proyectos se popula |
| E7 | Seleccionar proyecto → KPIs y tabla de desvíos aparecen |
| E8 | Click en tab "Desvíos" → tabla de sprints visible |
| E9 | Click "Generar informe" → barra de estado aparece, polling activo |
| E10 | Generación exitosa → PDF aparece en historial |
| E11 | Click "Descargar" en historial → descarga el PDF |

#### Manejo de errores — E2E

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| E12 | Backend Flask no está corriendo | Barra de error + botón "Abrir en nueva pestaña" |
| E13 | App en iframe rechaza embedding (X-Frame-Options) | Pantalla de error con link alternativo |
| E14 | PAT inválido → `GET /api/proyectos` devuelve `[]` | Dropdown vacío, sin crash |
| E15 | Generar dos veces seguidas | Segundo click → mensaje "ya hay generación en curso" |

```typescript
// playwright.config.ts (template)
import { defineConfig } from '@playwright/test'
export default defineConfig({
  use: { baseURL: 'http://localhost:5174' },
  webServer: [
    { command: 'npm run dev',                      url: 'http://localhost:5174', reuseExistingServer: true },
    { command: 'cd REPORTE_DEV_OPS/backend && python app.py', url: 'http://localhost:5000', reuseExistingServer: true },
    { command: 'cd REPORTE_DEV_OPS/frontend && npm run dev',  url: 'http://localhost:5001', reuseExistingServer: true },
  ],
})
```

---

## 6. Métricas de calidad objetivo

| Métrica | Objetivo |
|---------|---------|
| Cobertura de líneas — portal | ≥ 70% |
| Cobertura de líneas — backend | ≥ 75% |
| Tests unitarios pasando | 100% |
| Tests de integración pasando | 100% |
| Tiempo de suite completa | < 60 segundos |
| Errores en logs de producción | 0 por generación exitosa |

---

## 7. Convenciones

- **Naming tests:** `<descripción en español>` — legible para no-técnicos
- **Arrange / Act / Assert:** separación explícita en tests complejos
- **Mocking:** mockear SIEMPRE las llamadas externas (Azure API, `subprocess`)
- **Fixtures:** en `conftest.py` para datos compartidos; inline para casos únicos
- **No tests en prod:** `requirements-test.txt` separado del `requirements.txt`
- **Reset de estado:** `reset_estado` fixture con `autouse=True` en cada test de Flask

---

## 8. Historial

| Fecha | Cambio |
|-------|--------|
| 2026-06-10 | v1: Estrategia inicial — 92 tests documentados, 78 implementados |
