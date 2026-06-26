"""
ingest.py — ETL principal: Excel → PostgreSQL

Uso:
    python ingest.py --file "Proyectos Activos 2026.xlsx"
    python ingest.py --file "Proyectos Activos 2026.xlsx" --dry-run

Retorna stats dict cuando se llama vía ingest_from_file().
"""

from __future__ import annotations
import argparse
import os
import sys
from datetime import datetime
from typing import Optional

sys.path.insert(0, os.path.dirname(__file__))

from parsers.semaforo      import parse_semaforo_general, SemaforoRow
from parsers.proyecto_real import parse_all_real_sheets, ProyectoReal

try:
    import psycopg2
    from psycopg2.extras import execute_values
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False


# ── Config ────────────────────────────────────────────────────────────────────

def get_db_url() -> str:
    env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('DATABASE_URL='):
                    return line.split('=', 1)[1].strip()
    return os.environ.get(
        'DATABASE_URL',
        'postgresql://postgres:postgres@localhost:5432/proyectos_activos'
    )


# ── Upserts de entidades maestras ─────────────────────────────────────────────

def upsert_client(cur, name: str) -> int:
    cur.execute("""
        INSERT INTO clients (name) VALUES (%s)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
    """, (name,))
    return cur.fetchone()[0]


def upsert_project(cur, client_id: int, name: str, sheet_name: str, tipo: str = 'Proy') -> int:
    cur.execute("""
        INSERT INTO projects (client_id, name, sheet_name, tipo)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (sheet_name) DO UPDATE
            SET name      = EXCLUDED.name,
                client_id = EXCLUDED.client_id,
                tipo      = EXCLUDED.tipo
        RETURNING id
    """, (client_id, name, sheet_name, tipo))
    return cur.fetchone()[0]


def upsert_cost_center(cur, code_ceco: str) -> None:
    cur.execute("""
        INSERT INTO cost_centers (code_ceco, name_ceco)
        VALUES (%s, %s)
        ON CONFLICT (code_ceco) DO NOTHING
    """, (code_ceco, code_ceco))


def upsert_role(cur, name: str) -> int:
    cur.execute("""
        INSERT INTO roles (name) VALUES (%s)
        ON CONFLICT (name) DO NOTHING RETURNING id
    """, (name,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("SELECT id FROM roles WHERE name = %s", (name,))
    return cur.fetchone()[0]


def upsert_contract_type(cur, description: str) -> int:
    cur.execute("""
        INSERT INTO contract_types (description) VALUES (%s)
        ON CONFLICT (description) DO NOTHING RETURNING id
    """, (description,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("SELECT id FROM contract_types WHERE description = %s", (description,))
    return cur.fetchone()[0]


def upsert_employee(cur, dni: str, first_name: str, last_name: str,
                    role_id: int, contract_type_id: int) -> None:
    cur.execute("""
        INSERT INTO employees (dni, first_name, last_name, role_id, contract_type_id)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (dni) DO UPDATE
            SET first_name       = EXCLUDED.first_name,
                last_name        = EXCLUDED.last_name,
                role_id          = EXCLUDED.role_id,
                contract_type_id = EXCLUDED.contract_type_id
    """, (dni, first_name, last_name, role_id, contract_type_id))


# ── Ingesta de una solapa REAL ────────────────────────────────────────────────

def ingest_proyecto_real(cur, pr: ProyectoReal) -> int:
    """Inserta todos los datos de un ProyectoReal. Retorna el project_id."""
    client_id  = upsert_client(cur, pr.header.client_name or 'DESCONOCIDO')
    project_id = upsert_project(cur, client_id, pr.header.project_name, pr.header.sheet_name)

    if pr.header.code_ceco:
        upsert_cost_center(cur, pr.header.code_ceco)

    for res in pr.resources:
        role_id          = upsert_role(cur, res.role_name or 'Sin Perfil')
        contract_type_id = upsert_contract_type(cur, res.contract_type or 'RELAC DEPEND')
        upsert_employee(cur, res.dni, res.first_name, res.last_name, role_id, contract_type_id)

        ceco = res.code_ceco or pr.header.code_ceco or 'SIN_CECO'
        upsert_cost_center(cur, ceco)

        cur.execute("""
            INSERT INTO resource_monthly_costs (
                employee_dni, project_id, code_ceco, period_date,
                total_hours, months_worked, monthly_hours, extra_hours,
                monthly_salary, total_monthly_cost, monthly_resource_cost,
                extra_hours_cost, extra_hours_ratio
            ) VALUES (%s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s, %s,%s)
            ON CONFLICT (employee_dni, project_id, period_date) DO UPDATE SET
                code_ceco             = EXCLUDED.code_ceco,
                total_hours           = EXCLUDED.total_hours,
                months_worked         = EXCLUDED.months_worked,
                monthly_hours         = EXCLUDED.monthly_hours,
                extra_hours           = EXCLUDED.extra_hours,
                monthly_salary        = EXCLUDED.monthly_salary,
                total_monthly_cost    = EXCLUDED.total_monthly_cost,
                monthly_resource_cost = EXCLUDED.monthly_resource_cost,
                extra_hours_cost      = EXCLUDED.extra_hours_cost,
                extra_hours_ratio     = EXCLUDED.extra_hours_ratio
        """, (
            res.dni, project_id, ceco, pr.header.period_date,
            res.total_hours, res.months_worked, res.monthly_hours, res.extra_hours,
            res.monthly_salary, res.total_monthly_cost, res.monthly_resource_cost,
            res.extra_hours_cost, res.extra_hours_ratio,
        ))

    if pr.financials:
        f = pr.financials
        cur.execute("""
            INSERT INTO project_financials (
                project_id, period_date,
                revenue, sale_price_with_vat, monthly_sale_price,
                commercial_margin_value, result_percentage,
                commercial_commission, peaje_wht_percentage, peaje_wht_value,
                semaforo_value, project_result
            ) VALUES (%s,%s, %s,%s,%s, %s,%s, %s,%s,%s, %s,%s)
            ON CONFLICT (project_id, period_date) DO UPDATE SET
                revenue                 = EXCLUDED.revenue,
                sale_price_with_vat     = EXCLUDED.sale_price_with_vat,
                monthly_sale_price      = EXCLUDED.monthly_sale_price,
                commercial_margin_value = EXCLUDED.commercial_margin_value,
                result_percentage       = EXCLUDED.result_percentage,
                commercial_commission   = EXCLUDED.commercial_commission,
                peaje_wht_percentage    = EXCLUDED.peaje_wht_percentage,
                peaje_wht_value         = EXCLUDED.peaje_wht_value,
                semaforo_value          = EXCLUDED.semaforo_value,
                project_result          = EXCLUDED.project_result
        """, (
            project_id, pr.header.period_date,
            f.monthly_sale_price, f.sale_price_with_vat, f.monthly_sale_price,
            0.0, f.result_percentage,
            f.commercial_commission, f.peaje_wht_percentage, f.peaje_wht_value,
            f.semaforo_value, f.project_result,
        ))

    for h in pr.history:
        cur.execute("""
            INSERT INTO project_monthly_history (
                project_id, period_date, is_cumulative,
                billing, commercial_margin, result_percentage
            ) VALUES (%s,%s,%s, %s,%s,%s)
            ON CONFLICT (project_id, period_date, is_cumulative) DO UPDATE SET
                billing           = EXCLUDED.billing,
                commercial_margin = EXCLUDED.commercial_margin,
                result_percentage = EXCLUDED.result_percentage
        """, (
            project_id, h.period_date, h.is_cumulative,
            h.billing, h.commercial_margin, h.result_percentage,
        ))

    return project_id


# ── Inserción de Semáforo (resuelve IDs por nombre) ──────────────────────────

def insert_semaforo_rows(cur, rows: list[SemaforoRow], semaforo_type: str) -> dict:
    """
    Inserta filas del semáforo en semaforo_monthly_metrics.
    Resuelve project_id buscando por nombre exacto (case-insensitive).
    Retorna stats: { matched, unmatched, unmatched_names }
    """
    # Mapa nombre_upper → project_id
    cur.execute("SELECT id, UPPER(TRIM(name)) FROM projects WHERE name != ''")
    proj_map: dict[str, int] = {row[1]: row[0] for row in cur.fetchall()}

    matched   = 0
    unmatched = 0
    unmatched_names: list[str] = []

    for row in rows:
        key        = row.project_name.upper().strip()
        project_id = proj_map.get(key)

        if project_id is None:
            # Intentar coincidencia parcial (el nombre del semáforo puede ser subconjunto)
            for proj_name_upper, pid in proj_map.items():
                if key in proj_name_upper or proj_name_upper in key:
                    project_id = pid
                    break

        if project_id is None:
            unmatched += 1
            unmatched_names.append(row.project_name)
            continue

        cur.execute("""
            INSERT INTO semaforo_monthly_metrics (
                project_id, period_date, semaforo_type,
                resultado_real, resultado_esperado, variacion_pct,
                accion_sugerida, facturacion_real
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (project_id, period_date, semaforo_type) DO UPDATE SET
                resultado_real     = EXCLUDED.resultado_real,
                resultado_esperado = EXCLUDED.resultado_esperado,
                variacion_pct      = EXCLUDED.variacion_pct,
                accion_sugerida    = EXCLUDED.accion_sugerida,
                facturacion_real   = EXCLUDED.facturacion_real
        """, (
            project_id, row.period_date, semaforo_type,
            row.resultado_real, row.resultado_esperado, row.variacion_pct,
            row.accion_sugerida, row.facturacion_real,
        ))
        matched += 1

    return {'matched': matched, 'unmatched': unmatched, 'unmatched_names': unmatched_names}


def insert_dc_metrics(cur, dc, semaforo_type: str, period_date: str) -> None:
    """Inserta las métricas globales del DC (project_id = NULL)."""
    if dc is None:
        return
    cur.execute("""
        INSERT INTO semaforo_monthly_metrics (
            project_id, period_date, semaforo_type,
            resultado_comercial, resultado_comercial_pct,
            resultado_comercial_neto_bench, resultado_comercial_neto_bench_pct,
            costo_total_bench, costo_bench_manpower, costo_bench_dc,
            recursos_delivery_center, total_recursos_bench
        ) VALUES (NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (project_id, period_date, semaforo_type) DO NOTHING
    """, (
        period_date, semaforo_type,
        getattr(dc, 'resultado_comercial', None),
        getattr(dc, 'resultado_comercial_pct', None),
        getattr(dc, 'resultado_comercial_neto_bench', None),
        getattr(dc, 'resultado_comercial_neto_bench_pct', None),
        getattr(dc, 'costo_total_bench', None),
        getattr(dc, 'costo_bench_manpower', None),
        getattr(dc, 'costo_bench_dc', None),
        getattr(dc, 'recursos_delivery_center', None),
        getattr(dc, 'total_recursos_bench', None),
    ))


# ── Tabla de historial de cargas ──────────────────────────────────────────────

_CREATE_INGEST_UPLOADS = """
CREATE TABLE IF NOT EXISTS ingest_uploads (
    id          SERIAL PRIMARY KEY,
    period_date DATE             NOT NULL,
    uploaded_at TIMESTAMP        NOT NULL DEFAULT NOW()
);
"""


def ensure_ingest_uploads_table(conn) -> None:
    """Crea la tabla ingest_uploads si no existe (migración inline)."""
    with conn.cursor() as cur:
        cur.execute(_CREATE_INGEST_UPLOADS)
    conn.commit()


# ── Ingesta principal (retorna stats) ─────────────────────────────────────────

def ingest_from_file(excel_path: str, dry_run: bool = False) -> dict:
    """
    Corre el ETL completo y retorna un dict con estadísticas.
    Úsalo desde la API o tests — no imprime a stdout.
    """
    from parsers.semaforo      import parse_semaforo_general
    from parsers.proyecto_real import parse_all_real_sheets

    semaforo  = parse_semaforo_general(excel_path)
    proyectos = parse_all_real_sheets(excel_path)

    period_raw = semaforo.acumulado_rows[0].period_date if semaforo.acumulado_rows else None

    stats = {
        'semaforo_acumulado':  len(semaforo.acumulado_rows),
        'semaforo_mensual':    len(semaforo.mensual_rows),
        'solapas_real':        len(proyectos),
        'recursos_total':      sum(len(p.resources) for p in proyectos),
        'semaforo_matched':    0,
        'semaforo_unmatched':  0,
        'unmatched_names':     [],
        'dry_run':             dry_run,
        'period':              period_raw,
        'upload_ts':           None,
    }

    if dry_run:
        return stats

    if not HAS_PSYCOPG2:
        raise RuntimeError('psycopg2 no instalado: pip install psycopg2-binary')

    db_url     = get_db_url()
    conn       = psycopg2.connect(db_url)
    upload_now = datetime.now()

    try:
        # Migración: crea ingest_uploads si no existe
        ensure_ingest_uploads_table(conn)

        with conn:
            with conn.cursor() as cur:
                # 1. Solapas REAL (proyectos, recursos, financiero, historial)
                for pr in proyectos:
                    ingest_proyecto_real(cur, pr)

                # 2. Semáforo ACUMULADO
                st_acum = insert_semaforo_rows(cur, semaforo.acumulado_rows, 'ACUMULADO')
                stats['semaforo_matched']   += st_acum['matched']
                stats['semaforo_unmatched'] += st_acum['unmatched']
                stats['unmatched_names']    += st_acum['unmatched_names']

                # 3. Semáforo MENSUAL
                st_mens = insert_semaforo_rows(cur, semaforo.mensual_rows, 'MENSUAL')
                stats['semaforo_matched']   += st_mens['matched']
                stats['semaforo_unmatched'] += st_mens['unmatched']
                stats['unmatched_names']    += st_mens['unmatched_names']

                # 4. Métricas DC (project_id NULL)
                if semaforo.dc_metrics:
                    period = period_raw or '2026-01-01'
                    insert_dc_metrics(cur, semaforo.dc_metrics, 'ACUMULADO', period)
                    insert_dc_metrics(cur, semaforo.dc_metrics, 'MENSUAL',   period)

                # 5. Registrar carga en historial
                if period_raw:
                    cur.execute(
                        "INSERT INTO ingest_uploads (period_date, uploaded_at) VALUES (%s, %s)",
                        (period_raw, upload_now),
                    )

        conn.commit()
        stats['upload_ts'] = upload_now.strftime('%H:%M:%S')
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    return stats


# ── CLI (uso manual) ──────────────────────────────────────────────────────────

def run_ingestion(excel_path: str, dry_run: bool = False) -> None:
    """Wrapper CLI con prints."""
    print(f'\n{"="*60}')
    print(f'ETL Proyectos Activos — {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print(f'Archivo: {excel_path}')
    print(f'Modo:    {"DRY RUN (sin escritura)" if dry_run else "PRODUCCIÓN"}')
    print('='*60)

    from parsers.semaforo      import parse_semaforo_general
    from parsers.proyecto_real import parse_all_real_sheets

    semaforo  = parse_semaforo_general(excel_path)
    proyectos = parse_all_real_sheets(excel_path)

    print(f'\n[1/3] SEMAFORO GENERAL:')
    print(f'      → {len(semaforo.acumulado_rows)} proyectos acumulado')
    print(f'      → {len(semaforo.mensual_rows)} proyectos mensual')

    print(f'\n[2/3] Solapas REAL:')
    for p in proyectos:
        print(f'      · {p.header.sheet_name}: {len(p.resources)} recursos, {len(p.history)} historial')

    if dry_run:
        print('\n[DRY RUN] No se escribió nada en la base de datos.')
        return

    if not HAS_PSYCOPG2:
        print('\n[ERROR] psycopg2 no instalado.')
        sys.exit(1)

    print('\n[3/3] Escribiendo en PostgreSQL...')
    try:
        stats = ingest_from_file(excel_path, dry_run=False)
        print(f'  → {stats["solapas_real"]} proyectos REAL insertados')
        print(f'  → Semáforo: {stats["semaforo_matched"]} coincidentes, {stats["semaforo_unmatched"]} sin match')
        if stats['unmatched_names']:
            print(f'  → Sin match: {", ".join(stats["unmatched_names"])}')
        print('\n✅ Ingesta completada exitosamente.')
    except Exception as e:
        print(f'\n❌ Error: {e}')
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='ETL: Excel Proyectos Activos → PostgreSQL')
    parser.add_argument('--file', '-f',
        default=os.path.join(os.path.dirname(__file__), '..', 'Proyectos Activos 2026.xlsx'))
    parser.add_argument('--dry-run', '-n', action='store_true')
    args = parser.parse_args()
    run_ingestion(args.file, dry_run=args.dry_run)
