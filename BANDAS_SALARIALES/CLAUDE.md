# CLAUDE.md — Bandas Salariales DC

Guía de contexto para futuras sesiones de Claude Code en este proyecto.

---

## ¿Qué es este proyecto?

Pipeline ETL + base de datos local para gestionar las **bandas salariales mensuales**
del Delivery Center (DC) de CFOTech Latam.

Cada mes llega un archivo Excel con ~95 empleados, sus remuneraciones y su posición
dentro de las bandas (OK / REVISAR / sin banda). El sistema importa ese Excel a
SQLite como un **snapshot inmutable** identificado por fecha `YYYY-MM-DD`.
Los snapshots se acumulan — nunca se borran ni sobreescriben.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | **React 19** + **Vite 8** + TypeScript strict · **CSS plano DS** (sin MUI) |
| Backend / API | ASP.NET Core 8 (C#) |
| Base de datos | SQLite 3 (vanilla `Microsoft.Data.Sqlite`, sin ORM) |
| ETL / Importación | Python 3.11 + `openpyxl` (scripts existentes, sin cambios) |
| Runtime | Windows 11 / PowerShell |

> El ETL Python es invocado por el backend .NET como subproceso al hacer upload desde la UI.

---

## Estructura de archivos

```
Bandas Salariales\
├── CLAUDE.md                            ← este archivo
├── DESIGN_SYSTEM.md                     ← CFOTech IT Tools Design System (tokens, componentes)
├── README.md
├── Iniciar Bandas Salariales.bat        ← launcher doble clic (back + front + browser)
├── Test-Launcher.ps1                    ← suite 13 tests de verificación end-to-end
│
├── .claude\
│   ├── settings.json                    hook PostToolUse → import_excel
│   └── commands\diseño.md               skill /diseño — aplica Design System
│
├── BandasSalariales.Web\                ← ASP.NET Core 8 API (puerto :5050)
│   ├── Controllers\
│   │   ├── DashboardController.cs       GET /api/dashboard
│   │   ├── SnapshotsController.cs       GET /api/snapshots, /api/snapshots/{id}/empleados
│   │   ├── EmpleadosController.cs       GET /api/empleados/{cuil}, /buscar, /comparativo
│   │   └── UploadController.cs          POST /api/upload
│   ├── Models\                          (7 clases: Importacion, BandaSalarial, DashboardKpis…)
│   ├── Services\BandasDbService.cs      acceso SQLite vanilla
│   ├── Program.cs                       configura CORS, controllers, DI
│   ├── appsettings.json                 Urls: http://localhost:5050
│   └── BandasSalariales.Web.csproj
│
├── bandas-frontend\                     ← React 19 + Vite 8 + TypeScript · CSS plano DS (puerto :5173)
│   ├── package.json                     ← v4.0.0 — sin @mui/material, sin @emotion
│   ├── src\
│   │   ├── index.css                    ← variables DS + todos los estilos (sin MUI) — FASE 4
│   │   ├── main.tsx                     ← monta <App /> en #root, importa index.css
│   │   ├── App.tsx                      ← BrowserRouter + Routes + export IN_PORTAL
│   │   ├── theme.ts                     ← solo DS object + semaforo() (sin MUI createTheme)
│   │   ├── types.ts                     ← interfaces TypeScript
│   │   ├── api\client.ts                ← axios → /api (proxy a :5050 en dev)
│   │   ├── components\
│   │   │   ├── Layout.tsx               ← header + sidebar CSS, responsive matchMedia, modal salir
│   │   │   └── UploadModal.tsx          ← drag & drop + progreso, CSS plano
│   │   └── pages\
│   │       ├── Dashboard.tsx            ← KPIs + Distribución visual + Por Seniority + Brecha + historial
│   │       ├── Tabla.tsx                ← tabla paginada + filtros toggle + sort + Pagination custom
│   │       ├── Historial.tsx            ← comparativo entre snapshots
│   │       └── Empleado.tsx             ← ficha + LineChart recharts (mantenido)
│   └── vite.config.ts                   ← proxy /api → :5050
│
├── db\
│   └── bandas_salariales.db             ← SQLite (NO commitear)
│
├── scripts\
│   ├── init_db.py                       ← crea/actualiza schema
│   ├── import_excel.py                  ← ETL: Excel → SQLite
│   ├── test_injection.py                ← 11 tests de integridad del ETL
│   ├── hook_post_import.py              ← hook Claude Code (PostToolUse)
│   └── requirements.txt                ← openpyxl
│
└── Bandas Salariales *.xlsx             ← archivos fuente mensuales
```

---

## Cómo levantar la app web

### Opción A — Doble clic desde el Escritorio (recomendada)

Acceso directo en el Escritorio: **"Bandas Salariales DC"**  
O ejecutar directamente: `Iniciar Bandas Salariales.bat`

El script hace todo solo:
1. Abre ventana de consola del **Backend** (ASP.NET Core → `:5050`)
2. Espera 5 s y abre ventana del **Frontend** (Vite React → `:5173`)
3. Espera 6 s y abre **http://localhost:5173** en el navegador

### Opción B — Dos terminales manuales

```powershell
# Terminal 1 — API
cd BandasSalariales.Web
dotnet run

# Terminal 2 — Frontend
cd bandas-frontend
npm run dev
```

> En desarrollo, Vite hace proxy de `/api/*` → `:5050` automáticamente (vite.config.js).
> No es necesario configurar CORS manualmente en el navegador.

### Verificar que todo funciona (test suite)

```powershell
powershell -ExecutionPolicy Bypass -File "Test-Launcher.ps1"
```

13 tests: archivos + shortcut → backend API (endpoints + 404) → frontend React (HTML + proxy Vite→API + runtime).
Resultado esperado: `PASS  13/13 tests pasaron`.

### Recrear el acceso directo del Escritorio (si se pierde)
```powershell
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$([System.Environment]::GetFolderPath('Desktop'))\Bandas Salariales DC.lnk")
$Shortcut.TargetPath       = "C:\Esteban CFOTech\Bandas Salariales\Iniciar Bandas Salariales.bat"
$Shortcut.WorkingDirectory = "C:\Esteban CFOTech\Bandas Salariales"
$Shortcut.Description      = "CFOTech IT Tools — Bandas Salariales DC"
$Shortcut.IconLocation     = "C:\Windows\System32\imageres.dll,109"
$Shortcut.Save()
```

---

## Comandos frecuentes — ETL Python

> Siempre ejecutar desde `C:\Esteban CFOTech\Bandas Salariales\`
> y con `$env:PYTHONIOENCODING = "utf-8"` en PowerShell (evita errores de encoding).

```powershell
# Instalar dependencias ETL (solo la primera vez)
pip install openpyxl

# Importar un Excel nuevo (append — no borra los anteriores)
python scripts/import_excel.py "Bandas Salariales Julio 2026 - DC.xlsx"

# Importar forzando re-carga del mismo archivo/fecha
python scripts/import_excel.py "Bandas Salariales Julio 2026 - DC.xlsx" --forzar

# Indicar período manualmente (si el nombre del archivo no sigue la convención)
python scripts/import_excel.py "archivo.xlsx" --periodo 2026-07

# Indicar fecha de carga manualmente
python scripts/import_excel.py "archivo.xlsx" --fecha 2026-07-01

# Re-inicializar el schema (sin tocar los datos)
python scripts/init_db.py
```

---

## Modelo de datos

### Tabla `importaciones`
Una fila por cada carga de Excel ejecutada.

```
id              INTEGER PK AUTOINCREMENT
periodo         TEXT NOT NULL          '2026-06'
anio            INTEGER NOT NULL       2026
mes             INTEGER NOT NULL       6
dia             INTEGER NOT NULL       9
fecha_carga     TEXT NOT NULL          '2026-06-09'  (YYYY-MM-DD)
archivo_fuente  TEXT NOT NULL          nombre del .xlsx
total_registros INTEGER                95
UNIQUE (fecha_carga, archivo_fuente)   ← anti-duplicado
```

### Tabla `bandas_salariales`
Snapshot completo de empleados. **Append-only — nunca se modifica.**

```
id              INTEGER PK AUTOINCREMENT
import_id       INTEGER NOT NULL  FK → importaciones.id

-- Identificación
cuil            TEXT NOT NULL     clave natural del empleado (CUIL argentino)
dni             TEXT
apellidos       TEXT
nombres         TEXT

-- Datos laborales (pueden cambiar mes a mes)
ceco            TEXT              ej: '2 007 00 - DC - ORIGENES /LIFE/BST'
fecha_ingreso   TEXT              ej: '18/8/2020'
perfil          TEXT              ej: 'QA Manual Analyst', 'Tech Lead'
seniority       TEXT              JR | SSR | SR

-- Remuneración
salario_bruto   REAL
internet        REAL              adicional internet (25000 o 0)
fact_cash       REAL              facturación o pago cash (freelancers)
remuneracion    REAL              = salario_bruto + internet + fact_cash

-- Banda salarial (NULL para gerentes/directivos sin banda definida)
verif           TEXT              NULL o '#N/D' para sin-banda
lim_inferior    REAL NULL
lim_superior    REAL NULL
estado_vs_inf   TEXT NULL         'OK' | 'REVISAR'
estado_vs_sup   TEXT NULL         'OK' | 'REVISAR'
var_monto       TEXT NULL         'EN BANDA' | monto numérico (ej: '-103923')
var_pct         TEXT NULL         'EN BANDA' | porcentaje  (ej: '-7%')
gerencia        TEXT NULL         mayormente vacío en versiones actuales
```

**Índices:** `idx_bs_cuil` (cuil), `idx_bs_import` (import_id)

### Vistas

| Vista | Descripción |
|-------|-------------|
| `v_ultima_carga` | Solo los registros del `import_id` más alto (último snapshot) |
| `v_historial_empleado` | Todo el historial de todos los empleados, ordenado por `cuil, fecha_carga` |

---

## Lógica del ETL (`import_excel.py`)

### Convención de nombres de archivo
El período se extrae del nombre si sigue el patrón:
`Bandas Salariales <Mes> <YYYY> - DC.xlsx`
Los meses están mapeados en `MESES_ES` (dict español → número).
Si el nombre no sigue la convención, pasar `--periodo YYYY-MM`.

### Helpers de limpieza de valores

| Función | Propósito |
|---------|-----------|
| `limpiar_texto(v)` | strip + devuelve None si vacío o `#N/D` |
| `limpiar_real(v)` | parsea montos argentinos `$ 2.350.000` → `2350000.0` |
| `limpiar_pct(v)` | convierte decimales de Excel `0.07` → `'7%'`; preserva `'EN BANDA'` |

### Mapeo Excel → BD (índices 0-based de `openpyxl`)

| Índice | Col Excel | Campo BD |
|--------|-----------|----------|
| 0  | C1  CUIL            | cuil |
| 1  | C2  DNI             | dni |
| 2  | C3  APELLIDOS       | apellidos |
| 3  | C4  NOMBRES         | nombres |
| 4  | C5  CECO            | ceco |
| 5  | C6  F INGRESO       | fecha_ingreso |
| 6  | C7  PERFIL          | perfil |
| 7  | C8  SEÑORITY        | seniority |
| 8  | C9  S BRUTO         | salario_bruto |
| 9  | C10 Internet        | internet |
| 10 | C11 FACT/CASH       | fact_cash |
| 11 | C12 REMUN           | remuneracion |
| 12 | C13 VERIF           | verif |
| 13 | C14 LIM INFERIOR    | lim_inferior |
| 14 | C15 VAR VS INF est. | estado_vs_inf |
| 15 | C16 LIM SUPERIOR    | lim_superior |
| 16 | C17 VAR VS SUP est. | estado_vs_sup |
| 17 | C18 VAR MONTO       | var_monto |
| 18 | C19 VAR PCT         | var_pct |
| 19 | C20 Gerencia        | gerencia |

### Anti-duplicado y `--forzar`
- Si `(fecha_carga, archivo_fuente)` ya existe → aviso y exit sin insertar.
- Con `--forzar`: borra el snapshot anterior (`DELETE` en ambas tablas) y re-inserta.

---

## Quirks del Excel que hay que conocer

1. **Formato monetario argentino**: punto como separador de miles, sin decimales.
   `$ 2.350.000` → `2350000.0`. Manejado en `limpiar_real()`.

2. **Porcentajes como decimal**: Excel almacena `7%` como `0.07`.
   `limpiar_pct()` multiplica por 100 y agrega `%`.

3. **Gerentes sin banda**: 5 empleados tienen `#N/D` en `verif` y celdas vacías en
   C14–C19 (limites y varianzas). Sus campos de banda quedan `NULL`.

4. **Trailing spaces**: el nombre de columna C4 (`NOMBRES `) tiene espacio.
   No afecta la lectura porque se accede por índice, no por nombre.

5. **Celdas con formato mixto**: algunas filas de `S BRUTO` vienen como `$ 1.888.482,21`
   (con coma decimal) en lugar de número puro. `limpiar_real()` lo maneja.

6. **Encoding en Windows**: `sys.stdout` se wrappea en UTF-8 al inicio de cada script
   para evitar `UnicodeEncodeError` en PowerShell con emojis/caracteres especiales.

---

## Queries de referencia

```sql
-- ¿Qué cargas hay?
SELECT id, periodo, fecha_carga, total_registros FROM importaciones ORDER BY fecha_carga;

-- Estado actual (última carga)
SELECT apellidos, nombres, perfil, seniority, remuneracion, estado_vs_inf, var_pct
FROM   v_ultima_carga
ORDER  BY apellidos;

-- Empleados en REVISAR (última carga)
SELECT apellidos, nombres, perfil, seniority, remuneracion, lim_inferior, var_pct
FROM   v_ultima_carga
WHERE  estado_vs_inf = 'REVISAR'
ORDER  BY var_pct;

-- Evolución de un empleado por CUIL
SELECT fecha_carga, remuneracion, estado_vs_inf, var_pct
FROM   v_historial_empleado
WHERE  cuil = '20430817044'
ORDER  BY fecha_carga;

-- Resumen por período: cuántos OK / REVISAR / sin banda
SELECT i.periodo, i.fecha_carga,
       COUNT(*) FILTER (WHERE b.estado_vs_inf = 'OK')      AS ok,
       COUNT(*) FILTER (WHERE b.estado_vs_inf = 'REVISAR') AS revisar,
       COUNT(*) FILTER (WHERE b.estado_vs_inf IS NULL)     AS sin_banda,
       COUNT(*)                                             AS total
FROM   bandas_salariales b
JOIN   importaciones i ON b.import_id = i.id
GROUP  BY i.id
ORDER  BY i.fecha_carga;

-- Empleados que mejoraron (REVISAR → OK) entre dos cargas consecutivas
SELECT a.cuil, a.apellidos, a.nombres,
       ia.fecha_carga AS fecha_anterior, a.remuneracion AS rem_anterior,
       ib.fecha_carga AS fecha_nueva,    b.remuneracion AS rem_nueva,
       b.var_pct AS nuevo_pct
FROM   bandas_salariales a
JOIN   bandas_salariales b  ON a.cuil = b.cuil AND a.import_id < b.import_id
JOIN   importaciones ia     ON a.import_id = ia.id
JOIN   importaciones ib     ON b.import_id = ib.id
WHERE  a.estado_vs_inf = 'REVISAR'
AND    b.estado_vs_inf = 'OK';
```

---

## Hooks de Claude Code (`.claude/settings.json`)

### Qué hace el hook
Cada vez que se ejecuta un comando Bash que contiene `import_excel`,
Claude Code invoca automáticamente `scripts/hook_post_import.py`, que
a su vez corre la suite completa de tests de inyección y muestra el resultado.

**Para comandos que no son import** el hook termina en exit 2 (silencioso).

### Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `.claude/settings.json` | Registra el hook `PostToolUse → Bash` |
| `scripts/hook_post_import.py` | Runner del hook: parsea stdin de Claude Code, filtra por keyword, llama a tests |
| `scripts/test_injection.py` | Suite de 11 tests de validación (también usable standalone) |

### Correr los tests manualmente

```powershell
# Resultado compacto
python scripts/test_injection.py

# Con detalle de cada test
python scripts/test_injection.py --verbose
```

### Los 11 tests

| ID | Test | Qué valida |
|----|------|-----------|
| T01 | BD existe | El archivo `.db` está en `db/` |
| T02 | Existe ≥1 import | `importaciones` no está vacía |
| T03 | Último import tiene datos | Hay filas en `bandas_salariales` para el último `import_id` y el conteo coincide |
| T04 | Sin CUILs nulos | Ningún empleado importado tiene CUIL vacío |
| T05 | Sin CUILs duplicados | Cada CUIL aparece exactamente una vez por snapshot |
| T06 | remuneracion = bruto+internet+fact_cash | Integridad aritmética de la remuneración total |
| T07 | estado_vs_inf válido | Solo contiene `'OK'`, `'REVISAR'` o `NULL` |
| T08 | var_pct formato correcto | Contiene `'EN BANDA'`, `'XX%'` o `NULL` |
| T09 | lim_inferior < lim_superior | Bandas no están invertidas |
| T10 | Historial íntegro | Todos los snapshots anteriores siguen teniendo datos |
| T11 | % REVISAR ≤ 60% | Warning si más del 60% está en REVISAR |

### Extender los tests
Agregar un nuevo test en `test_injection.py` siguiendo el patrón:
```python
# ── T12: descripción ──────────────────────────────────────────────
if ultimo:
    # ... query o lógica ...
    if condicion_fallo:
        r.fail("T12: nombre del test", "descripción del fallo")
    else:
        r.ok("T12: nombre del test", "detalle opcional")
```

---

## Cómo extender este proyecto

### Agregar nuevas columnas al Excel
1. Agregar el campo en `init_db.py` → tabla `bandas_salariales`.
2. Agregar la lectura en `import_excel.py`.
3. Actualizar `v_ultima_carga` y `v_historial_empleado` en `init_db.py`.
4. Agregar la propiedad al modelo C# correspondiente en `BandasSalariales.Web/Models/`.
5. Agregar la columna en `BandasDbService.cs` (SELECT + mapeo en el reader).
6. Mostrarla en el componente React correspondiente.
7. Actualizar este CLAUDE.md.

### Agregar un endpoint nuevo al backend (.NET)
1. Agregar el método en `BandasDbService.cs`.
2. Agregar la ruta en el controller existente o crear uno nuevo en `Controllers/`.
3. El JSON sale en camelCase automáticamente (configurado en `Program.cs`).

### Agregar una página nueva al frontend (React)
1. Crear `bandas-frontend/src/pages/NuevaPagina.tsx`.
2. Agregar la ruta en `App.tsx` (`<Route path="/nueva" element={<NuevaPagina />} />`).
3. Agregar el ítem en `Layout.tsx` → array `NAV`.
4. Agregar el helper de API en `api/client.ts`.
5. Usar clases CSS del DS (`card`, `card-body`, `btn-primary`, `badge-success`, etc.) de `index.css`.
   **No instalar MUI ni @emotion** — el stack es CSS plano desde FASE 4.

### Agregar un script de reporte (Python)
Crear `scripts/reporte_<nombre>.py` que:
- Conecte con `sqlite3.connect("db/bandas_salariales.db")`
- Use `conn.row_factory = sqlite3.Row` para acceso por nombre
- Exporte a CSV, Excel o imprima en consola

### Agregar soporte para múltiples hojas del Excel
En `import_excel.py`, cambiar `ws = wb.active` por `ws = wb["NombreHoja"]`.

### Migrar a PostgreSQL (si escala)
- Schema SQL es estándar. Solo cambiar `AUTOINCREMENT` → `SERIAL` y la connection string.
- En .NET: reemplazar `Microsoft.Data.Sqlite` por `Npgsql`.
- Los scripts Python: reemplazar `sqlite3` por `psycopg2`.

### Decisiones técnicas importantes
- **JSON camelCase**: ASP.NET Core serializa en camelCase (`estadoVsInf`, no `EstadoVsInf`).
  El frontend React usa las propiedades en camelCase directamente.
- **Sin ORM**: `BandasDbService` usa ADO.NET directo (`SqliteConnection`, `SqliteCommand`).
  Si se agrega Dapper, basta con `conn.Query<T>()` en lugar de `ExecuteReader()`.
- **FULL OUTER JOIN en SQLite**: emulado con LEFT JOIN + UNION en `GetComparativo()`.
  SQLite ≥3.39 lo soporta nativamente pero se mantiene el UNION por compatibilidad.
- **Upload**: el .NET guarda el Excel en `db/_tmp/`, llama a Python como subproceso,
  captura stdout/stderr y limpia el temp. Exit code 0 = éxito.
- **Launcher .bat — encoding**: el archivo debe ser **ASCII puro** (sin BOM, sin Unicode).
  `chcp 65001` debe ser la **primera línea** antes de cualquier `title` o `echo`.
  CMD lee el .bat con su code page default (CP850/1252) antes de ejecutar cualquier comando;
  los caracteres Unicode (em dash, box drawing) causan errores de parseo.
  Los `start` internos usan `cmd /k "dotnet run"` sin `^|` para mayor compatibilidad.

---

## Design System

**Leer `DESIGN_SYSTEM.md` antes de crear cualquier pantalla o componente.**

El Design System de CFOTech IT Tools define:
- Paleta de colores (tokens CSS con nombres semánticos)
- Tipografía: `'Segoe UI', system-ui, sans-serif`
- Header, Cards, Formularios, Botones, Badges, KPI Boxes, Step Bar, Spinner
- Semáforo numérico (verde ≥4.0 / naranja 3–3.9 / rojo <3.0)
- Implementado como variables CSS en `bandas-frontend/src/index.css` + objeto `DS` en `theme.ts`
- **Sin MUI desde FASE 4**: todos los componentes usan clases CSS planas del DS

### Spec vigente del Header (v2.1)

| Atributo | Valor |
|----------|-------|
| Altura | 48px |
| Fondo | `#0B1526` (DS.navyDark) |
| Border-bottom | `3px solid #1C2E48` |
| Logo | 32×32px, r-8, `#00A878`, texto 11px |
| Título | "CFOTech" blanco 15px bold + "IT Tools" `#4FD1B2` 15px bold |
| App name | inline con separador `\|` tenue, 13px, `rgba(255,255,255,.55)` |
| Botón Salir | pill border-radius 20px, outline rgba blanco |

### Usar el skill `/diseño`

Invocar `/diseño` en cualquier sesión de Claude Code para activar el modo Design System:
- Revisa automáticamente que el código cumpla los tokens.
- Aplica el checklist de entrega antes de mostrar una pantalla.
- Sugiere correcciones si algo no cumple.

```
/diseño          ← activar
/diseño revisar  ← revisar componente existente
```

El skill vive en `.claude/commands/diseño.md`.

---

## API — Endpoints disponibles

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check sin BD — respuesta inmediata (usado por semáforo frontend) |
| GET | `/api/dashboard` | KPIs del último snapshot (total, ok, revisar, sin banda, rem avg/max/min) |
| GET | `/api/snapshots` | Lista de todas las importaciones |
| GET | `/api/snapshots/{id}/empleados` | Empleados de un snapshot específico |
| DELETE | `/api/snapshots/{id}` | Elimina un snapshot y todos sus empleados (transaccional) — 200 OK o 404 |
| GET | `/api/empleados/{cuil}` | Detalle + historial de un empleado por CUIL |
| GET | `/api/empleados/buscar?q=` | Autocomplete: busca en el último snapshot (min 2 chars) |
| GET | `/api/empleados/comparativo?a=&b=` | Comparativo entre dos snapshots (ids) |
| POST | `/api/upload` | Subir Excel (multipart, campo: `excel`) → llama ETL Python |
| POST | `/api/shutdown` | Apaga el servidor ASP.NET Core limpiamente (delay 300ms antes de stop) |

---

## Integración con el portal (iframe)

### IN_PORTAL detection
```typescript
// Layout.tsx y App.tsx — módulo-level, evaluación estática
const IN_PORTAL = window.self !== window.top
```

- `IN_PORTAL = true` → Header, Drawer y hamburguesa **no se renderizan**. El portal shell provee el header. El `<main>` usa clase `.portal-mode` (padding 16px, height 100%).
- `IN_PORTAL = false` → layout completo: header 48px fijo + sidebar 220px permanente en desktop / drawer temporal en mobile.

### Salir / postMessage
`handleConfirmSalir()` en `Layout.tsx`:

```tsx
async function handleConfirmSalir() {
  setConfirmSalir(false)
  setClosing(true)
  try { await shutdownBackend() } catch {}
  await new Promise(r => setTimeout(r, 500))
  if (IN_PORTAL) {
    window.parent.postMessage(
      { type: 'portal:goHome', appId: 'bandas-salariales' },
      'http://localhost:5174',
    )
    // El portal: llama launcher stop → mata :5050 y :5173 → vuelve al Dashboard
  } else {
    window.close()
    await new Promise(r => setTimeout(r, 300))
    setShutdownDone(true)  // fallback overlay si el browser bloquea close
  }
}
```

### CORS del backend ASP.NET Core
`Program.cs` debe incluir:
```csharp
app.Use(async (ctx, next) => {
    ctx.Response.Headers.Remove("X-Frame-Options");
    await next();
});
```
Y en la configuración CORS, permitir el portal:
```csharp
policy.WithOrigins("http://localhost:5173", "http://localhost:5174")
```

---

## Estado actual de la BD (al 2026-06-10)

| Importaciones | Empleados | OK | REVISAR | Sin banda |
|:---:|:---:|:---:|:---:|:---:|
| 1 | 95 | 45 | 45 | 5 |

---

## Historial de versiones

| Fecha | Cambio |
|-------|--------|
| 2026-06-09 | v1: ETL Python + SQLite. Sin web. |
| 2026-06-09 | v1.5: Flask web app (Python) — Dashboard, Tabla, Historial, Empleado, Upload. |
| 2026-06-10 | v2: Migración a React 18 + Vite 5 + MUI (frontend) / ASP.NET Core 8 (backend). Flask descartado. |
| 2026-06-10 | Design System (`DESIGN_SYSTEM.md`) + skill `/diseño` + `theme.js` actualizado con tokens DS reales. |
| 2026-06-10 | Desktop launcher: `Iniciar Bandas Salariales.bat` + acceso directo "Bandas Salariales DC.lnk" en Escritorio. |
| 2026-06-10 | Test suite end-to-end: `Test-Launcher.ps1` (13 tests — archivos, backend API, frontend React). Verificado 13/13 PASS. |
| 2026-06-10 | Fix launcher .bat: reescrito en ASCII puro, `chcp 65001` como primera línea, sin Unicode ni `^|` en `cmd /k`. |
| 2026-06-10 | DS compliance frontend: AppBar DS en desktop+mobile (logo CFO, "CFOTech IT Tools", indicador conectividad); KPI Boxes a spec (gray1, 22px, uppercase); todos los colores hardcodeados reemplazados por tokens `DS.*`; hover shadow eliminada de MuiCard. |
| 2026-06-10 | Header compacto: 90px → 48px, logo 70×70 → 32×32 (r-8), título 28px → 15px, app name inline con separador `\|`, fondo navyDark `#0B1526`, botón Salir pill (r-20). Nuevo token `DS.navyDark`. `DESIGN_SYSTEM.md` actualizado a valores generales sin particularidades de app. |
| 2026-06-10 | Dashboard v2: KPI cards altura uniforme (stretch); quitado PieChart y tarjetas Rem. Promedio y Rem. Máxima; fila inferior 3 columnas: Distribución visual (md=5) + Por Seniority (md=4) + Brecha salarial (md=3). Dashboard carga empleados del último snapshot para cálculos client-side. |
| 2026-06-10 | Backend: agregado `/api/health` (sin BD, respuesta inmediata). Fix semáforo BackendStatus: usa `/api/health`, eliminado guard `alive` (React 18 StrictMode). |
| 2026-06-10 | Salir: flujo completo shutdown → overlay oscuro con spinner → `window.close()` → si browser bloquea cierre muestra "Servidor apagado / Podés cerrar esta pestaña". |
| 2026-06-10 | Backend: `DELETE /api/snapshots/{id}` — borra importación + empleados en una transacción (`BandasDbService.DeleteSnapshot()`). 200 OK con mensaje / 404 si no existe. |
| 2026-06-10 | Dashboard: botón "Ver tabla" por fila (navega a `/tabla?import_id=X`) + botón borrar con ícono `DeleteOutlined` y confirm dialog (título, advertencia, botones Cancelar/Eliminar con estado loading). |
| 2026-06-10 | Fix: ícono `@mui/icons-material/DeleteOutline` → `DeleteOutlined` (MUI v9 renaming). |
| 2026-06-11 | **FASE 1 (portal):** Integración como iframe. `IN_PORTAL = window.self !== window.top` en `Layout.tsx` y `App.tsx`. AppBar + Drawer ocultos en portal mode. `mt` y padding del `<Box main>` condicionales. `handleConfirmSalir` actualizado: `shutdown → postMessage({ type: 'portal:goHome', appId: 'bandas-salariales' })` en portal mode; `window.close()` en standalone. `CssBaseline` envuelto con `{!IN_PORTAL && ...}` en `App.tsx`. Dialogs y texto contextuales según `IN_PORTAL`. |
| 2026-06-11 | **FASE 2:** Upgrade React **19.2.7** + Vite **8.0.16** (ya estaban en esa versión — sin cambios requeridos). |
| 2026-06-12 | **FASE 4:** Eliminación completa de MUI (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`). Todos los componentes migrados a HTML + CSS plano DS. `theme.ts` simplificado: solo `DS` object + `semaforo()`. `index.css` reescrito desde cero con tokens DS, clases reutilizables (.card, .btn-*, .badge-*, .toggle-group, .data-table, .tbl-pagination, .modal-overlay, .spinner, .skeleton, .alert, etc.). `IN_PORTAL` exportado desde `App.tsx`. Bundle JS reducido significativamente (recharts es el único dep. visual). `tsc --noEmit` + `vite build` pasan limpio. |
| 2026-06-12 | **FASE 5:** Tests añadidos. `vitest.config.ts` + `setup.ts` + `theme.test.ts` (51 tests: DS tokens + semaforo()) + `components.test.tsx` (45 tests: UploadModal open/close/validación). **96/96** pasan. |
