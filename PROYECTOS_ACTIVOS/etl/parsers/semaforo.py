"""
parsers/semaforo.py — Parser de la solapa SEMAFORO GENERAL.

Extrae dos cuadros:
  · SEMAFORO ACUMULADO: métricas YTD por proyecto
  · SEMAFORO MENSUAL:   métricas del mes corriente por proyecto
  · Métricas globales del DC (resultado comercial, bench, recursos)

Retorna dataclasses listos para insert en semaforo_monthly_metrics.
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
class SemaforoRow:
    """Una fila del cuadro de semáforo (por proyecto)."""
    project_name:           str
    semaforo_type:          str          # 'ACUMULADO' | 'MENSUAL'
    period_date:            str          # 'YYYY-MM-01'
    resultado_real:         Optional[float] = None
    resultado_esperado:     Optional[float] = None
    variacion_pct:          Optional[float] = None
    accion_sugerida:        Optional[str]  = None
    facturacion_teorica:    Optional[float] = None
    facturacion_real:       Optional[float] = None
    resultado_teorico:      Optional[float] = None
    resultado_real_valor:   Optional[float] = None
    resultado_esperado_valor: Optional[float] = None


@dataclass
class DCMetrics:
    """Métricas globales del Delivery Center del cuadro inferior del semáforo."""
    period_date:                            str
    resultado_comercial:                    Optional[float] = None
    resultado_comercial_pct:                Optional[float] = None
    resultado_comercial_neto_bench:         Optional[float] = None
    resultado_comercial_neto_bench_pct:     Optional[float] = None
    costo_total_bench:                      Optional[float] = None
    costo_bench_manpower:                   Optional[float] = None
    costo_bench_dc:                         Optional[float] = None
    resultado_comercial_neto_bench_dc:      Optional[float] = None
    resultado_comercial_neto_bench_dc_pct:  Optional[float] = None
    recursos_delivery_center:               Optional[int]   = None
    total_recursos_bench:                   Optional[int]   = None
    participacion_bench_en_nomina:          Optional[float] = None
    bench_mpw:                              Optional[float] = None
    bench_dc:                               Optional[float] = None


@dataclass
class SemaforoSheet:
    """Todo lo extraído de la solapa SEMAFORO GENERAL."""
    acumulado_rows: list[SemaforoRow] = field(default_factory=list)
    mensual_rows:   list[SemaforoRow] = field(default_factory=list)
    dc_metrics:     Optional[DCMetrics] = None


# ---------------------------------------------------------------------------
# Parser principal
# ---------------------------------------------------------------------------

def _safe_float(val) -> Optional[float]:
    try:
        v = float(val)
        return None if pd.isna(v) else v
    except (TypeError, ValueError):
        return None


def _safe_int(val) -> Optional[int]:
    try:
        v = float(val)
        return None if pd.isna(v) else int(v)
    except (TypeError, ValueError):
        return None


def _period_from_header(header_text: str) -> str:
    """
    Extrae el período del título del cuadro.
    'SEMAFORO ACUMULADO JUNIO 2026' → '2026-06-01'
    'SEMAFORO JUNIO 2026'           → '2026-06-01'
    """
    MONTHS = {
        'enero':1,'febrero':2,'marzo':3,'abril':4,'mayo':5,'junio':6,
        'julio':7,'agosto':8,'septiembre':9,'octubre':10,'noviembre':11,'diciembre':12
    }
    text = header_text.lower()
    for month_name, month_num in MONTHS.items():
        if month_name in text:
            year_match = re.search(r'(\d{4})', text)
            if year_match:
                year = int(year_match.group(1))
                return f'{year}-{month_num:02d}-01'
    return '2026-01-01'   # fallback


def parse_semaforo_general(excel_path: str) -> SemaforoSheet:
    """
    Lee la solapa 'SEMAFORO GENERAL' del Excel y devuelve SemaforoSheet.

    Uso:
        result = parse_semaforo_general('Proyectos Activos 2026.xlsx')
        for row in result.acumulado_rows:
            print(row.project_name, row.resultado_real)
    """
    # Leer todas las celdas sin cabecera para detectar secciones dinámicamente
    df = pd.read_excel(
        excel_path,
        sheet_name='SEMAFORO GENERAL',
        header=None,
        dtype=str,
    )

    result = SemaforoSheet()
    current_type: Optional[str] = None
    current_period: str = '2026-06-01'

    # Tipos reconocibles en la primera columna de encabezado
    KNOWN_PROJECTS: set[str] = set()  # se va construyendo al vuelo

    # Columnas del cuadro izquierdo (posiciones aproximadas — el parser es posicional)
    # Col 0: PROYECTO | Col 1: TIPO | Col 2: RES REAL | Col 3: SEMAFORO
    # Col 4: Res. Esperado | Col 5: Variación % | Col 6: Acción sugerida
    # Col 7: Proyecto ref | Col 8: Fact Teórica | Col 9: Fact Real
    # Col 10: Res Teórico | Col 11: Res Real $ | Col 12: Res Esp $

    # Marcadores de inicio de sección
    ACUMULADO_RE = re.compile(r'SEMAFORO\s+ACUMULADO', re.I)
    MENSUAL_RE   = re.compile(r'SEMAFORO\s+(?!ACUMULADO).*\d{4}', re.I)

    # Filas de métricas globales DC
    DC_METRICS_KEYS = {
        'RESULTADO COMERCIAL': 'resultado_comercial',
        'RESULTADO COMERCIAL NETO DE BENCH': 'resultado_comercial_neto_bench',
        'COSTO TOTAL BENCH': 'costo_total_bench',
        'COSTO BENCH MANPOWER': 'costo_bench_manpower',
        'COSTO BENCH DC': 'costo_bench_dc',
        'RESULTADO COMERCIAL NETO DE BENCH DC': 'resultado_comercial_neto_bench_dc',
        'RECURSOS DELIVERY CENTER': 'recursos_delivery_center',
        'TOTAL RECURSOS EN BENCH': 'total_recursos_bench',
    }
    dc_raw: dict = {}

    for _, row in df.iterrows():
        cells = [str(c).strip() if pd.notna(c) and str(c) != 'nan' else '' for c in row]
        if not any(cells):
            continue

        # La tabla está desplazada: col 0 vacía, datos desde col 1
        # Usamos c1 como pivote principal de detección
        c1 = cells[1].upper() if len(cells) > 1 else ''
        c0 = cells[0].upper()

        # Detectar inicio de cuadro ACUMULADO (en c1)
        if ACUMULADO_RE.search(c1):
            current_type = 'ACUMULADO'
            current_period = _period_from_header(cells[1])
            continue

        # Detectar inicio de cuadro MENSUAL (en c1)
        if MENSUAL_RE.search(c1) and 'ACUMULADO' not in c1:
            current_type = 'MENSUAL'
            current_period = _period_from_header(cells[1])
            continue

        # Saltar filas de cabecera y filas vacías
        if c1 in ('PROYECTO', 'SEMAFORO DE REFERENCIA', '', 'PELLEGRINI'):
            continue

        # Detectar métricas globales del DC (también pueden estar en c1)
        for key, attr in DC_METRICS_KEYS.items():
            if key in c1:
                val = cells[2] if len(cells) > 2 else ''
                try:
                    dc_raw[attr] = float(val)
                except (ValueError, TypeError):
                    pass
                break

        # Filas de proyectos: col 2 = TIPO ('Proy' | 'Capacity' | 'Factory')
        # Estructura: [vacío, PROYECTO, TIPO, RES REAL, SEMAFORO, Res.Esp, Var%, Acción]
        if len(cells) > 3 and cells[2] in ('Proy', 'Capacity', 'Factory', 'proy', 'capacity'):
            if current_type is None:
                continue
            semaforo_row = SemaforoRow(
                project_name       = cells[1],
                semaforo_type      = current_type,
                period_date        = current_period,
                resultado_real     = _safe_float(cells[3]) if len(cells) > 3 else None,
                resultado_esperado = _safe_float(cells[5]) if len(cells) > 5 else None,
                variacion_pct      = _safe_float(cells[6]) if len(cells) > 6 else None,
                accion_sugerida    = cells[7].strip() if len(cells) > 7 else None,
            )
            if current_type == 'ACUMULADO':
                result.acumulado_rows.append(semaforo_row)
            else:
                result.mensual_rows.append(semaforo_row)

    # Construir DCMetrics si hay datos
    if dc_raw:
        result.dc_metrics = DCMetrics(
            period_date=current_period,
            **{k: v for k, v in dc_raw.items()},
        )

    return result


# ---------------------------------------------------------------------------
# CLI de prueba rápida
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else 'Proyectos Activos 2026.xlsx'
    data = parse_semaforo_general(path)
    print(f'Acumulado: {len(data.acumulado_rows)} proyectos')
    print(f'Mensual:   {len(data.mensual_rows)} proyectos')
    if data.dc_metrics:
        print(f'DC Res Comercial: {data.dc_metrics.resultado_comercial}')
    for r in data.acumulado_rows[:3]:
        print(f'  {r.project_name}: {r.resultado_real:.2%}' if r.resultado_real else f'  {r.project_name}: sin dato')
