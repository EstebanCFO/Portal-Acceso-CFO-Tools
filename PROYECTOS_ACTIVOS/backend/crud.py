"""crud.py — Queries de base de datos (SQLAlchemy 2.x)."""
from __future__ import annotations
from datetime import date
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import select, func, text
from sqlalchemy.orm import Session, joinedload

from models import (
    Client, Project, Employee, Role, ContractType,
    CostCenter, ResourceMonthlyCost, ProjectFinancial,
    ProjectMonthlyHistory, SemaforoMonthlyMetric, SemaforoReference,
)
import schemas


MESES_ES = {
    1:'Enero', 2:'Febrero', 3:'Marzo', 4:'Abril',
    5:'Mayo',  6:'Junio',   7:'Julio', 8:'Agosto',
    9:'Septiembre', 10:'Octubre', 11:'Noviembre', 12:'Diciembre',
}


# ── Períodos ──────────────────────────────────────────────────────────────────

def get_periodos(db: Session) -> List[schemas.PeriodoOut]:
    """Retorna todos los períodos disponibles en project_financials, desc."""
    rows = db.execute(
        select(ProjectFinancial.period_date)
        .distinct()
        .order_by(ProjectFinancial.period_date.desc())
    ).scalars().all()
    return [
        schemas.PeriodoOut(
            period_date=d,
            label=f'{MESES_ES[d.month]} {d.year}',
        )
        for d in rows
    ]


def get_latest_period(db: Session) -> Optional[date]:
    """Retorna el período más reciente disponible."""
    row = db.execute(
        select(func.max(ProjectFinancial.period_date))
    ).scalar_one_or_none()
    return row


# ── Referencia de semáforo ────────────────────────────────────────────────────

def get_semaforo_referencia(db: Session) -> List[SemaforoReference]:
    return db.execute(
        select(SemaforoReference).order_by(SemaforoReference.sort_order)
    ).scalars().all()


def color_for_result(result_pct: Optional[Decimal], referencia: List[SemaforoReference]) -> tuple[Optional[str], Optional[str]]:
    """Retorna (color_label, color_hex) para un porcentaje de resultado dado."""
    if result_pct is None:
        return None, None
    for ref in referencia:
        min_ok  = result_pct >= ref.threshold_min
        max_ok  = ref.threshold_max is None or result_pct < ref.threshold_max
        if min_ok and max_ok:
            return ref.color_label, ref.color_hex
    return 'rojo', '#FC8181'


# ── Semáforo General ──────────────────────────────────────────────────────────

def get_semaforo_general(
    db: Session,
    period_date: date,
    semaforo_type: str = 'ACUMULADO',
) -> schemas.SemaforoGeneralOut:
    """
    Retorna el cuadro de semáforo para un período y tipo dado.
    semaforo_type: 'ACUMULADO' | 'MENSUAL'
    """
    referencia = get_semaforo_referencia(db)

    # Métricas por proyecto (project_id NOT NULL)
    metrics_q = (
        select(SemaforoMonthlyMetric, Project, Client)
        .outerjoin(Project, Project.id == SemaforoMonthlyMetric.project_id)
        .outerjoin(Client,  Client.id  == Project.client_id)
        .where(
            SemaforoMonthlyMetric.period_date  == period_date,
            SemaforoMonthlyMetric.semaforo_type == semaforo_type,
            SemaforoMonthlyMetric.project_id.isnot(None),
        )
        .order_by(SemaforoMonthlyMetric.resultado_real.desc().nulls_last())
    )
    rows = db.execute(metrics_q).all()

    proyectos_out = []
    for metric, project, client in rows:
        color_label, color_hex = color_for_result(metric.resultado_real, referencia)
        proyectos_out.append(schemas.SemaforoRowOut(
            project_id         = metric.project_id,
            project_name       = project.name       if project else None,
            cliente_name       = client.name        if client  else None,
            tipo               = project.tipo       if project else None,
            period_date        = metric.period_date,
            semaforo_type      = metric.semaforo_type,
            resultado_real     = metric.resultado_real,
            resultado_esperado = metric.resultado_esperado,
            variacion_pct      = metric.variacion_pct,
            accion_sugerida    = metric.accion_sugerida,
            facturacion_real   = metric.facturacion_real,
            color_label        = color_label,
            color_hex          = color_hex,
        ))

    # Métricas globales del DC (project_id IS NULL)
    dc_row = db.execute(
        select(SemaforoMonthlyMetric)
        .where(
            SemaforoMonthlyMetric.period_date   == period_date,
            SemaforoMonthlyMetric.semaforo_type == semaforo_type,
            SemaforoMonthlyMetric.project_id.is_(None),
        )
    ).scalar_one_or_none()

    dc_metrics_out = None
    if dc_row:
        dc_metrics_out = schemas.DCMetricsOut(
            period_date                        = dc_row.period_date,
            resultado_comercial                = dc_row.resultado_comercial,
            resultado_comercial_pct            = dc_row.resultado_comercial_pct,
            resultado_comercial_neto_bench     = dc_row.resultado_comercial_neto_bench,
            resultado_comercial_neto_bench_pct = dc_row.resultado_comercial_neto_bench_pct,
            costo_total_bench                  = dc_row.costo_total_bench,
            costo_bench_manpower               = dc_row.costo_bench_manpower,
            costo_bench_dc                     = dc_row.costo_bench_dc,
            recursos_delivery_center           = dc_row.recursos_delivery_center,
            total_recursos_bench               = dc_row.total_recursos_bench,
        )

    return schemas.SemaforoGeneralOut(
        period_date   = str(period_date),
        semaforo_type = semaforo_type,
        proyectos     = proyectos_out,
        dc_metrics    = dc_metrics_out,
        referencia    = [schemas.SemaforoReferenceOut.model_validate(r) for r in referencia],
    )


# ── Lista de proyectos ────────────────────────────────────────────────────────

def get_projects(db: Session, only_active: bool = True) -> List[schemas.ProjectListItem]:
    q = select(Project, Client).join(Client, Client.id == Project.client_id)
    if only_active:
        q = q.where(Project.is_active == True)
    q = q.order_by(Client.name, Project.name)
    rows = db.execute(q).all()
    return [
        schemas.ProjectListItem(
            id          = p.id,
            name        = p.name,
            sheet_name  = p.sheet_name,
            tipo        = p.tipo,
            is_active   = p.is_active,
            client_name = c.name,
        )
        for p, c in rows
    ]


# ── Ejercicio Económico ───────────────────────────────────────────────────────

def get_ejercicio_economico(
    db: Session,
    project_id: int,
    period_date: date,
) -> Optional[schemas.EjercicioEconomicoOut]:
    """Retorna el ejercicio económico completo de un proyecto en un período."""

    # Proyecto + cliente
    proj_row = db.execute(
        select(Project, Client)
        .join(Client, Client.id == Project.client_id)
        .where(Project.id == project_id)
    ).one_or_none()
    if not proj_row:
        return None
    project, client = proj_row

    referencia = get_semaforo_referencia(db)

    # Recursos del período
    recursos_q = (
        select(ResourceMonthlyCost, Employee, Role, ContractType, CostCenter)
        .join(Employee,     Employee.dni         == ResourceMonthlyCost.employee_dni)
        .join(Role,         Role.id              == Employee.role_id)
        .join(ContractType, ContractType.id      == Employee.contract_type_id)
        .join(CostCenter,   CostCenter.code_ceco == ResourceMonthlyCost.code_ceco)
        .where(
            ResourceMonthlyCost.project_id  == project_id,
            ResourceMonthlyCost.period_date == period_date,
        )
        .order_by(ResourceMonthlyCost.total_monthly_cost.desc())
    )
    recurso_rows = db.execute(recursos_q).all()

    recursos_out = []
    total_horas   = Decimal(0)
    costo_total   = Decimal(0)
    for rmc, emp, role, ctype, ceco in recurso_rows:
        recursos_out.append(schemas.RecursoOut(
            dni                   = emp.dni,
            nombre_completo       = f'{emp.last_name}, {emp.first_name}',
            role_name             = role.name,
            contract_type         = ctype.description,
            code_ceco             = ceco.code_ceco,
            total_hours           = rmc.total_hours,
            monthly_hours         = rmc.monthly_hours,
            extra_hours           = rmc.extra_hours,
            monthly_salary        = rmc.monthly_salary,
            total_monthly_cost    = rmc.total_monthly_cost,
            monthly_resource_cost = rmc.monthly_resource_cost,
            extra_hours_cost      = rmc.extra_hours_cost,
            extra_hours_ratio     = rmc.extra_hours_ratio,
        ))
        total_horas += rmc.total_hours or Decimal(0)
        costo_total += rmc.total_monthly_cost or Decimal(0)

    # Financiero del período
    fin = db.execute(
        select(ProjectFinancial).where(
            ProjectFinancial.project_id  == project_id,
            ProjectFinancial.period_date == period_date,
        )
    ).scalar_one_or_none()

    financials_out = None
    if fin:
        color_label, color_hex = color_for_result(fin.result_percentage, referencia)
        financials_out = schemas.FinancialOut(
            period_date             = fin.period_date,
            revenue                 = fin.revenue,
            sale_price_with_vat     = fin.sale_price_with_vat,
            monthly_sale_price      = fin.monthly_sale_price,
            commercial_margin_value = fin.commercial_margin_value,
            result_percentage       = fin.result_percentage,
            commercial_commission   = fin.commercial_commission,
            peaje_wht_percentage    = fin.peaje_wht_percentage,
            peaje_wht_value         = fin.peaje_wht_value,
            project_result          = fin.project_result,
            color_label             = color_label,
            color_hex               = color_hex,
        )

    # Historial (todos los períodos, el acumulado al final)
    history_rows = db.execute(
        select(ProjectMonthlyHistory)
        .where(ProjectMonthlyHistory.project_id == project_id)
        .order_by(
            ProjectMonthlyHistory.is_cumulative.asc(),   # meses primero
            ProjectMonthlyHistory.period_date.asc(),
        )
    ).scalars().all()

    history_out = [
        schemas.HistoryRowOut(
            period_date       = h.period_date,
            is_cumulative     = h.is_cumulative,
            billing           = h.billing,
            commercial_margin = h.commercial_margin,
            result_percentage = h.result_percentage,
        )
        for h in history_rows
    ]

    return schemas.EjercicioEconomicoOut(
        project_id            = project.id,
        project_name          = project.name,
        client_name           = client.name,
        sheet_name            = project.sheet_name,
        tipo                  = project.tipo,
        period_date           = str(period_date),
        recursos              = recursos_out,
        financials            = financials_out,
        history               = history_out,
        total_recursos        = len(recursos_out),
        total_horas           = total_horas,
        costo_total_recursos  = costo_total,
    )
