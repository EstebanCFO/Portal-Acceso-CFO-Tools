"""
test_injection.py
-----------------
Suite de tests para validar que una inyección (import) de Excel
fue ejecutada correctamente y no corrompió la base de datos.

Puede correr:
  - Manualmente:  python scripts/test_injection.py
  - Via hook:     automáticamente después de import_excel.py
  - Modo verbose: python scripts/test_injection.py --verbose

Exit code: 0 = todos OK | 1 = hay fallos
"""

import argparse
import io
import sqlite3
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

DB_PATH = Path(__file__).parent.parent / "db" / "bandas_salariales.db"

# ─────────────────────────────────────────────────────────────────────────────
# Mini framework de tests
# ─────────────────────────────────────────────────────────────────────────────

class TestResult:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []

    def ok(self, nombre: str, detalle: str = ""):
        self.passed.append((nombre, detalle))

    def fail(self, nombre: str, motivo: str):
        self.failed.append((nombre, motivo))

    def warn(self, nombre: str, mensaje: str):
        self.warnings.append((nombre, mensaje))

    @property
    def total(self):
        return len(self.passed) + len(self.failed)

    def imprimir(self, verbose: bool = False):
        linea = "─" * 56
        print(f"\n{linea}")
        print("  TEST DE INYECCION — Bandas Salariales")
        print(linea)

        for nombre, detalle in self.passed:
            msg = f"  ✓ {nombre}"
            if verbose and detalle:
                msg += f"\n      {detalle}"
            print(msg)

        for nombre, motivo in self.failed:
            print(f"  ✗ {nombre}")
            print(f"      → {motivo}")

        for nombre, mensaje in self.warnings:
            print(f"  ⚠ {nombre}")
            print(f"      → {mensaje}")

        print(linea)
        estado = "TODOS OK" if not self.failed else f"{len(self.failed)} FALLO(S)"
        print(f"  Resultado: {len(self.passed)}/{self.total} passed  |  {estado}")
        if self.warnings:
            print(f"  Advertencias: {len(self.warnings)}")
        print(f"{linea}\n")


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

def run_tests(db_path: Path = DB_PATH, verbose: bool = False) -> TestResult:
    r = TestResult()

    # ── T01: La base de datos existe ──────────────────────────────────────────
    if not db_path.exists():
        r.fail("T01: BD existe", f"No se encontró: {db_path}")
        r.imprimir(verbose)
        return r
    r.ok("T01: BD existe", str(db_path))

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # ── T02: Hay al menos un registro en importaciones ────────────────────────
    total_imports = conn.execute("SELECT COUNT(*) FROM importaciones").fetchone()[0]
    if total_imports == 0:
        r.fail("T02: Existe al menos 1 import", "La tabla importaciones está vacía")
    else:
        r.ok("T02: Existe al menos 1 import", f"{total_imports} import(s) registrado(s)")

    # ── T03: Último import tiene registros en bandas_salariales ──────────────
    ultimo = conn.execute(
        "SELECT id, periodo, fecha_carga, total_registros FROM importaciones "
        "ORDER BY id DESC LIMIT 1"
    ).fetchone()

    if ultimo is None:
        r.fail("T03: Último import tiene datos", "No hay imports")
    else:
        conteo_real = conn.execute(
            "SELECT COUNT(*) FROM bandas_salariales WHERE import_id = ?",
            (ultimo["id"],)
        ).fetchone()[0]

        if conteo_real == 0:
            r.fail(
                "T03: Último import tiene datos",
                f"Import ID={ultimo['id']} ({ultimo['fecha_carga']}) no tiene filas en bandas_salariales"
            )
        elif ultimo["total_registros"] != conteo_real:
            r.fail(
                "T03: Conteo consistente",
                f"importaciones.total_registros={ultimo['total_registros']} "
                f"pero bandas_salariales tiene {conteo_real} filas"
            )
        else:
            r.ok(
                "T03: Último import tiene datos",
                f"Import ID={ultimo['id']} | {ultimo['fecha_carga']} | "
                f"{conteo_real} registros | período {ultimo['periodo']}"
            )

    # ── T04: No hay CUILs nulos en el último import ───────────────────────────
    if ultimo:
        nulos = conn.execute(
            "SELECT COUNT(*) FROM bandas_salariales "
            "WHERE import_id = ? AND (cuil IS NULL OR cuil = '')",
            (ultimo["id"],)
        ).fetchone()[0]
        if nulos > 0:
            r.fail("T04: Sin CUILs nulos", f"{nulos} fila(s) sin CUIL en el último import")
        else:
            r.ok("T04: Sin CUILs nulos")

    # ── T05: No hay CUILs duplicados dentro del mismo import ─────────────────
    if ultimo:
        duplicados = conn.execute(
            "SELECT cuil, COUNT(*) AS cnt FROM bandas_salariales "
            "WHERE import_id = ? GROUP BY cuil HAVING cnt > 1",
            (ultimo["id"],)
        ).fetchall()
        if duplicados:
            lista = ", ".join(d["cuil"] for d in duplicados[:5])
            r.fail("T05: Sin CUILs duplicados", f"CUILs repetidos: {lista}")
        else:
            r.ok("T05: Sin CUILs duplicados")

    # ── T06: remuneracion ≈ salario_bruto + internet + fact_cash ─────────────
    if ultimo:
        tolerancia = 1.0  # $1 de margen por redondeos
        inconsistentes = conn.execute(
            """
            SELECT cuil, apellidos, remuneracion,
                   ROUND(salario_bruto + internet + fact_cash, 2) AS calculada
            FROM   bandas_salariales
            WHERE  import_id = ?
              AND  salario_bruto IS NOT NULL
              AND  internet     IS NOT NULL
              AND  fact_cash    IS NOT NULL
              AND  ABS(remuneracion - (salario_bruto + internet + fact_cash)) > ?
            """,
            (ultimo["id"], tolerancia)
        ).fetchall()
        if inconsistentes:
            detalle = "; ".join(
                f"{row['apellidos']} rem={row['remuneracion']} calc={row['calculada']}"
                for row in inconsistentes[:3]
            )
            r.fail("T06: remuneracion = bruto+internet+fact_cash", detalle)
        else:
            r.ok("T06: remuneracion = bruto+internet+fact_cash")

    # ── T07: estado_vs_inf solo contiene valores válidos ─────────────────────
    if ultimo:
        valores_invalidos = conn.execute(
            """
            SELECT DISTINCT estado_vs_inf FROM bandas_salariales
            WHERE  import_id = ?
              AND  estado_vs_inf IS NOT NULL
              AND  estado_vs_inf NOT IN ('OK', 'REVISAR')
            """,
            (ultimo["id"],)
        ).fetchall()
        if valores_invalidos:
            vals = [v["estado_vs_inf"] for v in valores_invalidos]
            r.fail("T07: estado_vs_inf válido", f"Valores inesperados: {vals}")
        else:
            r.ok("T07: estado_vs_inf válido (OK | REVISAR | NULL)")

    # ── T08: var_pct tiene formato correcto ('%' o 'EN BANDA' o NULL) ─────────
    if ultimo:
        mal_formato = conn.execute(
            """
            SELECT COUNT(*) FROM bandas_salariales
            WHERE  import_id = ?
              AND  var_pct IS NOT NULL
              AND  var_pct != 'EN BANDA'
              AND  var_pct NOT LIKE '%\%%' ESCAPE '\\'
            """,
            (ultimo["id"],)
        ).fetchone()[0]
        if mal_formato > 0:
            r.fail("T08: var_pct formato correcto", f"{mal_formato} filas con formato inválido")
        else:
            r.ok("T08: var_pct formato correcto")

    # ── T09: lim_inferior < lim_superior donde ambos no son NULL ─────────────
    if ultimo:
        invertidos = conn.execute(
            """
            SELECT COUNT(*) FROM bandas_salariales
            WHERE  import_id = ?
              AND  lim_inferior IS NOT NULL
              AND  lim_superior IS NOT NULL
              AND  lim_inferior >= lim_superior
            """,
            (ultimo["id"],)
        ).fetchone()[0]
        if invertidos > 0:
            r.fail("T09: lim_inferior < lim_superior", f"{invertidos} fila(s) con bandas invertidas")
        else:
            r.ok("T09: lim_inferior < lim_superior")

    # ── T10: Historial — no hay pérdida de snapshots anteriores ──────────────
    if total_imports > 1:
        counts = conn.execute(
            "SELECT import_id, COUNT(*) AS cnt FROM bandas_salariales GROUP BY import_id"
        ).fetchall()
        vacios = [str(c["import_id"]) for c in counts if c["cnt"] == 0]
        if vacios:
            r.fail("T10: Historial íntegro", f"Import IDs sin datos: {', '.join(vacios)}")
        else:
            r.ok(
                "T10: Historial íntegro",
                f"{total_imports} snapshots con datos"
            )
    else:
        r.ok("T10: Historial íntegro", "Solo hay 1 snapshot (aún no hay historial comparativo)")

    # ── T11: Warning si hay más del 60% en REVISAR ────────────────────────────
    if ultimo:
        row = conn.execute(
            """
            SELECT
                COUNT(*) FILTER (WHERE estado_vs_inf = 'REVISAR') AS revisar,
                COUNT(*) FILTER (WHERE estado_vs_inf IS NOT NULL)  AS con_banda
            FROM bandas_salariales WHERE import_id = ?
            """,
            (ultimo["id"],)
        ).fetchone()
        if row["con_banda"] > 0:
            pct_revisar = row["revisar"] / row["con_banda"]
            if pct_revisar > 0.6:
                r.warn(
                    "T11: % REVISAR alto",
                    f"{row['revisar']}/{row['con_banda']} empleados en REVISAR "
                    f"({pct_revisar:.0%}) — revisar si las bandas están actualizadas"
                )
            else:
                r.ok(
                    "T11: % REVISAR aceptable",
                    f"{row['revisar']}/{row['con_banda']} en REVISAR ({pct_revisar:.0%})"
                )

    conn.close()
    return r


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Valida la última inyección de Excel en la base de datos."
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Mostrar detalles de cada test que pasa."
    )
    parser.add_argument(
        "--db", default=None,
        help="Ruta alternativa a la BD SQLite."
    )
    args = parser.parse_args()

    db = Path(args.db) if args.db else DB_PATH
    resultado = run_tests(db_path=db, verbose=args.verbose)
    resultado.imprimir(verbose=args.verbose)

    sys.exit(0 if not resultado.failed else 1)


if __name__ == "__main__":
    main()
