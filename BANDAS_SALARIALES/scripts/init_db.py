"""
init_db.py
----------
Crea el schema de la base de datos SQLite (idempotente).
Se puede ejecutar sola o es llamada automáticamente por import_excel.py.

Uso:
    python scripts/init_db.py
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "db" / "bandas_salariales.db"


def init_db(db_path: Path = DB_PATH) -> sqlite3.Connection:
    """Crea las tablas y la vista si no existen. Devuelve la conexión."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")  # mejor concurrencia

    cursor = conn.cursor()

    # ------------------------------------------------------------------
    # Tabla: importaciones
    # Registra cada carga de Excel con su fecha AÑO-MES-DIA.
    # ------------------------------------------------------------------
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS importaciones (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            periodo         TEXT    NOT NULL,
            anio            INTEGER NOT NULL,
            mes             INTEGER NOT NULL,
            dia             INTEGER NOT NULL,
            fecha_carga     TEXT    NOT NULL,
            archivo_fuente  TEXT    NOT NULL,
            total_registros INTEGER,
            UNIQUE(fecha_carga, archivo_fuente)
        );
    """)

    # ------------------------------------------------------------------
    # Tabla: bandas_salariales
    # Snapshot completo de empleados por carga. Nunca se modifica.
    # ------------------------------------------------------------------
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bandas_salariales (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            import_id       INTEGER NOT NULL REFERENCES importaciones(id),

            -- Identificación del empleado
            cuil            TEXT    NOT NULL,
            dni             TEXT,
            apellidos       TEXT,
            nombres         TEXT,

            -- Datos laborales al momento de la carga
            ceco            TEXT,
            fecha_ingreso   TEXT,
            perfil          TEXT,
            seniority       TEXT,

            -- Remuneración
            salario_bruto   REAL,
            internet        REAL,
            fact_cash       REAL,
            remuneracion    REAL,

            -- Banda salarial
            verif           TEXT,
            lim_inferior    REAL,
            lim_superior    REAL,
            estado_vs_inf   TEXT,
            estado_vs_sup   TEXT,
            var_monto       TEXT,
            var_pct         TEXT,
            gerencia        TEXT
        );
    """)

    # Índice para acelerar consultas por empleado o por carga
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_bs_cuil
        ON bandas_salariales(cuil);
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_bs_import
        ON bandas_salariales(import_id);
    """)

    # ------------------------------------------------------------------
    # Vista: v_ultima_carga
    # Muestra solo los registros del import más reciente.
    # ------------------------------------------------------------------
    cursor.execute("DROP VIEW IF EXISTS v_ultima_carga;")
    cursor.execute("""
        CREATE VIEW v_ultima_carga AS
        SELECT
            b.id,
            i.id        AS import_id,
            i.fecha_carga,
            i.periodo,
            b.cuil,
            b.dni,
            b.apellidos,
            b.nombres,
            b.ceco,
            b.fecha_ingreso,
            b.perfil,
            b.seniority,
            b.salario_bruto,
            b.internet,
            b.fact_cash,
            b.remuneracion,
            b.verif,
            b.lim_inferior,
            b.lim_superior,
            b.estado_vs_inf,
            b.estado_vs_sup,
            b.var_monto,
            b.var_pct,
            b.gerencia
        FROM   bandas_salariales b
        JOIN   importaciones i ON b.import_id = i.id
        WHERE  i.id = (SELECT MAX(id) FROM importaciones);
    """)

    # ------------------------------------------------------------------
    # Vista: v_historial_empleado
    # Todo el historial de todos los empleados, ordenado por fecha.
    # ------------------------------------------------------------------
    cursor.execute("DROP VIEW IF EXISTS v_historial_empleado;")
    cursor.execute("""
        CREATE VIEW v_historial_empleado AS
        SELECT
            i.fecha_carga,
            i.periodo,
            b.cuil,
            b.apellidos,
            b.nombres,
            b.ceco,
            b.perfil,
            b.seniority,
            b.salario_bruto,
            b.internet,
            b.fact_cash,
            b.remuneracion,
            b.lim_inferior,
            b.lim_superior,
            b.estado_vs_inf,
            b.estado_vs_sup,
            b.var_monto,
            b.var_pct
        FROM   bandas_salariales b
        JOIN   importaciones i ON b.import_id = i.id
        ORDER  BY b.cuil, i.fecha_carga;
    """)

    conn.commit()
    return conn


if __name__ == "__main__":
    conn = init_db()
    conn.close()
    print(f"✓ Schema inicializado en: {DB_PATH}")
