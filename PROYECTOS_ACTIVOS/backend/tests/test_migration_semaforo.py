"""Verifica que la migración agrega las columnas project_label y tipo."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'etl'))
import psycopg2
from ingest import get_db_url, ensure_semaforo_columns


def _columns(cur, table):
    cur.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name=%s",
        (table,),
    )
    return {r[0] for r in cur.fetchall()}


def test_ensure_semaforo_columns_adds_project_label_and_tipo():
    conn = psycopg2.connect(get_db_url())
    try:
        ensure_semaforo_columns(conn)
        with conn.cursor() as cur:
            cols = _columns(cur, 'semaforo_monthly_metrics')
        assert 'project_label' in cols
        assert 'tipo' in cols
    finally:
        conn.close()
