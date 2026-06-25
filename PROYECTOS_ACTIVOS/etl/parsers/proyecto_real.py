"""
parsers/proyecto_real.py — Parser genérico de solapas "[NOMBRE_PROYECTO] REAL".

Lógica de negocio obligatoria:
  · Para cada proyecto listado en SEMAFORO GENERAL, busca dinámicamente
    la solapa con el mismo nombre + sufijo " REAL".
  · Extrae: header (cliente, proyecto, ceco, período), recursos (empleados),
    bloque financiero y tabla histórica.

Retorna dataclasses listos para insert en:
  · clients, projects, cost_centers (upsert)
  · employees, roles, contract_types (upsert por DNI)
  · resource_monthly_costs (insert/upsert)
  · project_financials (insert/upsert)
  · project_monthly_history (insert/upsert)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import re
import pandas as pd


# ---------------------------------------------------------------------------
# Modelos de salida
# ---------------------------------------------------------------------------

@dataclass
class ProjectHeader:
    sheet_name:     str         # nombre de la solapa sin " REAL"
    client_name:    str
    project_name:   str
    code_ceco:      str
    period_date:    str         # 'YYYY-MM-01'


@dataclass
class ResourceRow:
    """Una fila de empleado de la solapa REAL."""
    dni:                    str
    first_name:             str
    last_name:              str
    role_name:              str
    contract_type:          str
    code_ceco:              str
    total_hours:            float
    months_worked:          float
    monthly_hours:          float
    extra_hours:            float
    monthly_salary:         float
    total_monthly_cost:     float
    monthly_resource_cost:  float
    extra_hours_cost:       float
    extra_hours_ratio:      float


@dataclass
class FinancialBlock:
    """Bloque financiero al pie de la solapa REAL."""
    commercial_commission:  float = 0.0
    peaje_wht_percentage:   float = 0.0
    peaje_wht_value:        float = 0.0
    sale_price_with_vat:    float = 0.0
    monthly_sale_price:     float = 0.0
    project_result:         float = 0.0
    result_percentage:      float = 0.0
    semaforo_value:         float = 0.0


@dataclass
class HistoryRow:
    """Una fila de la tabla histórica al pie de la solapa REAL."""
    period_date:        str
    billing:            float
    commercial_margin:  float
    result_percentage:  float
    is_cumulative:      bool = False   # True para la fila ACUMULADO


@dataclass
class ProyectoReal:
    """Todo lo extraído de una solapa [NOMBRE] REAL."""
    header:     ProjectHeader
    resources:  list[ResourceRow]  = field(default_factory=list)
    financials: Optional[FinancialBlock] = None
    history:    list[HistoryRow]   = field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(val, default: float = 0.0) -> float:
    try:
        v = float(str(val).replace(',', '.'))
        return default if pd.isna(v) else v
    except (TypeError, ValueError):
        return default


def _excel_serial_to_period(serial) -> str:
    """
    Convierte número serial de Excel a 'YYYY-MM-01'.
    46070 → 2026-02-01
    """
    try:
        from datetime import datetime, timedelta
        base = datetime(1899, 12, 30)
        dt   = base + timedelta(days=int(float(str(serial))))
        return dt.strftime('%Y-%m-01')
    except Exception:
        return '2026-01-01'


def _period_from_excel_date(val) -> str:
    """Detecta si el valor es serial de Excel o string de fecha."""
    s = str(val).strip()
    # Si ya es formato fecha
    if re.match(r'\d{4}-\d{2}', s):
        return s[:7] + '-01'
    # Si es número serial de Excel
    try:
        return _excel_serial_to_period(s)
    except Exception:
        return '2026-01-01'


# ---------------------------------------------------------------------------
# Lista de todas las solapas REAL disponibles en el Excel
# ---------------------------------------------------------------------------

def list_real_sheets(excel_path: str) -> list[str]:
    """
    Retorna los nombres de todas las solapas que terminan en ' REAL'
    (con o sin espacios al final).
    """
    xl = pd.ExcelFile(excel_path)
    return [
        name for name in xl.sheet_names
        if re.search(r'\bREAL\s*$', name, re.I)
    ]


def sheet_name_to_project_name(sheet_name: str) -> str:
    """'IRSA VENTAS REAL' → 'IRSA VENTAS'"""
    return re.sub(r'\s*REAL\s*$', '', sheet_name, flags=re.I).strip()


# ---------------------------------------------------------------------------
# Parser de una solapa REAL
# ---------------------------------------------------------------------------

def parse_proyecto_real(excel_path: str, sheet_name: str) -> ProyectoReal:
    """
    Parsea una solapa '[NOMBRE] REAL' y retorna ProyectoReal.

    Uso:
        result = parse_proyecto_real('Proyectos Activos 2026.xlsx', 'IRSA VENTAS REAL')
        print(result.header.client_name)       # 'IRSA'
        print(len(result.resources))           # cantidad de empleados
    """
    df = pd.read_excel(
        excel_path,
        sheet_name=sheet_name,
        header=None,
        dtype=str,
    )

    project_name_base = sheet_name_to_project_name(sheet_name)

    # ── Estado del parser ─────────────────────────────────────────────────
    client_name:  str = ''
    project_name: str = project_name_base
    code_ceco:    str = ''
    period_date:  str = '2026-06-01'

    resources:    list[ResourceRow]  = []
    history:      list[HistoryRow]   = []
    financials    = FinancialBlock()

    MODE_NONE       = 'none'
    MODE_RESOURCES  = 'resources'
    MODE_HISTORY    = 'history'
    mode = MODE_NONE

    def cells(row) -> list[str]:
        return [str(c).strip() if pd.notna(c) and str(c) != 'nan' else '' for c in row]

    for _, row in df.iterrows():
        c = cells(row)
        if not any(c):
            continue

        c0 = c[0].upper().strip()

        # ── Header del proyecto ─────────────────────────────────────────
        if c0.startswith('CLIENTE'):
            client_name = c[1] if len(c) > 1 else ''
            continue
        if c0.startswith('PROYECTO'):
            project_name = c[1] if len(c) > 1 else project_name_base
            continue
        if c0.startswith('CECO') or c0.startswith('CE CO'):
            code_ceco = c[1] if len(c) > 1 else ''
            continue
        if c0.startswith('FECHA'):
            period_date = _period_from_excel_date(c[1]) if len(c) > 1 else period_date
            continue

        # ── Inicio de sección recursos ──────────────────────────────────
        if c0 in ('DNI', 'D.N.I'):
            mode = MODE_RESOURCES
            continue
        # Fila secundaria de cabecera (CeCo TOTALES HS EXTRAS…) — saltar
        if c0 == 'CECO' and mode == MODE_RESOURCES:
            continue

        # ── Fin de recursos / inicio de bloque financiero ───────────────
        if 'COMISION' in c0 or 'COMISIÓN' in c0:
            mode = MODE_NONE
            try:
                financials.commercial_commission = _safe_float(c[1])
            except IndexError:
                pass
            continue
        if 'PEAJE' in c0 or 'WHT' in c0:
            try:
                financials.peaje_wht_percentage = _safe_float(c[1])
                financials.peaje_wht_value      = _safe_float(c[2]) if len(c) > 2 else 0.0
            except IndexError:
                pass
            continue
        if 'PRECIO VENTA' in c0 and 'IVA' in c0:
            financials.sale_price_with_vat = _safe_float(c[1]) if len(c) > 1 else 0.0
            continue
        if 'PRECIO VENTA' in c0 and 'MENSUAL' in c0:
            financials.monthly_sale_price = _safe_float(c[1]) if len(c) > 1 else 0.0
            continue
        if 'RESULTADO PROYECTO' in c0:
            financials.project_result = _safe_float(c[1]) if len(c) > 1 else 0.0
            continue
        if 'SEMAFORO' in c0:
            financials.semaforo_value   = _safe_float(c[1]) if len(c) > 1 else 0.0
            financials.result_percentage = financials.semaforo_value
            continue

        # ── Tabla histórica ─────────────────────────────────────────────
        if c0 in ('MES', 'MESES', 'FECHA', 'PERIODO') and len(c) > 2:
            mode = MODE_HISTORY
            continue
        if mode == MODE_HISTORY:
            if c0 == 'ACUMULADO':
                h = HistoryRow(
                    period_date       = period_date,
                    billing           = _safe_float(c[1]) if len(c) > 1 else 0.0,
                    commercial_margin = _safe_float(c[2]) if len(c) > 2 else 0.0,
                    result_percentage = _safe_float(c[3]) if len(c) > 3 else 0.0,
                    is_cumulative     = True,
                )
                history.append(h)
            elif re.match(r'^\d{5}', c0):   # número serial de Excel
                h = HistoryRow(
                    period_date       = _period_from_excel_date(c[0]),
                    billing           = _safe_float(c[1]) if len(c) > 1 else 0.0,
                    commercial_margin = _safe_float(c[2]) if len(c) > 2 else 0.0,
                    result_percentage = _safe_float(c[3]) if len(c) > 3 else 0.0,
                    is_cumulative     = False,
                )
                history.append(h)
            continue

        # ── Filas de recursos (empleados) ───────────────────────────────
        if mode == MODE_RESOURCES:
            # Una fila de empleado comienza con un DNI numérico
            if not re.match(r'^\d{7,9}$', c0.replace('.', '').replace(' ', '')):
                continue
            try:
                # Posiciones: DNI, NOMBRE, APELLIDO, PERFIL, CECO, HORAS, MESES, HS_MES,
                #             HS_EXTRAS, TIP_CONTRAT, SALARIO, COSTO_MENS, COSTO_LABORAL,
                #             COSTO_HS_EXTRA, RATIO_HS_EXTRA
                resource = ResourceRow(
                    dni                   = c0.replace('.', '').replace(' ', ''),
                    first_name            = c[1] if len(c) > 1 else '',
                    last_name             = c[2] if len(c) > 2 else '',
                    role_name             = c[3] if len(c) > 3 else '',
                    code_ceco             = c[4] if len(c) > 4 else code_ceco,
                    total_hours           = _safe_float(c[5]  if len(c) > 5  else 0),
                    months_worked         = _safe_float(c[6]  if len(c) > 6  else 1),
                    monthly_hours         = _safe_float(c[7]  if len(c) > 7  else 0),
                    extra_hours           = _safe_float(c[8]  if len(c) > 8  else 0),
                    contract_type         = c[9]  if len(c) > 9  else 'RELAC DEPEND',
                    monthly_salary        = _safe_float(c[10] if len(c) > 10 else 0),
                    total_monthly_cost    = _safe_float(c[11] if len(c) > 11 else 0),
                    monthly_resource_cost = _safe_float(c[12] if len(c) > 12 else 0),
                    extra_hours_cost      = _safe_float(c[13] if len(c) > 13 else 0),
                    extra_hours_ratio     = _safe_float(c[14] if len(c) > 14 else 0),
                )
                resources.append(resource)
            except Exception:
                continue

    header = ProjectHeader(
        sheet_name   = sheet_name,
        client_name  = client_name.strip(),
        project_name = project_name.strip(),
        code_ceco    = code_ceco.strip(),
        period_date  = period_date,
    )

    return ProyectoReal(
        header    = header,
        resources = resources,
        financials = financials,
        history   = history,
    )


# ---------------------------------------------------------------------------
# Ingesta de todas las solapas REAL de un Excel
# ---------------------------------------------------------------------------

def parse_all_real_sheets(excel_path: str) -> list[ProyectoReal]:
    """
    Itera todas las solapas que terminan en ' REAL' y las parsea.
    Retorna lista ordenada por nombre de proyecto.
    """
    sheets = list_real_sheets(excel_path)
    results = []
    for sheet in sheets:
        try:
            r = parse_proyecto_real(excel_path, sheet)
            results.append(r)
        except Exception as e:
            print(f'[WARN] Error en solapa "{sheet}": {e}')
    return sorted(results, key=lambda r: r.header.project_name)


# ---------------------------------------------------------------------------
# CLI de prueba rápida
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    import sys
    path  = sys.argv[1] if len(sys.argv) > 1 else 'Proyectos Activos 2026.xlsx'
    sheet = sys.argv[2] if len(sys.argv) > 2 else 'IRSA VENTAS REAL'
    r = parse_proyecto_real(path, sheet)
    print(f'Proyecto: {r.header.project_name} | Cliente: {r.header.client_name}')
    print(f'CeCo: {r.header.code_ceco} | Período: {r.header.period_date}')
    print(f'Recursos: {len(r.resources)}')
    print(f'Historial: {len(r.history)} filas')
    if r.financials:
        print(f'Resultado: {r.financials.result_percentage:.2%} | Precio mensual: ${r.financials.monthly_sale_price:,.0f}')
