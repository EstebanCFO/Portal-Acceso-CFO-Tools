"""
import_excel.py
--------------
ETL: Lee un archivo Excel de Bandas Salariales e inserta su contenido
en la base de datos SQLite como un snapshot nuevo (append-only).

Cada ejecución genera un registro en `importaciones` con la fecha
AÑO-MES-DIA del momento de la carga, más todos los registros de
empleados en `bandas_salariales`.

Uso:
    python scripts/import_excel.py <ruta_al_excel>
    python scripts/import_excel.py <ruta_al_excel> --periodo 2026-07
    python scripts/import_excel.py <ruta_al_excel> --fecha 2026-07-01 --forzar
"""

import argparse
import io
import re
import sqlite3
import sys
from datetime import date
from pathlib import Path

# Forzar UTF-8 en stdout para Windows (evita UnicodeEncodeError con emojis/flechas)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import openpyxl

# Localización de archivos relativos a este script
SCRIPT_DIR = Path(__file__).parent
DB_PATH    = SCRIPT_DIR.parent / "db" / "bandas_salariales.db"

# Mapa de nombre de mes en español → número
MESES_ES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
    "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
    "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}


# ──────────────────────────────────────────────────────────────────────────────
# Helpers de limpieza de valores del Excel
# ──────────────────────────────────────────────────────────────────────────────

def limpiar_texto(valor) -> str | None:
    """Convierte a string, hace strip. Devuelve None si está vacío o es #N/D."""
    if valor is None:
        return None
    s = str(valor).strip()
    if s in ("", "#N/D", "#N/A", "None"):
        return None
    return s


def limpiar_real(valor) -> float | None:
    """
    Convierte a float limpiando formatos monetarios argentinos.
    Ej: "$ 2.350.000" → 2350000.0  |  "-$ 103.923" → -103923.0
    Devuelve None si no es convertible.
    """
    if valor is None:
        return None
    if isinstance(valor, (int, float)):
        return float(valor) if str(valor).strip() not in ("", "None") else None

    s = str(valor).strip()
    if s in ("", "#N/D", "#N/A", "None", "  ", " $ -   "):
        return None

    # Detectar signo negativo antes de cualquier limpieza
    negativo = s.startswith("-")

    # Quitar signos $, espacios, puntos de miles; reemplazar coma decimal si existe
    s = re.sub(r"[\$\s]", "", s)  # quitar $ y espacios
    s = s.replace("-", "")         # quitar guiones (ya capturamos el signo)
    # En formato argentino, el punto es separador de miles
    # Puede haber coma como decimal (poco probable aquí, pero se maneja)
    if "," in s:
        # Hay coma → separador decimal
        s = s.replace(".", "").replace(",", ".")
    else:
        # Solo puntos → separadores de miles
        s = s.replace(".", "")

    try:
        resultado = float(s)
        return -resultado if negativo else resultado
    except ValueError:
        return None


def limpiar_pct(valor) -> str | None:
    """
    Convierte el valor de la columna VAR% a texto legible.
    Excel almacena porcentajes como decimales (0.07 → '7%').
    Si ya es texto como 'EN BANDA' o '-7%', lo devuelve tal cual.
    """
    if valor is None:
        return None
    if isinstance(valor, (int, float)):
        pct = round(valor * 100, 1)
        # Mostrar sin decimales si el resultado es entero
        return f"{int(pct)}%" if pct == int(pct) else f"{pct}%"
    s = str(valor).strip()
    if s in ("", "#N/D", "#N/A", "None", "  "):
        return None
    return s


def extraer_periodo_de_nombre(nombre_archivo: str) -> str | None:
    """
    Intenta extraer el período del nombre del archivo.
    Ej: "Bandas Salariales Junio 2026 - DC.xlsx" → "2026-06"
    """
    nombre = nombre_archivo.lower()
    for mes_str, mes_num in MESES_ES.items():
        if mes_str in nombre:
            match = re.search(r"\b(20\d{2})\b", nombre)
            if match:
                anio = int(match.group(1))
                return f"{anio}-{mes_num:02d}"
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Función principal
# ──────────────────────────────────────────────────────────────────────────────

def importar_excel(
    ruta_excel: Path,
    periodo: str | None = None,
    fecha_carga: date | None = None,
    forzar: bool = False,
    db_path: Path = DB_PATH,
) -> dict:
    """
    Carga el Excel en la base de datos como un nuevo snapshot.

    Returns:
        dict con claves: import_id, total, periodo, fecha_carga
    """
    # Asegurar schema
    sys.path.insert(0, str(SCRIPT_DIR))
    from init_db import init_db
    conn = init_db(db_path)

    # ── Resolver período y fecha ───────────────────────────────────────────────
    nombre_archivo = ruta_excel.name

    if periodo is None:
        periodo = extraer_periodo_de_nombre(nombre_archivo)
        if periodo is None:
            raise ValueError(
                f"No se pudo extraer el período del nombre '{nombre_archivo}'.\n"
                "Pasá --periodo YYYY-MM manualmente."
            )

    if fecha_carga is None:
        fecha_carga = date.today()

    anio, mes = map(int, periodo.split("-"))
    dia = fecha_carga.day
    fecha_str = fecha_carga.isoformat()  # 'YYYY-MM-DD'

    # ── Anti-duplicado ─────────────────────────────────────────────────────────
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, total_registros FROM importaciones "
        "WHERE fecha_carga = ? AND archivo_fuente = ?",
        (fecha_str, nombre_archivo),
    )
    existente = cursor.fetchone()
    if existente and not forzar:
        conn.close()
        print(
            f"\n⚠ Este archivo ya fue importado el {fecha_str} "
            f"(import_id={existente[0]}, registros={existente[1]}).\n"
            "  Usá --forzar si querés cargar de nuevo."
        )
        return {"import_id": existente[0], "total": existente[1],
                "periodo": periodo, "fecha_carga": fecha_str, "ya_existia": True}

    # Si --forzar y ya existia, borrar el snapshot anterior antes de reinsertar
    if existente and forzar:
        old_id = existente[0]
        cursor.execute("DELETE FROM bandas_salariales WHERE import_id = ?", (old_id,))
        cursor.execute("DELETE FROM importaciones WHERE id = ?", (old_id,))
        conn.commit()
        print(f"  [forzar] Borrado snapshot anterior (import_id={old_id})")

    # ── Leer Excel ────────────────────────────────────────────────────────────
    print(f"\n→ Abriendo: {ruta_excel.name}")
    wb = openpyxl.load_workbook(ruta_excel, data_only=True)
    ws = wb.active

    filas = list(ws.iter_rows(values_only=True))
    # Fila 1 = encabezados, desde fila 2 son datos
    datos = filas[1:]  # excluir header

    # ── Insertar en importaciones ──────────────────────────────────────────────
    cursor.execute(
        """
        INSERT INTO importaciones
            (periodo, anio, mes, dia, fecha_carga, archivo_fuente, total_registros)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (periodo, anio, mes, dia, fecha_str, nombre_archivo, 0),
    )
    import_id = cursor.lastrowid

    # ── Insertar registros de empleados ───────────────────────────────────────
    insertados = 0
    errores = []

    for num_fila, fila in enumerate(datos, start=2):
        # Expandir a 20 columnas si la fila es más corta
        fila = list(fila) + [None] * (20 - len(fila))

        cuil = limpiar_texto(fila[0])
        if not cuil:
            continue  # fila vacía

        try:
            cursor.execute(
                """
                INSERT INTO bandas_salariales (
                    import_id, cuil, dni, apellidos, nombres,
                    ceco, fecha_ingreso, perfil, seniority,
                    salario_bruto, internet, fact_cash, remuneracion,
                    verif, lim_inferior, lim_superior,
                    estado_vs_inf, estado_vs_sup, var_monto, var_pct, gerencia
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?, ?
                )
                """,
                (
                    import_id,
                    cuil,
                    limpiar_texto(fila[1]),   # DNI
                    limpiar_texto(fila[2]),   # APELLIDOS
                    limpiar_texto(fila[3]),   # NOMBRES
                    limpiar_texto(fila[4]),   # CECO
                    limpiar_texto(fila[5]),   # F INGRESO
                    limpiar_texto(fila[6]),   # PERFIL
                    limpiar_texto(fila[7]),   # SEÑORITY
                    limpiar_real(fila[8]),    # S BRUTO
                    limpiar_real(fila[9]),    # Internet
                    limpiar_real(fila[10]),   # FACT/CASH
                    limpiar_real(fila[11]),   # REMUN
                    limpiar_texto(fila[12]),  # VERIF
                    limpiar_real(fila[13]),   # LIM INFERIOR
                    limpiar_real(fila[15]),   # LIM SUPERIOR
                    limpiar_texto(fila[14]),  # VAR VS INF (estado)
                    limpiar_texto(fila[16]),  # VAR VS SUP (estado)
                    limpiar_texto(fila[17]),  # VAR MONTO
                    limpiar_pct(fila[18]),    # VAR PCT
                    limpiar_texto(fila[19]),  # Gerencia
                ),
            )
            insertados += 1
        except Exception as exc:
            errores.append(f"Fila {num_fila}: {exc}")

    # Actualizar conteo en importaciones
    cursor.execute(
        "UPDATE importaciones SET total_registros = ? WHERE id = ?",
        (insertados, import_id),
    )

    conn.commit()
    conn.close()
    wb.close()

    # ── Resumen ───────────────────────────────────────────────────────────────
    print(f"""
╔══════════════════════════════════════════════════╗
║           IMPORT COMPLETADO ✓                    ║
╠══════════════════════════════════════════════════╣
  Archivo   : {nombre_archivo}
  Período   : {periodo}
  Fecha     : {fecha_str}  ({anio}-{mes:02d}-{dia:02d})
  Registros : {insertados}
  Import ID : {import_id}
  Base de datos: {db_path}
╚══════════════════════════════════════════════════╝""")

    if errores:
        print(f"\n⚠ {len(errores)} filas con errores:")
        for e in errores:
            print(f"   {e}")

    return {
        "import_id": import_id,
        "total": insertados,
        "periodo": periodo,
        "fecha_carga": fecha_str,
        "ya_existia": False,
    }


# ──────────────────────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Importa un Excel de Bandas Salariales a SQLite (append-only)."
    )
    parser.add_argument("excel", help="Ruta al archivo .xlsx")
    parser.add_argument(
        "--periodo", default=None,
        help="Período en formato YYYY-MM (ej: 2026-06). "
             "Si se omite, se extrae del nombre del archivo.",
    )
    parser.add_argument(
        "--fecha", default=None,
        help="Fecha de carga en formato YYYY-MM-DD. Por defecto: hoy.",
    )
    parser.add_argument(
        "--forzar", action="store_true",
        help="Forzar re-importación aunque ya exista un registro para esa fecha y archivo.",
    )
    args = parser.parse_args()

    ruta = Path(args.excel)
    if not ruta.is_absolute():
        # Resolver relativo al directorio de trabajo actual
        ruta = Path.cwd() / ruta
    if not ruta.exists():
        print(f"✗ Archivo no encontrado: {ruta}")
        sys.exit(1)

    fecha = None
    if args.fecha:
        from datetime import date as date_cls
        fecha = date_cls.fromisoformat(args.fecha)

    importar_excel(
        ruta_excel=ruta,
        periodo=args.periodo,
        fecha_carga=fecha,
        forzar=args.forzar,
    )


if __name__ == "__main__":
    main()
