"""crud.py — Queries de base de datos (SQLAlchemy 2.x)."""
from __future__ import annotations
from datetime import date
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import select, func, text
from sqlalchemy.exc import ProgrammingError
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

_CREATE_INGEST_UPLOADS = text("""
    CREATE TABLE IF NOT EXISTS ingest_uploads (
        id          SERIAL    PRIMARY KEY,
        period_date DATE      NOT NULL,
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
""")


def get_periodos(db: Session) -> List[schemas.PeriodoOut]:
    """
    Retorna períodos disponibles. Preferencia: ingest_uploads (con timestamp).
    Fallback: distinct period_dates de semaforo_monthly_metrics (donde viven
    los datos reales del semáforo — no project_financials que puede tener
    períodos distintos).
    """
    # Crear tabla si no existe aún (migración lazy, idempotente)
    try:
        db.execute(_CREATE_INGEST_UPLOADS)
        db.commit()
    except Exception:
        db.rollback()

    # 1. ingest_uploads (tiene timestamps de cada carga)
    try:
        rows = db.execute(text(
            "SELECT period_date, uploaded_at FROM ingest_uploads ORDER BY uploaded_at DESC"
        )).all()
        if rows:
            return [
                schemas.PeriodoOut(
                    period_date=row.period_date,
                    upload_ts=row.uploaded_at.strftime('%H:%M:%S'),
                    label=(
                        f'{MESES_ES[row.period_date.month]} {row.period_date.year}'
                        f' — {row.uploaded_at.strftime("%H:%M:%S")}'
                    ),
                )
                for row in rows
            ]
    except Exception:
        db.rollback()

    # 2. Fallback: semaforo_monthly_metrics (la fuente canónica del semáforo)
    rows_fb = db.execute(
        select(SemaforoMonthlyMetric.period_date)
        .distinct()
        .order_by(SemaforoMonthlyMetric.period_date.desc())
    ).scalars().all()
    return [
        schemas.PeriodoOut(
            period_date=d,
            label=f'{MESES_ES[d.month]} {d.year}',
        )
        for d in rows_fb
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
    """
    Retorna el ejercicio económico completo de un proyecto.

    `period_date` es el período del semáforo (fuente: semaforo_monthly_metrics).
    Los datos de recursos/financiero pueden estar en un período distinto —
    el ETL lee cada tabla de una hoja diferente del Excel con su propia fecha.
    Si no hay datos para `period_date`, se usa el período disponible más reciente
    para ese proyecto en resource_monthly_costs (fallback automático).
    """

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

    # ── Determinar el período de datos reales (puede diferir del semáforo) ──
    # 1. Buscar en resource_monthly_costs: período exacto primero, luego el más reciente
    data_period = db.execute(
        select(ResourceMonthlyCost.period_date)
        .where(ResourceMonthlyCost.project_id == project_id,
               ResourceMonthlyCost.period_date == period_date)
        .limit(1)
    ).scalar_one_or_none()

    if data_period is None:
        # Fallback: tomar el período más reciente disponible para este proyecto
        data_period = db.execute(
            select(func.max(ResourceMonthlyCost.period_date))
            .where(ResourceMonthlyCost.project_id == project_id)
        ).scalar_one_or_none()

    # Usar el período real encontrado (o el pedido si no hay recursos)
    effective_period = data_period if data_period is not None else period_date

    # Recursos del período efectivo
    recursos_q = (
        select(ResourceMonthlyCost, Employee, Role, ContractType, CostCenter)
        .join(Employee,     Employee.dni         == ResourceMonthlyCost.employee_dni)
        .join(Role,         Role.id              == Employee.role_id)
        .join(ContractType, ContractType.id      == Employee.contract_type_id)
        .join(CostCenter,   CostCenter.code_ceco == ResourceMonthlyCost.code_ceco)
        .where(
            ResourceMonthlyCost.project_id  == project_id,
            ResourceMonthlyCost.period_date == effective_period,
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

    # Financiero — usa el mismo período efectivo que los recursos
    fin = db.execute(
        select(ProjectFinancial).where(
            ProjectFinancial.project_id  == project_id,
            ProjectFinancial.period_date == effective_period,
        )
    ).scalar_one_or_none()

    # Si tampoco hay financials en el período efectivo, buscar el más reciente
    if fin is None:
        fin = db.execute(
            select(ProjectFinancial)
            .where(ProjectFinancial.project_id == project_id)
            .order_by(ProjectFinancial.period_date.desc())
            .limit(1)
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
        period_date           = str(effective_period),   # período real de los datos
        semaforo_period_date  = str(period_date),        # período del semáforo (puede diferir)
        recursos              = recursos_out,
        financials            = financials_out,
        history               = history_out,
        total_recursos        = len(recursos_out),
        total_horas           = total_horas,
        costo_total_recursos  = costo_total,
    )
