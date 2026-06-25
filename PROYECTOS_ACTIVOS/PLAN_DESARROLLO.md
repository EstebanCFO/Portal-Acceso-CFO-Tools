# Plan de Desarrollo — App Proyectos Activos CFOTech

**Fecha:** 2026-06-25  
**Autor:** Esteban / Claude Code  
**Estado:** PLANIFICACIÓN

---

## 1. Visión General

App embebida en el Portal de Acceso CFOTech que expone la información financiera y de rentabilidad de los proyectos del Delivery Center. Reemplaza la lectura manual del Excel `Proyectos Activos 2026.xlsx`.

### Flujo de navegación
```
Portal de Acceso
  └── App "Proyectos Activos"
        ├── Pantalla 1: SEMÁFORO GENERAL (default al abrir el iframe)
        │     ├── Cuadro ACUMULADO (todos los proyectos, semáforo de color)
        │     ├── Cuadro MENSUAL (mes actual)
        │     └── Métricas del Delivery Center (Bench, Recursos)
        └── Pantalla 2: EJERCICIO ECONÓMICO (click en proyecto)
              ├── Header del proyecto (cliente, CeCo, período)
              ├── Tabla de recursos con costos
              ├── Resumen financiero (precio venta, comisión, resultado)
              └── Historial mensual (Facturación / Margen / Resultado %)
```

---

## 2. Arquitectura

### Stack por capa

| Capa | Tecnología | Puerto |
|------|-----------|--------|
| Base de datos | **PostgreSQL 16** | `:5432` |
| Backend API | **FastAPI** + SQLAlchemy 2.x + psycopg2 | `:5010` |
| ETL / Ingesta | **Python + pandas + openpyxl** | CLI script |
| Frontend | **React 19** + Vite 8 + TypeScript strict | `:5011` |
| Gráficos | **Recharts** (ya usado en Survey) | — |
| Integración portal | Gateway `/apps/proyectos-activos/` | via `:5174` |

> Sin agentes de IA — la app es de lectura/display de datos estructurados. El ETL es determinístico.

### Decisión de base de datos: PostgreSQL local (no SQLite)
- Los datos financieros requieren `NUMERIC(15,2)` con precisión garantizada.
- El volumen (18 proyectos × 12 meses × N recursos) justifica índices y JOINs reales.
- Compatibilidad futura con un servidor de base de datos compartido en la red interna.
- Driver: `psycopg2-binary` + `SQLAlchemy 2.x` con modelos declarativos.

### Sin agentes LLM por ahora
Los datos ya están estructurados en el Excel. No se requiere procesamiento semántico.  
**Extensión futura posible:** agente de análisis de tendencias (Claude) sobre los datos históricos.

---

## 3. Estructura de Carpetas del Proyecto

```
PROYECTOS_ACTIVOS\
├── PLAN_DESARROLLO.md          ← este archivo
├── schema.sql                  ← DDL PostgreSQL (Módulo A + B)
├── diagram.md                  ← ER Diagram Mermaid
│
├── backend\                    ── FastAPI :5010 ──────────────────────────────
│   ├── app.py                  ← entry point standalone (dev sin portal)
│   ├── router.py               ← router FastAPI (montable inline en gateway)
│   ├── models.py               ← SQLAlchemy ORM models
│   ├── schemas.py              ← Pydantic response schemas
│   ├── crud.py                 ← queries de base de datos
│   ├── database.py             ← engine + session factory
│   ├── config.py               ← settings desde .env
│   ├── .env                    ← DATABASE_URL, PORT (gitignored)
│   ├── .env.example
│   └── requirements.txt        ← fastapi, uvicorn, sqlalchemy, psycopg2-binary, python-dotenv
│
├── etl\                        ── Ingesta Excel → PostgreSQL ─────────────────
│   ├── ingest.py               ← CLI: python ingest.py --file "...xlsx" --period 2026-06
│   ├── parsers\
│   │   ├── __init__.py
│   │   ├── semaforo.py         ← parser de solapa SEMAFORO GENERAL
│   │   └── proyecto_real.py    ← parser genérico de solapas "[NOMBRE] REAL"
│   └── README.md               ← instrucciones de ingesta
│
└── frontend\                   ── React 19 + Vite :5011 ───────────────────────
    ├── index.html
    ├── package.json
    ├── vite.config.ts          ← port 5011, base /apps/proyectos-activos/, proxy → :5010
    ├── tsconfig.*.json
    └── src\
        ├── main.tsx
        ├── App.tsx             ← router interno: vista='semaforo'|'proyecto'
        ├── index.css           ← Design System tokens + estilos app
        ├── types.ts            ← ProyectoSemaforo, EjercicioEconomico, RecursoMensual, etc.
        ├── api\
        │   └── client.ts       ← wrappers para todos los endpoints
        ├── components\
        │   ├── Header.tsx      ← IN_PORTAL pattern + botón Salir/Volver
        │   ├── SemaforoChip.tsx← badge de color (verde/amarillo/naranja/rojo)
        │   ├── MetricCard.tsx  ← tarjeta KPI reutilizable
        │   └── TablaRecursos.tsx← tabla de empleados con costos
        └── pages\
            ├── SemaforoGeneral.tsx ← Pantalla 1 — dashboard de semáforo
            └── EjercicioEconomico.tsx← Pantalla 2 — detalle por proyecto
```

---

## 4. Modelo de Datos (Resumen)

### Módulo A — Core (Proyectos y Recursos)

```
clients → projects → resource_monthly_costs ← employees ← roles
                   ↘                        ← contract_types
                     project_financials
                   ↘
                     cost_centers (FK en resource_monthly_costs)
```

### Módulo B — Semáforo General

```
semaforo_monthly_metrics → projects (FK opcional)
semaforo_reference (tabla paramétrica de umbrales de color)
```

### Regla de umbrales de semáforo (de la planilla)
| Color | Resultado Real % |
|-------|-----------------|
| 🔴 Rojo | Hasta 4.99% |
| 🟠 Naranja | 5% — 13.99% |
| 🟡 Amarillo | 14% — 24.99% |
| 🟢 Verde claro | 25% — 30.99% |
| 🟢 Verde fuerte | ≥ 31% |

---

## 5. API Endpoints (Backend FastAPI :5010)

### Semáforo

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/semaforo?period=2026-06&type=acumulado` | Lista de proyectos con resultado y semáforo |
| GET | `/api/semaforo/metricas?period=2026-06` | Métricas del DC (bench, recursos, resultado comercial neto) |
| GET | `/api/semaforo/periodos` | Lista de períodos disponibles |
| GET | `/api/semaforo/referencia` | Umbrales de color del semáforo |

### Proyectos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/proyectos` | Lista todos los proyectos con cliente |
| GET | `/api/proyectos/{id}/ejercicio?period=2026-06` | Header + financials + recursos del período |
| GET | `/api/proyectos/{id}/historial` | Serie histórica: facturación, margen, resultado % |
| GET | `/api/proyectos/{id}/recursos?period=2026-06` | Tabla de empleados con costos del período |

---

## 6. Diseño de Pantallas Frontend

### Pantalla 1 — Semáforo General

```
┌─────────────────────────────────────────────────────────────────┐
│ [CFO]  CFOTech IT Tools          Proyectos Activos    [Salir]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SEMÁFORO GENERAL — ACUMULADO JUNIO 2026     [Jun 2026 ▾]      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ PROYECTO          TIPO     REAL    ESP    VAR%   ACCIÓN  │   │
│  │ ● IRSA VENTAS     Proy    44.7%  23.5%  +21.2%  ——      │   │
│  │ ● INFOBAE SOPORTE Proy    66.1%  68.2%   -2.2%  ——      │   │
│  │ ● CLARO VENTAS    Proy    25.7%  22.6%   +3.1%  ——      │   │
│  │ ● COOPERATIVA     Proy     0.0%  39.0%  -39.0%  ⚠ Plan  │   │
│  │  ...                                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ Res Comercial│ │ Neto Bench  │ │ Recursos DC │               │
│  │  $111.3M    │ │   $87.7M   │ │     61      │               │
│  │   26.5%     │ │   20.9%    │ │  10 en Bench│               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│                                                                  │
│  SEMÁFORO MENSUAL — JUNIO 2026                                  │
│  [tabla mensual similar, con datos del mes]                      │
└─────────────────────────────────────────────────────────────────┘
```

### Pantalla 2 — Ejercicio Económico (drill-down)

```
┌─────────────────────────────────────────────────────────────────┐
│ [CFO]  CFOTech IT Tools    [← Semáforo]  IRSA VENTAS  [Salir]  │
├─────────────────────────────────────────────────────────────────┤
│  Cliente: IRSA   │  CeCo: 2 035 00 - DC - IRSA VENTAS          │
│  ─────────────────────────────────────────────────────────      │
│  RESULTADO: 44.7% ●  │  Facturación: $60.6M  │  Jun 2026       │
│                                                                  │
│  RECURSOS DEL MES                                               │
│  ┌──────┬──────────────────┬──────────┬───────┬─────────────┐  │
│  │ DNI  │ Nombre           │ Perfil   │ Horas │ Costo Total │  │
│  │ 2787 │ LOPEPE, Leonardo │ Tech Lead│  130  │  $5.66M     │  │
│  │ 3432 │ PORTO, Lucas     │ Tech Lead│  160  │  $6.81M     │  │
│  │ ...  │ ...              │ ...      │  ...  │ ...         │  │
│  └──────┴──────────────────┴──────────┴───────┴─────────────┘  │
│                                                                  │
│  FINANCIERO                                                      │
│  Precio venta c/IVA: $73.3M   Comisión: $1.8M   Peaje: 1%     │
│  Precio mensual: $60.6M        Resultado: $27.1M  (44.7%)      │
│                                                                  │
│  HISTORIAL                                                       │
│  [Línea: Facturación vs Resultado %  — 4 meses]                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Fases de Desarrollo

### Fase 0 — Base de Datos y ETL (Esta sesión)
- [x] Análisis del Excel (`Proyectos Activos 2026.xlsx`)
- [ ] `schema.sql` — DDL PostgreSQL completo
- [ ] `diagram.md` — ER en Mermaid
- [ ] `etl/ingest.py` — estructura del script de ingesta
- [ ] `etl/parsers/semaforo.py` y `proyecto_real.py`

### Fase 1 — Backend FastAPI
- [ ] `backend/models.py` — ORM SQLAlchemy
- [ ] `backend/crud.py` — queries (semáforo, proyecto, recursos, historial)
- [ ] `backend/router.py` — endpoints REST
- [ ] `backend/schemas.py` — Pydantic response models
- [ ] Health check + shutdown endpoint
- [ ] CORS para `:5011` + `:5174`

### Fase 2 — Frontend React
- [ ] Setup Vite + TypeScript + Recharts
- [ ] `SemaforoGeneral.tsx` — tabla con badges de color + métricas KPI
- [ ] `EjercicioEconomico.tsx` — tabla recursos + financiero + historial
- [ ] `SemaforoChip.tsx` — componente badge con lógica de umbrales
- [ ] `Header.tsx` — IN_PORTAL pattern + navegación interna
- [ ] `client.ts` — wrappers tipados de todos los endpoints

### Fase 3 — Integración Portal
- [ ] Entrada en `src/registry/apps.ts`
- [ ] Entrada en `portal_server.py` APPS dict
- [ ] `ALLOWED_APP_ORIGINS` en `App.tsx`
- [ ] Tests Vitest: `registry.test.ts` + `components.test.tsx`
- [ ] IN_PORTAL postMessage para Salir

---

## 8. Configuración de Entorno

### Backend (`.env`)
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/proyectos_activos
PORT=5010
CORS_ORIGINS=http://localhost:5011,http://localhost:5174
```

### Frontend (`.env`)
```
VITE_API_URL=           # vacío → usa /api/proyectos-activos via gateway
VITE_PORTAL_URL=http://localhost:5174
```

### PostgreSQL
```powershell
# Instalar PostgreSQL 16 si no está instalado
# Crear base de datos
psql -U postgres -c "CREATE DATABASE proyectos_activos;"
psql -U postgres -d proyectos_activos -f schema.sql
```

---

## 9. Registro en el Portal

```typescript
// src/registry/apps.ts
{
  id:          'proyectos-activos',
  name:        'Proyectos Activos',
  description: 'Semáforo general y ejercicio económico por proyecto',
  icon:        '📈',
  url:         '/apps/proyectos-activos/',
  type:        'iframe',
  iconBg:      '#EEF8F4',
  iconColor:   '#00A878',
  tags:        ['Finanzas', 'Proyectos', 'Rentabilidad'],
  status:      'coming-soon',   // cambiar a 'active' al terminar Fase 2
  category:    'Finanzas',
}
```

---

## 10. Preguntas Abiertas / Decisiones Pendientes

| # | Pregunta | Impacto |
|---|----------|---------|
| 1 | ¿PostgreSQL ya está instalado en la máquina? | Fase 0 — prerequisito |
| 2 | ¿El Excel se ingesta manualmente (ETL manual) o hay que automatizar la ingesta mensual? | ETL scheduler vs. botón manual en la app |
| 3 | ¿La app debe permitir **editar** datos o solo leer? | Define si necesitamos endpoints PUT/POST |
| 4 | ¿Los proyectos nuevos (como PELLEGRINI sin solapa REAL) se muestran? | Lógica de proyectos sin datos |
| 5 | ¿El filtro de período debe ser por mes o se muestra siempre el último disponible? | UX del selector de período |

---

*Próximo paso: implementar `schema.sql`, `diagram.md` y la estructura del ETL.*
