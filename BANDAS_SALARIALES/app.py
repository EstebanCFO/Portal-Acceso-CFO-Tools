"""
app.py  —  Bandas Salariales DC  |  Flask Web App
--------------------------------------------------
Levanta la interfaz web local para subir Excels e inspeccionar la BD.

Uso:
    python app.py
    Abre http://127.0.0.1:5000
"""

import io
import os
import sqlite3
import sys
import tempfile
import threading
from pathlib import Path

from flask import (Flask, flash, jsonify, redirect,
                   render_template, request, url_for)

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
DB_PATH    = BASE_DIR / "db" / "bandas_salariales.db"
SCRIPTS    = BASE_DIR / "scripts"

sys.path.insert(0, str(SCRIPTS))
from import_excel import importar_excel          # reutiliza el ETL existente

# ── App ────────────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = "bs-dc-cfotech-2026"           # para flash messages


# ── Helper: conexión DB ───────────────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def fmt_moneda(valor) -> str:
    """Formatea un float como '$ 2.350.000' estilo AR."""
    if valor is None:
        return "—"
    return f"$ {valor:,.0f}".replace(",", ".")


# ══════════════════════════════════════════════════════════════════════════════
# VISTAS
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/")
def dashboard():
    conn = get_db()

    # Último snapshot
    ultimo = conn.execute(
        "SELECT * FROM importaciones ORDER BY id DESC LIMIT 1"
    ).fetchone()

    kpis = {}
    imports = []

    if ultimo:
        iid = ultimo["id"]
        row = conn.execute(
            """
            SELECT
                COUNT(*)                                              AS total,
                COUNT(*) FILTER (WHERE estado_vs_inf = 'OK')         AS ok,
                COUNT(*) FILTER (WHERE estado_vs_inf = 'REVISAR')    AS revisar,
                COUNT(*) FILTER (WHERE estado_vs_inf IS NULL)        AS sin_banda,
                AVG(remuneracion)                                     AS rem_avg,
                MAX(remuneracion)                                     AS rem_max,
                MIN(remuneracion) FILTER (WHERE remuneracion > 0)    AS rem_min
            FROM bandas_salariales WHERE import_id = ?
            """,
            (iid,)
        ).fetchone()

        total = row["total"] or 1
        kpis = {
            "total":       row["total"],
            "ok":          row["ok"],
            "revisar":     row["revisar"],
            "sin_banda":   row["sin_banda"],
            "pct_ok":      round(row["ok"] / total * 100),
            "pct_revisar": round(row["revisar"] / total * 100),
            "pct_sin":     round(row["sin_banda"] / total * 100),
            "rem_avg":     fmt_moneda(row["rem_avg"]),
            "rem_max":     fmt_moneda(row["rem_max"]),
            "rem_min":     fmt_moneda(row["rem_min"]),
            "periodo":     ultimo["periodo"],
            "fecha_carga": ultimo["fecha_carga"],
        }

    imports = [dict(r) for r in conn.execute(
        "SELECT id, periodo, fecha_carga, total_registros, archivo_fuente "
        "FROM importaciones ORDER BY id DESC"
    ).fetchall()]

    conn.close()
    return render_template("dashboard.html", kpis=kpis, imports=imports, ultimo=ultimo)


@app.route("/tabla")
def tabla():
    conn = get_db()
    snapshots = [dict(r) for r in conn.execute(
        "SELECT id, periodo, fecha_carga FROM importaciones ORDER BY id DESC"
    ).fetchall()]

    import_id = request.args.get("import_id", type=int)
    if not import_id and snapshots:
        import_id = snapshots[0]["id"]

    conn.close()
    return render_template("tabla.html", snapshots=snapshots, import_id=import_id)


@app.route("/historial")
def historial():
    conn = get_db()
    snapshots = [dict(r) for r in conn.execute(
        "SELECT id, periodo, fecha_carga FROM importaciones ORDER BY id DESC"
    ).fetchall()]
    conn.close()

    id_a = request.args.get("a", type=int)
    id_b = request.args.get("b", type=int)

    return render_template("historial.html", snapshots=snapshots, id_a=id_a, id_b=id_b)


@app.route("/empleado")
def empleado():
    conn = get_db()
    cuil = request.args.get("cuil", "").strip()
    datos_empleado = None
    historial_rows = []

    if cuil:
        # Datos más recientes del empleado
        datos_empleado = conn.execute(
            """
            SELECT b.cuil, b.dni, b.apellidos, b.nombres,
                   b.ceco, b.fecha_ingreso, b.perfil, b.seniority
            FROM   bandas_salariales b
            JOIN   importaciones i ON b.import_id = i.id
            WHERE  b.cuil = ?
            ORDER  BY i.id DESC LIMIT 1
            """,
            (cuil,)
        ).fetchone()

        historial_rows = conn.execute(
            """
            SELECT i.fecha_carga, i.periodo,
                   b.remuneracion, b.salario_bruto, b.internet, b.fact_cash,
                   b.lim_inferior, b.lim_superior,
                   b.estado_vs_inf, b.estado_vs_sup, b.var_monto, b.var_pct,
                   b.perfil, b.seniority, b.ceco
            FROM   bandas_salariales b
            JOIN   importaciones i ON b.import_id = i.id
            WHERE  b.cuil = ?
            ORDER  BY i.fecha_carga ASC
            """,
            (cuil,)
        ).fetchall()
        historial_rows = [dict(r) for r in historial_rows]

    conn.close()
    return render_template(
        "empleado.html",
        cuil=cuil,
        datos=datos_empleado,
        historial=historial_rows,
    )


# ══════════════════════════════════════════════════════════════════════════════
# UPLOAD
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/upload", methods=["POST"])
def upload():
    archivo = request.files.get("excel")
    if not archivo or not archivo.filename:
        flash("No seleccionaste ningún archivo.", "warning")
        return redirect(url_for("dashboard"))

    nombre = archivo.filename
    if not nombre.lower().endswith(".xlsx"):
        flash("El archivo debe ser .xlsx", "danger")
        return redirect(url_for("dashboard"))

    # Guardar en carpeta temporal del proyecto (mismo directorio que la BD)
    tmp_dir = BASE_DIR / "db" / "_tmp"
    tmp_dir.mkdir(exist_ok=True)
    ruta_tmp = tmp_dir / nombre
    archivo.save(str(ruta_tmp))

    # Suprimir stdout del script ETL para no mezclar con Flask
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()

    resultado = None
    error_msg = None
    try:
        resultado = importar_excel(
            ruta_excel=ruta_tmp,
            db_path=DB_PATH,
        )
    except Exception as exc:
        error_msg = str(exc)
    finally:
        sys.stdout = old_stdout
        # Limpiar archivo temporal
        try:
            ruta_tmp.unlink()
        except Exception:
            pass

    if error_msg:
        flash(f"✗ Error al importar: {error_msg}", "danger")
    elif resultado and resultado.get("ya_existia"):
        flash(
            f"⚠ '{nombre}' ya fue importado el {resultado['fecha_carga']} "
            f"(import_id={resultado['import_id']}, {resultado['total']} registros). "
            "Si querés re-importar, usá el script con --forzar.",
            "warning",
        )
    else:
        flash(
            f"✓ Importación exitosa — {resultado['total']} empleados cargados "
            f"| Período {resultado['periodo']} | Fecha {resultado['fecha_carga']}",
            "success",
        )

    return redirect(url_for("dashboard"))


# ══════════════════════════════════════════════════════════════════════════════
# API JSON
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/snapshots")
def api_snapshots():
    conn = get_db()
    rows = conn.execute(
        "SELECT id, periodo, fecha_carga, total_registros FROM importaciones ORDER BY id DESC"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/tabla")
def api_tabla():
    import_id = request.args.get("import_id", type=int)
    if not import_id:
        return jsonify([])
    conn = get_db()
    rows = conn.execute(
        """
        SELECT cuil, apellidos, nombres, ceco, perfil, seniority,
               salario_bruto, internet, fact_cash, remuneracion,
               lim_inferior, lim_superior,
               estado_vs_inf, estado_vs_sup, var_monto, var_pct, gerencia
        FROM   bandas_salariales
        WHERE  import_id = ?
        ORDER  BY apellidos
        """,
        (import_id,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/empleado/<cuil>")
def api_empleado(cuil):
    conn = get_db()
    rows = conn.execute(
        """
        SELECT i.fecha_carga, i.periodo,
               b.remuneracion, b.salario_bruto, b.internet, b.fact_cash,
               b.lim_inferior, b.lim_superior,
               b.estado_vs_inf, b.var_pct, b.perfil, b.seniority
        FROM   bandas_salariales b
        JOIN   importaciones i ON b.import_id = i.id
        WHERE  b.cuil = ?
        ORDER  BY i.fecha_carga ASC
        """,
        (cuil,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/comparativo")
def api_comparativo():
    id_a = request.args.get("a", type=int)
    id_b = request.args.get("b", type=int)
    if not id_a or not id_b:
        return jsonify([])

    conn = get_db()
    # Obtener ambos snapshots y hacer el JOIN por CUIL
    rows = conn.execute(
        """
        SELECT
            COALESCE(a.cuil, b.cuil)           AS cuil,
            COALESCE(a.apellidos, b.apellidos)  AS apellidos,
            COALESCE(a.nombres, b.nombres)      AS nombres,
            COALESCE(a.perfil, b.perfil)        AS perfil,
            COALESCE(a.seniority, b.seniority)  AS seniority,
            a.remuneracion                      AS rem_a,
            b.remuneracion                      AS rem_b,
            a.estado_vs_inf                     AS estado_a,
            b.estado_vs_inf                     AS estado_b,
            a.var_pct                           AS var_pct_a,
            b.var_pct                           AS var_pct_b,
            CASE
                WHEN a.cuil IS NULL THEN 'ingreso'
                WHEN b.cuil IS NULL THEN 'egreso'
                ELSE 'continua'
            END AS movimiento
        FROM
            (SELECT * FROM bandas_salariales WHERE import_id = ?) a
            FULL OUTER JOIN
            (SELECT * FROM bandas_salariales WHERE import_id = ?) b
            ON a.cuil = b.cuil
        ORDER BY COALESCE(a.apellidos, b.apellidos)
        """,
        (id_a, id_b)
    ).fetchall()
    conn.close()

    result = []
    for r in rows:
        d = dict(r)
        # Calcular variación porcentual de remuneración
        if d["rem_a"] and d["rem_b"] and d["rem_a"] > 0:
            variacion = (d["rem_b"] - d["rem_a"]) / d["rem_a"] * 100
            d["variacion_pct"] = round(variacion, 1)
        else:
            d["variacion_pct"] = None
        result.append(d)

    return jsonify(result)


@app.route("/shutdown", methods=["POST"])
def shutdown():
    """Detiene el servidor Flask. Muestra una página de confirmación antes de salir."""
    def _exit():
        import time
        time.sleep(0.8)   # pequeña espera para que el navegador reciba la respuesta
        os._exit(0)

    threading.Thread(target=_exit, daemon=True).start()
    return render_template("shutdown.html"), 200


@app.route("/api/buscar-empleado")
def api_buscar_empleado():
    """Autocomplete: busca empleados por nombre o CUIL en el último snapshot."""
    q = request.args.get("q", "").strip().upper()
    if len(q) < 2:
        return jsonify([])
    conn = get_db()
    rows = conn.execute(
        """
        SELECT DISTINCT b.cuil, b.apellidos, b.nombres, b.perfil, b.seniority
        FROM   bandas_salariales b
        JOIN   importaciones i ON b.import_id = i.id
        WHERE  i.id = (SELECT MAX(id) FROM importaciones)
          AND  (UPPER(b.apellidos) LIKE ? OR UPPER(b.nombres) LIKE ? OR b.cuil LIKE ?)
        ORDER  BY b.apellidos
        LIMIT  10
        """,
        (f"%{q}%", f"%{q}%", f"%{q}%")
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # Verificar que la BD existe antes de arrancar
    if not DB_PATH.exists():
        print(f"⚠  Base de datos no encontrada en {DB_PATH}")
        print("   Ejecutá primero:  python scripts/import_excel.py <archivo.xlsx>")
        sys.exit(1)

    print("\n  Bandas Salariales DC — Web App")
    print(f"  Base de datos : {DB_PATH}")
    print("  URL           : http://127.0.0.1:5000\n")
    app.run(debug=True, host="127.0.0.1", port=5000)
