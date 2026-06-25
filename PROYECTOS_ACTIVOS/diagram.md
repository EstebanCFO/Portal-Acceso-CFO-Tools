# Diagrama Entidad-Relación — Proyectos Activos CFOTech

Generado en base a `schema.sql` y la estructura del Excel `Proyectos Activos 2026.xlsx`.

---

## ER Diagram (Mermaid)

```mermaid
erDiagram

    %% =========================================================
    %% MÓDULO A — CORE
    %% =========================================================

    clients {
        int     id          PK
        varchar name        "Ej: IRSA, CLARO, ANDREANI"
        ts      created_at
    }

    projects {
        int     id          PK
        int     client_id   FK
        varchar name        "Ej: IRSA VENTAS"
        varchar sheet_name  "Nombre exacto solapa Excel"
        varchar tipo        "Proy | Capacity | Factory"
        bool    is_active
    }

    cost_centers {
        varchar code_ceco   PK  "Ej: 2 035 00 - DC - IRSA VENTAS"
        varchar name_ceco
    }

    roles {
        int     id          PK
        varchar name        "Ej: Tech Lead, Developer React"
    }

    contract_types {
        int     id          PK
        varchar description "Ej: RELAC DEPEND, MONOTRIBUTISTA"
    }

    employees {
        varchar dni             PK  "DNI argentino"
        varchar first_name
        varchar last_name
        int     role_id         FK
        int     contract_type_id FK
    }

    resource_monthly_costs {
        bigint  id                  PK
        varchar employee_dni        FK
        int     project_id          FK
        varchar code_ceco           FK
        date    period_date         "Primer día del mes"
        numeric total_hours
        numeric months_worked
        numeric monthly_hours
        numeric extra_hours
        numeric monthly_salary
        numeric total_monthly_cost
        numeric monthly_resource_cost
        numeric extra_hours_cost
        numeric extra_hours_ratio
    }

    project_financials {
        bigint  id                  PK
        int     project_id          FK
        date    period_date
        numeric revenue
        numeric sale_price_with_vat
        numeric monthly_sale_price
        numeric commercial_margin_value
        numeric result_percentage       "Decimal: 0.4467 = 44.67%"
        numeric commercial_commission
        numeric peaje_wht_percentage
        numeric peaje_wht_value
        numeric semaforo_value
        numeric project_result
    }

    project_monthly_history {
        bigint  id              PK
        int     project_id      FK
        date    period_date
        bool    is_cumulative   "TRUE = fila ACUMULADO"
        numeric billing
        numeric commercial_margin
        numeric result_percentage
    }

    %% =========================================================
    %% MÓDULO B — SEMÁFORO GENERAL
    %% =========================================================

    semaforo_monthly_metrics {
        bigint  id                              PK
        int     project_id                      FK  "NULL = métrica global DC"
        date    period_date
        varchar semaforo_type                   "ACUMULADO | MENSUAL"
        numeric resultado_real                  "Decimal"
        numeric resultado_esperado
        numeric variacion_pct
        varchar accion_sugerida
        numeric facturacion_teorica
        numeric facturacion_real
        numeric resultado_teorico
        numeric resultado_real_valor
        numeric resultado_esperado_valor
        numeric resultado_comercial             "Solo métricas globales DC"
        numeric resultado_comercial_pct
        numeric resultado_comercial_neto_bench
        numeric costo_total_bench
        numeric costo_bench_manpower
        numeric costo_bench_dc
        int     recursos_delivery_center
        int     total_recursos_bench
        numeric participacion_bench_en_nomina
    }

    semaforo_reference {
        int     id              PK
        varchar color_label     "rojo|naranja|amarillo|verde_claro|verde_medio|verde"
        varchar color_hex       "Color CSS Ej: #FC8181"
        numeric threshold_min   "Límite inferior inclusive"
        numeric threshold_max   "Límite superior exclusive (NULL=sin límite)"
        varchar description
        int     sort_order
    }

    %% =========================================================
    %% RELACIONES
    %% =========================================================

    clients                ||--o{ projects                 : "tiene"
    projects               ||--o{ resource_monthly_costs   : "tiene recursos"
    projects               ||--o{ project_financials       : "tiene financiero"
    projects               ||--o{ project_monthly_history  : "tiene historial"
    projects               ||--o{ semaforo_monthly_metrics : "aparece en semáforo"
    employees              ||--o{ resource_monthly_costs   : "asignado a"
    roles                  ||--o{ employees                : "define perfil"
    contract_types         ||--o{ employees                : "define contrato"
    cost_centers           ||--o{ resource_monthly_costs   : "imputa en"
```

---

## Relaciones clave

| Relación | Cardinalidad | Descripción |
|----------|-------------|-------------|
| `clients` → `projects` | 1:N | Un cliente tiene N proyectos |
| `projects` → `resource_monthly_costs` | 1:N | Un proyecto tiene N imputaciones mensuales |
| `projects` → `project_financials` | 1:N | Un proyecto tiene un financiero por período |
| `projects` → `project_monthly_history` | 1:N | Un proyecto tiene N filas históricas |
| `projects` → `semaforo_monthly_metrics` | 1:N | Un proyecto aparece en N períodos del semáforo |
| `employees` → `resource_monthly_costs` | 1:N | Un empleado puede estar en N proyectos/períodos |
| `roles` → `employees` | 1:N | Un rol puede tener N empleados |
| `contract_types` → `employees` | 1:N | Un tipo de contrato para N empleados |
| `cost_centers` → `resource_monthly_costs` | 1:N | Un CeCo para N imputaciones |

---

## Inventario de solapas → tablas

| Solapa Excel | Tabla destino | Notas |
|---|---|---|
| `SEMAFORO GENERAL` | `semaforo_monthly_metrics` | Cuadros ACUMULADO + MENSUAL |
| `SEMAFORO GENERAL` (métricas DC) | `semaforo_monthly_metrics` (project_id=NULL) | Resultado comercial, bench |
| `SEMAFORO DE REFERENCIA` | `semaforo_reference` | Datos fijos, pre-cargados |
| `[NOMBRE] REAL` — header | `clients`, `projects`, `cost_centers` | Upsert en ingesta |
| `[NOMBRE] REAL` — filas de empleados | `employees`, `roles`, `contract_types`, `resource_monthly_costs` | Upsert por DNI |
| `[NOMBRE] REAL` — bloque financiero | `project_financials` | 1 fila por período |
| `[NOMBRE] REAL` — tabla histórica | `project_monthly_history` | Filas ACUMULADO + meses |
| `CONTRATOS DC`, `NOMINA DC` | (extensión futura) | No incluidas en este schema |
| `BENCH`, `PARAMETRIA`, `DATOS`, `KPI` | (extensión futura) | No incluidas en este schema |

---

## Proyectos detectados en el Excel

| Solapa proyecto | Solapa REAL | Cliente inferido |
|---|---|---|
| BCO DEL SOL T- | BCO DEL SOL T- REAL | BCO DEL SOL |
| IRSA VENTAS | IRSA VENTAS REAL | IRSA |
| IRSA SOPORTE COCHERAS | IRSA SOPORTE COCHERAS REAL | IRSA |
| ECONORENT | ECONORENT REAL | ECONORENT |
| UKENNEDY | UKENNEDY REAL | UKENNEDY |
| INFOBAE SOPORTE | INFOBAE SOPORTE REAL | INFOBAE |
| Andreani Warehouse | Andreani Warehouse REAL | ANDREANI |
| Andreani INT Y COM (ECO) | Andreani INT Y COM (ECO) REAL | ANDREANI |
| Andreani WOS | Andreani WOS REAL | ANDREANI |
| ICBC | ICBC REAL | ICBC |
| CLARO CML | CLARO CML REAL | CLARO |
| CLARO VENTAS | CLARO VENTAS REAL | CLARO |
| Cooperativa Union | Cooperativa Union REAL | COOPERATIVA UNION |
| Coop UNION SOPORTE | Coop UNION SOPORTE REAL | COOPERATIVA UNION |
| GRUPO Life | GRUPO Life REAL | GRUPO LIFE |
| PNET INT VISMA | PNET INT VISMA REAL | PNET |
| Stellantis | Stellantis REAL | STELLANTIS |
| BCO SUPERVIELLE | BCO SUPERVIELLE REAL | BCO SUPERVIELLE |
| IRSA NUEVO | *(sin solapa REAL — pendiente)* | IRSA |
| PELLEGRINI | *(sin solapa REAL — sin datos)* | PELLEGRINI |
