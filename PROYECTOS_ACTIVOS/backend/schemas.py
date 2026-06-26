"""schemas.py — Pydantic response models para la API."""
from __future__ import annotations
from datetime import date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


# ── Semáforo ──────────────────────────────────────────────────────────────────

class SemaforoReferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    color_label:   str
    color_hex:     str
    threshold_min: Decimal
    threshold_max: Optional[Decimal]
    description:   str
    sort_order:    int


class SemaforoRowOut(BaseModel):
    """Una fila del cuadro de semáforo (un proyecto en un período)."""
    model_config = ConfigDict(from_attributes=True)

    project_id:          Optional[int]
    project_name:        Optional[str]
    cliente_name:        Optional[str]
    tipo:                Optional[str]
    period_date:         date
    semaforo_type:       str

    resultado_real:      Optional[Decimal]
    resultado_esperado:  Optional[Decimal]
    variacion_pct:       Optional[Decimal]
    accion_sugerida:     Optional[str]
    facturacion_real:    Optional[Decimal]

    # Color calculado (join con semaforo_reference)
    color_label:         Optional[str]
    color_hex:           Optional[str]


class DCMetricsOut(BaseModel):
    """Métricas globales del Delivery Center."""
    period_date:                        date
    resultado_comercial:                Optional[Decimal]
    resultado_comercial_pct:            Optional[Decimal]
    resultado_comercial_neto_bench:     Optional[Decimal]
    resultado_comercial_neto_bench_pct: Optional[Decimal]
    costo_total_bench:                  Optional[Decimal]
    costo_bench_manpower:               Optional[Decimal]
    costo_bench_dc:                     Optional[Decimal]
    recursos_delivery_center:           Optional[int]
    total_recursos_bench:               Optional[int]


class SemaforoGeneralOut(BaseModel):
    """Respuesta completa del semáforo general."""
    period_date:    str
    semaforo_type:  str
    proyectos:      List[SemaforoRowOut]
    dc_metrics:     Optional[DCMetricsOut]
    referencia:     List[SemaforoReferenceOut]


# ── Proyectos ─────────────────────────────────────────────────────────────────

class ProjectListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:           int
    name:         str
    sheet_name:   str
    tipo:         str
    is_active:    bool
    client_name:  str


# ── Ejercicio Económico (detalle de proyecto) ─────────────────────────────────

class RecursoOut(BaseModel):
    """Un empleado en el ejercicio económico."""
    model_config = ConfigDict(from_attributes=True)
    dni:                   str
    nombre_completo:       str
    role_name:             str
    contract_type:         str
    code_ceco:             str
    total_hours:           Decimal
    monthly_hours:         Decimal
    extra_hours:           Decimal
    monthly_salary:        Decimal
    total_monthly_cost:    Decimal
    monthly_resource_cost: Decimal
    extra_hours_cost:      Decimal
    extra_hours_ratio:     Decimal


class FinancialOut(BaseModel):
    """Bloque financiero del proyecto en un período."""
    model_config = ConfigDict(from_attributes=True)
    period_date:             date
    revenue:                 Decimal
    sale_price_with_vat:     Decimal
    monthly_sale_price:      Decimal
    commercial_margin_value: Decimal
    result_percentage:       Decimal
    commercial_commission:   Decimal
    peaje_wht_percentage:    Decimal
    peaje_wht_value:         Decimal
    project_result:          Decimal
    # Color del semáforo calculado
    color_label:             Optional[str] = None
    color_hex:               Optional[str] = None


class HistoryRowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    period_date:       date
    is_cumulative:     bool
    billing:           Decimal
    commercial_margin: Decimal
    result_percentage: Decimal


class EjercicioEconomicoOut(BaseModel):
    """Respuesta completa del ejercicio económico de un proyecto."""
    project_id:   int
    project_name: str
    client_name:  str
    sheet_name:   str
    tipo:         str
    period_date:  str   # período real de los datos (recursos/financiero)
    semaforo_period_date: Optional[str] = None  # período del semáforo (puede diferir)

    recursos:     List[RecursoOut]
    financials:   Optional[FinancialOut]
    history:      List[HistoryRowOut]

    # Totales calculados de recursos
    total_recursos:         int
    total_horas:            Decimal
    costo_total_recursos:   Decimal


# ── Períodos disponibles ──────────────────────────────────────────────────────

class PeriodoOut(BaseModel):
    period_date: date
    label:       str            # "Junio 2026 — 14:30:22"
    upload_ts:   Optional[str] = None  # "14:30:22" (solo si viene de ingest_uploads)
