-- =============================================================================
-- schema.sql — Proyectos Activos CFOTech
-- PostgreSQL 16 · Normalización 3FN
-- Basado en: Proyectos Activos 2026.xlsx
--
-- Módulo A: CORE  — Clientes, proyectos, recursos, costos mensuales
-- Módulo B: SEMÁFORO GENERAL — Métricas de control y umbrales de referencia
--
-- Ejecución:
--   psql -U postgres -d proyectos_activos -f schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensiones
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid() disponible


-- ===========================================================================
-- MÓDULO A: CORE
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- clients
-- Entidad raíz: el cliente que contrata los proyectos.
-- Ejemplos: IRSA, CLARO, ANDREANI, ICBC, INFOBAE, STELLANTIS …
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS resource_monthly_costs CASCADE;
DROP TABLE IF EXISTS project_financials       CASCADE;
DROP TABLE IF EXISTS project_monthly_history  CASCADE;
DROP TABLE IF EXISTS employees               CASCADE;
DROP TABLE IF EXISTS cost_centers            CASCADE;
DROP TABLE IF EXISTS roles                   CASCADE;
DROP TABLE IF EXISTS contract_types          CASCADE;
DROP TABLE IF EXISTS projects                CASCADE;
DROP TABLE IF EXISTS clients                 CASCADE;
DROP TABLE IF EXISTS semaforo_monthly_metrics CASCADE;
DROP TABLE IF EXISTS semaforo_reference      CASCADE;

-- ---------------------------------------------------------------------------
CREATE TABLE clients (
    id          SERIAL          PRIMARY KEY,
    name        VARCHAR(120)    NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT uq_clients_name UNIQUE (name)
);

COMMENT ON TABLE  clients      IS 'Empresa cliente. Ej: IRSA, CLARO, ANDREANI.';
COMMENT ON COLUMN clients.name IS 'Nombre canónico del cliente (sin sufijos de proyecto).';


-- ---------------------------------------------------------------------------
-- projects
-- Un cliente puede tener múltiples proyectos.
-- El nombre del proyecto coincide con el nombre de la solapa (sin " REAL").
-- ---------------------------------------------------------------------------
CREATE TABLE projects (
    id           SERIAL          PRIMARY KEY,
    client_id    INT             NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    name         VARCHAR(200)    NOT NULL,
    sheet_name   VARCHAR(200)    NOT NULL,   -- nombre exacto de la solapa en el Excel (sin " REAL")
    tipo         VARCHAR(30)     NOT NULL DEFAULT 'Proy'
                                 CHECK (tipo IN ('Proy','Capacity','Factory')),
    is_active    BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT uq_projects_sheet UNIQUE (sheet_name)
);

COMMENT ON TABLE  projects            IS 'Proyecto/cuenta del cliente.';
COMMENT ON COLUMN projects.sheet_name IS 'Nombre de la solapa Excel sin el sufijo " REAL". Clave de lookup del ETL.';
COMMENT ON COLUMN projects.tipo       IS 'Proy = proyecto de precio fijo/TM, Capacity = modelo de capacidad, Factory = factory.';


-- ---------------------------------------------------------------------------
-- cost_centers
-- Centro de costo (CeCo) al que se imputa el recurso dentro del proyecto.
-- PK natural: el código textual tal como aparece en la planilla.
-- Ejemplos: "2 035 00 - DC - IRSA VENTAS", "2 048 00 - DC - COOP"
-- ---------------------------------------------------------------------------
CREATE TABLE cost_centers (
    code_ceco   VARCHAR(80)     PRIMARY KEY,
    name_ceco   VARCHAR(200)    NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  cost_centers           IS 'Centro de costo contable. PK es el código textual de la planilla.';
COMMENT ON COLUMN cost_centers.code_ceco IS 'Código completo: "2 035 00 - DC - IRSA VENTAS". Usado como FK en resource_monthly_costs.';


-- ---------------------------------------------------------------------------
-- roles
-- Perfil / rol del empleado. Ej: Tech Lead, Developer React, QA Manual …
-- ---------------------------------------------------------------------------
CREATE TABLE roles (
    id      SERIAL          PRIMARY KEY,
    name    VARCHAR(100)    NOT NULL,
    CONSTRAINT uq_roles_name UNIQUE (name)
);

COMMENT ON TABLE roles IS 'Perfil técnico del recurso. Ej: Tech Lead, Developer NodeJS, PMO Analyst.';


-- ---------------------------------------------------------------------------
-- contract_types
-- Tipo de contratación. Ej: RELAC DEPEND, MONOTRIBUTISTA, PASANTE …
-- ---------------------------------------------------------------------------
CREATE TABLE contract_types (
    id          SERIAL          PRIMARY KEY,
    description VARCHAR(60)     NOT NULL,
    CONSTRAINT uq_contract_types_desc UNIQUE (description)
);

COMMENT ON TABLE contract_types IS 'Modalidad contractual del empleado.';


-- ---------------------------------------------------------------------------
-- employees
-- Personas físicas que trabajan en proyectos.
-- PK = DNI (identificador único en Argentina).
-- ---------------------------------------------------------------------------
CREATE TABLE employees (
    dni                 VARCHAR(20)     PRIMARY KEY,
    first_name          VARCHAR(100)    NOT NULL,
    last_name           VARCHAR(100)    NOT NULL,
    role_id             INT             NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    contract_type_id    INT             NOT NULL REFERENCES contract_types(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE  employees     IS 'Recursos humanos del Delivery Center. PK = DNI.';
COMMENT ON COLUMN employees.dni IS 'DNI argentino del empleado (sin puntos). PK natural.';

-- Trigger updated_at
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_employees_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION _set_updated_at();


-- ---------------------------------------------------------------------------
-- resource_monthly_costs
-- Costo mensual de cada empleado en un proyecto/CeCo en un período dado.
-- Fuente: solapas "[NOMBRE_PROYECTO] REAL" del Excel.
-- Una fila = un empleado × un proyecto × un período (mes/año).
-- ---------------------------------------------------------------------------
CREATE TABLE resource_monthly_costs (
    id                      BIGSERIAL       PRIMARY KEY,
    employee_dni            VARCHAR(20)     NOT NULL REFERENCES employees(dni)      ON DELETE RESTRICT,
    project_id              INT             NOT NULL REFERENCES projects(id)         ON DELETE RESTRICT,
    code_ceco               VARCHAR(80)     NOT NULL REFERENCES cost_centers(code_ceco) ON DELETE RESTRICT,
    period_date             DATE            NOT NULL,   -- siempre primer día del mes (2026-06-01)

    -- Horas
    total_hours             NUMERIC(8,2)    NOT NULL DEFAULT 0,   -- #HORAS totales facturadas
    months_worked           NUMERIC(4,2)    NOT NULL DEFAULT 1,   -- # MESES
    monthly_hours           NUMERIC(8,2)    NOT NULL DEFAULT 0,   -- #HS MES
    extra_hours             NUMERIC(8,2)    NOT NULL DEFAULT 0,   -- HS EXTRAS

    -- Costos (ARS)
    monthly_salary          NUMERIC(15,2)   NOT NULL DEFAULT 0,   -- SALARIO mensual
    total_monthly_cost      NUMERIC(15,2)   NOT NULL DEFAULT 0,   -- COSTO MENS TOTALES (con cargas)
    monthly_resource_cost   NUMERIC(15,2)   NOT NULL DEFAULT 0,   -- COSTO LABORAL MENSUAL imputable al proyecto
    extra_hours_cost        NUMERIC(15,2)   NOT NULL DEFAULT 0,   -- COSTO HS EXTRA
    extra_hours_ratio       NUMERIC(5,4)    NOT NULL DEFAULT 0,   -- PROPORHS HS EXTRA (ratio 0-1)

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT uq_resource_monthly UNIQUE (employee_dni, project_id, period_date)
);

COMMENT ON TABLE  resource_monthly_costs                   IS 'Costo mensual de cada recurso asignado a un proyecto. Fuente: solapas REAL del Excel.';
COMMENT ON COLUMN resource_monthly_costs.period_date       IS 'Primer día del mes de imputación. Ej: 2026-06-01.';
COMMENT ON COLUMN resource_monthly_costs.extra_hours_ratio IS 'Proporción de horas extra sobre horas normales. Rango 0-1 (puede superar 1 ocasionalmente).';

CREATE INDEX idx_rmc_project_period  ON resource_monthly_costs (project_id, period_date);
CREATE INDEX idx_rmc_employee        ON resource_monthly_costs (employee_dni);
CREATE INDEX idx_rmc_period          ON resource_monthly_costs (period_date);


-- ---------------------------------------------------------------------------
-- project_financials
-- Datos financieros del proyecto para un período dado.
-- Una fila = un proyecto × un período (mes/año).
-- Fuente: bloque financiero al pie de cada solapa "[NOMBRE] REAL".
-- ---------------------------------------------------------------------------
CREATE TABLE project_financials (
    id                          BIGSERIAL       PRIMARY KEY,
    project_id                  INT             NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    period_date                 DATE            NOT NULL,   -- primer día del mes

    -- Precio y facturación
    revenue                     NUMERIC(15,2)   NOT NULL DEFAULT 0,   -- PRECIO VENTA MENSUAL
    sale_price_with_vat         NUMERIC(15,2)   NOT NULL DEFAULT 0,   -- PRECIO VENTA C/IVA
    monthly_sale_price          NUMERIC(15,2)   NOT NULL DEFAULT 0,   -- PRECIO VENTA MENSUAL (neto IVA)

    -- Márgenes
    commercial_margin_value     NUMERIC(15,2)   NOT NULL DEFAULT 0,   -- valor absoluto del margen
    result_percentage           NUMERIC(6,4)    NOT NULL DEFAULT 0,   -- RESULTADO % (0.4467 = 44.67%)

    -- Deducciones
    commercial_commission       NUMERIC(15,2)   NOT NULL DEFAULT 0,   -- COMISION COMERCIAL ($)
    peaje_wht_percentage        NUMERIC(5,4)    NOT NULL DEFAULT 0,   -- PEAJE/WHT %
    peaje_wht_value             NUMERIC(15,2)   NOT NULL DEFAULT 0,   -- PEAJE/WHT $ calculado

    -- Semáforo
    semaforo_value              NUMERIC(6,4)    NOT NULL DEFAULT 0,   -- igual a result_percentage en la planilla
    project_result              NUMERIC(15,2)   NOT NULL DEFAULT 0,   -- RESULTADO PROYECTO ($)

    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT uq_project_financials UNIQUE (project_id, period_date)
);

COMMENT ON TABLE  project_financials                  IS 'Resumen financiero mensual del proyecto. Una fila por proyecto × período.';
COMMENT ON COLUMN project_financials.result_percentage IS 'Resultado porcentual real. Almacenado como decimal: 0.4467 = 44.67%.';
COMMENT ON COLUMN project_financials.semaforo_value    IS 'Valor de semáforo (igual a result_percentage en la lógica actual de la planilla).';

CREATE INDEX idx_pf_project_period ON project_financials (project_id, period_date);
CREATE INDEX idx_pf_period         ON project_financials (period_date);


-- ---------------------------------------------------------------------------
-- project_monthly_history
-- Serie histórica de facturación y resultado por proyecto.
-- Fuente: tabla "ACUMULADO / mes" al pie de cada solapa "[NOMBRE] REAL".
-- Permite graficar tendencia mensual sin recalcular desde resource_monthly_costs.
-- ---------------------------------------------------------------------------
CREATE TABLE project_monthly_history (
    id                   BIGSERIAL       PRIMARY KEY,
    project_id           INT             NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    period_date          DATE            NOT NULL,
    is_cumulative        BOOLEAN         NOT NULL DEFAULT FALSE,   -- TRUE = fila ACUMULADO

    billing              NUMERIC(15,2)   NOT NULL DEFAULT 0,   -- Facturación del período
    commercial_margin    NUMERIC(15,2)   NOT NULL DEFAULT 0,   -- Margen comercial ($)
    result_percentage    NUMERIC(6,4)    NOT NULL DEFAULT 0,   -- Resultado % (decimal)

    created_at           TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT uq_pmh_project_period_cum UNIQUE (project_id, period_date, is_cumulative)
);

COMMENT ON TABLE  project_monthly_history               IS 'Serie histórica de facturación y resultado. Base para gráficos de tendencia.';
COMMENT ON COLUMN project_monthly_history.is_cumulative IS 'TRUE para la fila ACUMULADO del Excel; FALSE para cada mes individual.';

CREATE INDEX idx_pmh_project ON project_monthly_history (project_id, period_date);


-- ===========================================================================
-- MÓDULO B: SEMÁFORO GENERAL
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- semaforo_monthly_metrics
-- Una fila por proyecto × período × tipo de semáforo.
-- Fuente: solapa SEMAFORO GENERAL — cuadros ACUMULADO y MENSUAL.
-- ---------------------------------------------------------------------------
CREATE TABLE semaforo_monthly_metrics (
    id                                          BIGSERIAL       PRIMARY KEY,
    project_id                                  INT             REFERENCES projects(id) ON DELETE RESTRICT,
    period_date                                 DATE            NOT NULL,
    semaforo_type                               VARCHAR(60)     NOT NULL,
                                                                -- 'ACUMULADO' | 'MENSUAL'

    -- Columnas del cuadro izquierdo (por proyecto)
    resultado_real                              NUMERIC(6,4),   -- RES REAL decimal
    resultado_esperado                          NUMERIC(6,4),   -- Res. Esperado decimal
    variacion_pct                               NUMERIC(7,4),   -- Variación % (puede ser negativa)
    accion_sugerida                             VARCHAR(200),   -- texto de la columna Acción

    -- Columnas del cuadro derecho (facturación de referencia, por proyecto)
    facturacion_teorica                         NUMERIC(15,2),
    facturacion_real                            NUMERIC(15,2),
    resultado_teorico                           NUMERIC(15,2),
    resultado_real_valor                        NUMERIC(15,2),  -- $ absoluto del resultado real
    resultado_esperado_valor                    NUMERIC(15,2),  -- Res Esp $

    -- Métricas del Delivery Center (solo para filas consolidadas)
    resultado_comercial                         NUMERIC(15,2),
    resultado_comercial_pct                     NUMERIC(6,4),
    resultado_comercial_neto_bench              NUMERIC(15,2),
    resultado_comercial_neto_bench_pct          NUMERIC(6,4),
    costo_total_bench                           NUMERIC(15,2),
    costo_bench_manpower                        NUMERIC(15,2),
    costo_bench_dc                              NUMERIC(15,2),
    resultado_comercial_neto_bench_dc           NUMERIC(15,2),
    resultado_comercial_neto_bench_dc_pct       NUMERIC(6,4),
    recursos_delivery_center                    INT,
    total_recursos_bench                        INT,
    participacion_bench_en_nomina               NUMERIC(5,4),
    bench_mpw                                   NUMERIC(5,4),
    bench_dc                                    NUMERIC(5,4),

    created_at                                  TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT uq_semaforo_metrics UNIQUE (project_id, period_date, semaforo_type)
);

COMMENT ON TABLE  semaforo_monthly_metrics                     IS 'Métricas del semáforo por proyecto y período. Fuente: solapa SEMAFORO GENERAL.';
COMMENT ON COLUMN semaforo_monthly_metrics.semaforo_type       IS '"ACUMULADO" = cuadro acumulado del año; "MENSUAL" = cuadro del mes corriente.';
COMMENT ON COLUMN semaforo_monthly_metrics.project_id          IS 'NULL para las filas de métricas globales del DC (resultado comercial, bench, etc.).';
COMMENT ON COLUMN semaforo_monthly_metrics.resultado_real      IS 'Resultado real como decimal. Ej: 0.4467 = 44.67%.';

CREATE INDEX idx_smm_period      ON semaforo_monthly_metrics (period_date);
CREATE INDEX idx_smm_project     ON semaforo_monthly_metrics (project_id);
CREATE INDEX idx_smm_type_period ON semaforo_monthly_metrics (semaforo_type, period_date);


-- ---------------------------------------------------------------------------
-- semaforo_reference
-- Tabla paramétrica: umbrales de color del semáforo.
-- Extraídos del cuadro "SEMAFORO DE REFERENCIA" de la planilla.
-- ---------------------------------------------------------------------------
CREATE TABLE semaforo_reference (
    id              SERIAL          PRIMARY KEY,
    color_label     VARCHAR(30)     NOT NULL,   -- 'rojo' | 'naranja' | 'amarillo' | 'verde_claro' | 'verde'
    color_hex       VARCHAR(7)      NOT NULL,   -- color CSS para el frontend
    threshold_min   NUMERIC(5,4)    NOT NULL,   -- límite inferior (inclusive)
    threshold_max   NUMERIC(5,4),               -- límite superior (exclusive) — NULL = sin límite superior
    description     VARCHAR(200)    NOT NULL,
    sort_order      INT             NOT NULL,
    CONSTRAINT uq_semaforo_ref_label UNIQUE (color_label)
);

COMMENT ON TABLE semaforo_reference IS 'Umbrales de color del semáforo. Fuente: cuadro SEMAFORO DE REFERENCIA en la planilla.';

-- Datos iniciales extraídos del Excel
INSERT INTO semaforo_reference (color_label, color_hex, threshold_min, threshold_max, description, sort_order) VALUES
('rojo',        '#FC8181', 0.0000,  0.0500, 'Resultado Real % Hasta 4.99%',      1),
('naranja',     '#F6AD55', 0.0500,  0.1400, 'Desde 5% a 13.99%',                2),
('amarillo',    '#F6E05E', 0.1400,  0.1600, 'Desde 14% a 15.99%',               3),
('verde_claro', '#9AE6B4', 0.1600,  0.2500, 'Desde 16% a 24.99%',               4),
('verde_medio', '#68D391', 0.2500,  0.3100, 'Desde 25% a 30.99%',               5),
('verde',       '#38A169', 0.3100,  NULL,   'Más de 31%',                        6);

COMMENT ON TABLE semaforo_reference IS 'Umbrales del semáforo visual. Ajustar según actualizaciones de la planilla.';


-- ===========================================================================
-- VISTAS AUXILIARES
-- ===========================================================================

-- Vista: semáforo enriquecido con color (join con referencia de umbrales)
CREATE OR REPLACE VIEW vw_semaforo_con_color AS
SELECT
    smm.id,
    smm.period_date,
    smm.semaforo_type,
    p.name          AS proyecto_name,
    p.tipo          AS proyecto_tipo,
    c.name          AS cliente_name,
    smm.resultado_real,
    smm.resultado_esperado,
    smm.variacion_pct,
    smm.accion_sugerida,
    smm.facturacion_real,
    smm.resultado_real_valor,
    sr.color_label,
    sr.color_hex,
    sr.description  AS semaforo_descripcion
FROM semaforo_monthly_metrics smm
LEFT JOIN projects   p  ON p.id  = smm.project_id
LEFT JOIN clients    c  ON c.id  = p.client_id
LEFT JOIN semaforo_reference sr
       ON smm.resultado_real >= sr.threshold_min
      AND (sr.threshold_max IS NULL OR smm.resultado_real < sr.threshold_max);

COMMENT ON VIEW vw_semaforo_con_color IS 'Semáforo por proyecto con color calculado por rango de resultado.';


-- Vista: costo total de recursos por proyecto y período
CREATE OR REPLACE VIEW vw_costos_proyecto_periodo AS
SELECT
    rmc.project_id,
    p.name              AS proyecto_name,
    c.name              AS cliente_name,
    rmc.period_date,
    COUNT(rmc.id)       AS cantidad_recursos,
    SUM(rmc.total_hours)                AS total_horas,
    SUM(rmc.monthly_salary)             AS suma_salarios,
    SUM(rmc.total_monthly_cost)         AS costo_total_mensual,
    SUM(rmc.monthly_resource_cost)      AS costo_imputable_proyecto,
    SUM(rmc.extra_hours_cost)           AS costo_hs_extra
FROM resource_monthly_costs rmc
JOIN projects p ON p.id = rmc.project_id
JOIN clients  c ON c.id = p.client_id
GROUP BY rmc.project_id, p.name, c.name, rmc.period_date;

COMMENT ON VIEW vw_costos_proyecto_periodo IS 'Resumen de costos de recursos agrupado por proyecto y período.';


-- ===========================================================================
-- FIN DEL SCHEMA
-- ===========================================================================
