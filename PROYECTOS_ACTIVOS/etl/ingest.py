"""
ingest.py — ETL principal: Excel → PostgreSQL

Uso:
    python ingest.py --file "Proyectos Activos 2026.xlsx" --period 2026-06
    python ingest.py --file "Proyectos Activos 2026.xlsx" --dry-run

Pasos:
    1. Parsear solapa SEMAFORO GENERAL
    2. Parsear todas las solapas [NOMBRE] REAL
    3. Upsert de entidades maestras (clients, projects, roles, contract_types, cost_centers, employees)
    4. Insert de datos transaccionales (resource_monthly_costs, project_financials, project_monthly_history)
    5. Insert de semaforo_monthly_metrics
"""

from __future__ import annotations
import argparse
import os
import sys
from datetime import datetime
from typing import Optional

# Agregar el directorio padre al path para importar los parsers
sys.path.insert(0, os.path.dirname(__file__))

from parsers.semaforo     import parse_semaforo_general
from parsers.proyecto_real import parse_all_real_sheets, ProyectoReal

try:
    import psycopg2
    from psycopg2.extras import execute_values
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False
    print('[WARN] psycopg2 no encontrado. Ejecutar: pip install psycopg2-binary')


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def get_db_url() -> str:
    """Lee DATABASE_URL del entorno o .env del backend."""
    # Intentar leer del .env del backend
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


# ---------------------------------------------------------------------------
# Helpers de upsert
# ---------------------------------------------------------------------------

def upsert_client(cur, name: str) -> int:
    """Inserta o actualiza un cliente. Retorna su id."""
    cur.execute("""
        INSERT INTO clients (name)
        VALUES (%s)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
    """, (name,))
    return cur.fetchone()[0]


def upsert_project(cur, client_id: int, name: str, sheet_name: str, tipo: str = 'Proy') -> int:
    cur.execute("""
        INSERT INTO projects (client_id, name, sheet_name, tipo)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (sheet_name) DO UPDATE
            SET name = EXCLUDED.name,
                client_id = EXCLUDED.client_id,
                tipo = EXCLUDED.tipo
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
        INSERT INTO roles (name)
        VALUES (%s)
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    """, (name,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("SELECT id FROM roles WHERE name = %s", (name,))
    return cur.fetchone()[0]


def upsert_contract_type(cur, description: str) -> int:
    cur.execute("""
        INSERT INTO contract_types (description)
        VALUES (%s)
        ON CONFLICT (description) DO NOTHING
        RETURNING id
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
            SET first_name = EXCLUDED.first_name,
                last_name  = EXCLUDED.last_name,
                role_id    = EXCLUDED.role_id,
                contract_type_id = EXCLUDED.contract_type_id
    """, (dni, first_name, last_name, role_id, contract_type_id))


# ---------------------------------------------------------------------------
# Ingesta principal
# ---------------------------------------------------------------------------

def ingest_proyecto_real(cur, pr: ProyectoReal, dry_run: bool = False) -> None:
    """Inserta todos los datos de un ProyectoReal en la base de datos."""

    # 1. Upsert cliente y proyecto
    if dry_run:
        print(f'  [DRY] Upsert cliente: {pr.header.client_name}')
        print(f'  [DRY] Upsert proyecto: {pr.header.project_name} ({pr.header.sheet_name})')
        return

    client_id  = upsert_client(cur, pr.header.client_name or 'DESCONOCIDO')
    project_id = upsert_project(cur, client_id, pr.header.project_name, pr.header.sheet_name)

    # CeCo del header
    if pr.header.code_ceco:
        upsert_cost_center(cur, pr.header.code_ceco)

    # 2. Recursos
    for res in pr.resources:
        # Entidades maestras del recurso
        role_id            = upsert_role(cur, res.role_name or 'Sin Perfil')
        contract_type_id   = upsert_contract_type(cur, res.contract_type or 'RELAC DEPEND')
        upsert_employee(cur, res.dni, res.first_name, res.last_name, role_id, contract_type_id)

        # CeCo del recurso
        ceco = res.code_ceco or pr.header.code_ceco or 'SIN_CECO'
        upsert_cost_center(cur, ceco)

        # Costo mensual
        cur.execute("""
            INSERT INTO resource_monthly_costs (
                employee_dni, project_id, code_ceco, period_date,
                total_hours, months_worked, monthly_hours, extra_hours,
                monthly_salary, total_monthly_cost, monthly_resource_cost,
                extra_hours_cost, extra_hours_ratio
            ) VALUES (%s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s, %s,%s)
            ON CONFLICT (employee_dni, project_id, period_date) DO UPDATE SET
                code_ceco            = EXCLUDED.code_ceco,
                total_hours          = EXCLUDED.total_hours,
                months_worked        = EXCLUDED.months_worked,
                monthly_hours        = EXCLUDED.monthly_hours,
                extra_hours          = EXCLUDED.extra_hours,
                monthly_salary       = EXCLUDED.monthly_salary,
                total_monthly_cost   = EXCLUDED.total_monthly_cost,
                monthly_resource_cost = EXCLUDED.monthly_resource_cost,
                extra_hours_cost     = EXCLUDED.extra_hours_cost,
                extra_hours_ratio    = EXCLUDED.extra_hours_ratio
        """, (
            res.dni, project_id, ceco, pr.header.period_date,
            res.total_hours, res.months_worked, res.monthly_hours, res.extra_hours,
            res.monthly_salary, res.total_monthly_cost, res.monthly_resource_cost,
            res.extra_hours_cost, res.extra_hours_ratio,
        ))

    # 3. Financiero
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
                revenue                  = EXCLUDED.revenue,
                sale_price_with_vat      = EXCLUDED.sale_price_with_vat,
                monthly_sale_price       = EXCLUDED.monthly_sale_price,
                commercial_margin_value  = EXCLUDED.commercial_margin_value,
                result_percentage        = EXCLUDED.result_percentage,
                commercial_commission    = EXCLUDED.commercial_commission,
                peaje_wht_percentage     = EXCLUDED.peaje_wht_percentage,
                peaje_wht_value          = EXCLUDED.peaje_wht_value,
                semaforo_value           = EXCLUDED.semaforo_value,
                project_result           = EXCLUDED.project_result
        """, (
            project_id, pr.header.period_date,
            f.monthly_sale_price, f.sale_price_with_vat, f.monthly_sale_price,
            0.0, f.result_percentage,
            f.commercial_commission, f.peaje_wht_percentage, f.peaje_wht_value,
            f.semaforo_value, f.project_result,
        ))

    # 4. Historial mensual
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


def run_ingestion(excel_path: str, dry_run: bool = False) -> None:
    """Punto de entrada principal del ETL."""
    print(f'\n{"="*60}')
    print(f'ETL Proyectos Activos — {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print(f'Archivo: {excel_path}')
    print(f'Modo:    {"DRY RUN (sin escritura)" if dry_run else "PRODUCCIÓN"}')
    print('='*60)

    # 1. Parsear semáforo
    print('\n[1/3] Parseando SEMAFORO GENERAL...')
    semaforo = parse_semaforo_general(excel_path)
    print(f'      → {len(semaforo.acumulado_rows)} proyectos acumulado')
    print(f'      → {len(semaforo.mensual_rows)} proyectos mensual')

    # 2. Parsear solapas REAL
    print('\n[2/3] Parseando solapas REAL...')
    proyectos = parse_all_real_sheets(excel_path)
    print(f'      → {len(proyectos)} solapas encontradas')
    for p in proyectos:
        n_res  = len(p.resources)
        n_hist = len(p.history)
        print(f'      · {p.header.sheet_name}: {n_res} recursos, {n_hist} filas historial')

    if dry_run:
        print('\n[DRY RUN] No se escribió nada en la base de datos.')
        return

    if not HAS_PSYCOPG2:
        print('\n[ERROR] psycopg2 no instalado. Ejecutar: pip install psycopg2-binary')
        sys.exit(1)

    # 3. Escribir en la base de datos
    print('\n[3/3] Escribiendo en PostgreSQL...')
    db_url = get_db_url()
    conn = psycopg2.connect(db_url)
    try:
        with conn:
            with conn.cursor() as cur:
                for pr in proyectos:
                    print(f'  → {pr.header.project_name}')
                    ingest_proyecto_real(cur, pr, dry_run=False)

                # Semáforo (simplificado — lógica completa en Fase 1 del backend)
                print('  → Semáforo (pendiente: requiere IDs de proyectos ya insertados)')

        print('\n✅ Ingesta completada exitosamente.')
    except Exception as e:
        conn.rollback()
        print(f'\n❌ Error durante la ingesta: {e}')
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='ETL: Excel Proyectos Activos → PostgreSQL'
    )
    parser.add_argument(
        '--file', '-f',
        default=os.path.join(os.path.dirname(__file__), '..', 'Proyectos Activos 2026.xlsx'),
        help='Path al archivo Excel',
    )
    parser.add_argument(
        '--period', '-p',
        default=None,
        help='Período a procesar (YYYY-MM). Si no se especifica, se detecta del archivo.',
    )
    parser.add_argument(
        '--dry-run', '-n',
        action='store_true',
        help='Parsea sin escribir en la base de datos',
    )
    args = parser.parse_args()

    run_ingestion(
        excel_path = args.file,
        dry_run    = args.dry_run,
    )
