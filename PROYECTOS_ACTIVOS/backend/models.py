"""models.py — SQLAlchemy ORM models (espejo de schema.sql)."""
from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    Boolean, Date, ForeignKey, Integer, Numeric, String,
    Text, TIMESTAMP, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


# ── Módulo A: CORE ────────────────────────────────────────────────────────────

class Client(Base):
    __tablename__ = 'clients'

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True)
    name:       Mapped[str]      = mapped_column(String(120), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    projects: Mapped[List['Project']] = relationship(back_populates='client')


class Project(Base):
    __tablename__ = 'projects'
    __table_args__ = (UniqueConstraint('sheet_name'),)

    id:          Mapped[int]  = mapped_column(Integer, primary_key=True)
    client_id:   Mapped[int]  = mapped_column(ForeignKey('clients.id'), nullable=False)
    name:        Mapped[str]  = mapped_column(String(200), nullable=False)
    sheet_name:  Mapped[str]  = mapped_column(String(200), nullable=False)
    tipo:        Mapped[str]  = mapped_column(String(30), nullable=False, default='Proy')
    is_active:   Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at:  Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    client:              Mapped['Client']               = relationship(back_populates='projects')
    resource_costs:      Mapped[List['ResourceMonthlyCost']]  = relationship(back_populates='project')
    financials:          Mapped[List['ProjectFinancial']]     = relationship(back_populates='project')
    history:             Mapped[List['ProjectMonthlyHistory']] = relationship(back_populates='project')
    semaforo_metrics:    Mapped[List['SemaforoMonthlyMetric']] = relationship(back_populates='project')


class CostCenter(Base):
    __tablename__ = 'cost_centers'

    code_ceco:  Mapped[str] = mapped_column(String(80), primary_key=True)
    name_ceco:  Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    resource_costs: Mapped[List['ResourceMonthlyCost']] = relationship(back_populates='cost_center')


class Role(Base):
    __tablename__ = 'roles'

    id:   Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)

    employees: Mapped[List['Employee']] = relationship(back_populates='role')


class ContractType(Base):
    __tablename__ = 'contract_types'

    id:          Mapped[int] = mapped_column(Integer, primary_key=True)
    description: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)

    employees: Mapped[List['Employee']] = relationship(back_populates='contract_type')


class Employee(Base):
    __tablename__ = 'employees'

    dni:              Mapped[str] = mapped_column(String(20), primary_key=True)
    first_name:       Mapped[str] = mapped_column(String(100), nullable=False)
    last_name:        Mapped[str] = mapped_column(String(100), nullable=False)
    role_id:          Mapped[int] = mapped_column(ForeignKey('roles.id'), nullable=False)
    contract_type_id: Mapped[int] = mapped_column(ForeignKey('contract_types.id'), nullable=False)
    created_at:       Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at:       Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    role:          Mapped['Role']          = relationship(back_populates='employees')
    contract_type: Mapped['ContractType']  = relationship(back_populates='employees')
    resource_costs: Mapped[List['ResourceMonthlyCost']] = relationship(back_populates='employee')


class ResourceMonthlyCost(Base):
    __tablename__ = 'resource_monthly_costs'
    __table_args__ = (UniqueConstraint('employee_dni', 'project_id', 'period_date'),)

    id:                    Mapped[int]             = mapped_column(Integer, primary_key=True)
    employee_dni:          Mapped[str]             = mapped_column(ForeignKey('employees.dni'), nullable=False)
    project_id:            Mapped[int]             = mapped_column(ForeignKey('projects.id'), nullable=False)
    code_ceco:             Mapped[str]             = mapped_column(ForeignKey('cost_centers.code_ceco'), nullable=False)
    period_date:           Mapped[date]            = mapped_column(Date, nullable=False)

    total_hours:           Mapped[Decimal]         = mapped_column(Numeric(8, 2),  default=0)
    months_worked:         Mapped[Decimal]         = mapped_column(Numeric(4, 2),  default=1)
    monthly_hours:         Mapped[Decimal]         = mapped_column(Numeric(8, 2),  default=0)
    extra_hours:           Mapped[Decimal]         = mapped_column(Numeric(8, 2),  default=0)
    monthly_salary:        Mapped[Decimal]         = mapped_column(Numeric(15, 2), default=0)
    total_monthly_cost:    Mapped[Decimal]         = mapped_column(Numeric(15, 2), default=0)
    monthly_resource_cost: Mapped[Decimal]         = mapped_column(Numeric(15, 2), default=0)
    extra_hours_cost:      Mapped[Decimal]         = mapped_column(Numeric(15, 2), default=0)
    extra_hours_ratio:     Mapped[Decimal]         = mapped_column(Numeric(5, 4),  default=0)
    created_at:            Mapped[datetime]        = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    employee:    Mapped['Employee']   = relationship(back_populates='resource_costs')
    project:     Mapped['Project']    = relationship(back_populates='resource_costs')
    cost_center: Mapped['CostCenter'] = relationship(back_populates='resource_costs')


class ProjectFinancial(Base):
    __tablename__ = 'project_financials'
    __table_args__ = (UniqueConstraint('project_id', 'period_date'),)

    id:                      Mapped[int]     = mapped_column(Integer, primary_key=True)
    project_id:              Mapped[int]     = mapped_column(ForeignKey('projects.id'), nullable=False)
    period_date:             Mapped[date]    = mapped_column(Date, nullable=False)

    revenue:                 Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    sale_price_with_vat:     Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    monthly_sale_price:      Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    commercial_margin_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    result_percentage:       Mapped[Decimal] = mapped_column(Numeric(6, 4),  default=0)
    commercial_commission:   Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    peaje_wht_percentage:    Mapped[Decimal] = mapped_column(Numeric(5, 4),  default=0)
    peaje_wht_value:         Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    semaforo_value:          Mapped[Decimal] = mapped_column(Numeric(6, 4),  default=0)
    project_result:          Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    created_at:              Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    project: Mapped['Project'] = relationship(back_populates='financials')


class ProjectMonthlyHistory(Base):
    __tablename__ = 'project_monthly_history'
    __table_args__ = (UniqueConstraint('project_id', 'period_date', 'is_cumulative'),)

    id:                Mapped[int]     = mapped_column(Integer, primary_key=True)
    project_id:        Mapped[int]     = mapped_column(ForeignKey('projects.id'), nullable=False)
    period_date:       Mapped[date]    = mapped_column(Date, nullable=False)
    is_cumulative:     Mapped[bool]    = mapped_column(Boolean, nullable=False, default=False)
    billing:           Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    commercial_margin: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    result_percentage: Mapped[Decimal] = mapped_column(Numeric(6, 4),  default=0)
    created_at:        Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    project: Mapped['Project'] = relationship(back_populates='history')


# ── Módulo B: SEMÁFORO ───────────────────────────────────────────────────────

class SemaforoMonthlyMetric(Base):
    __tablename__ = 'semaforo_monthly_metrics'
    __table_args__ = (UniqueConstraint('project_id', 'period_date', 'semaforo_type'),)

    id:                                     Mapped[int]            = mapped_column(Integer, primary_key=True)
    project_id:                             Mapped[Optional[int]]  = mapped_column(ForeignKey('projects.id'), nullable=True)
    period_date:                            Mapped[date]           = mapped_column(Date, nullable=False)
    semaforo_type:                          Mapped[str]            = mapped_column(String(60), nullable=False)
    project_label:                          Mapped[Optional[str]]  = mapped_column(String(200))
    tipo:                                   Mapped[Optional[str]]  = mapped_column(String(30))

    resultado_real:                         Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 4))
    resultado_esperado:                     Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 4))
    variacion_pct:                          Mapped[Optional[Decimal]] = mapped_column(Numeric(7, 4))
    accion_sugerida:                        Mapped[Optional[str]]     = mapped_column(String(200))
    facturacion_teorica:                    Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    facturacion_real:                       Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    resultado_teorico:                      Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    resultado_real_valor:                   Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    resultado_esperado_valor:               Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))

    resultado_comercial:                    Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    resultado_comercial_pct:                Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 4))
    resultado_comercial_neto_bench:         Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    resultado_comercial_neto_bench_pct:     Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 4))
    costo_total_bench:                      Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    costo_bench_manpower:                   Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    costo_bench_dc:                         Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    resultado_comercial_neto_bench_dc:      Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    resultado_comercial_neto_bench_dc_pct:  Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 4))
    recursos_delivery_center:               Mapped[Optional[int]]     = mapped_column(Integer)
    total_recursos_bench:                   Mapped[Optional[int]]     = mapped_column(Integer)
    participacion_bench_en_nomina:          Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4))
    bench_mpw:                              Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4))
    bench_dc:                               Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4))
    created_at:                             Mapped[datetime]          = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    project: Mapped[Optional['Project']] = relationship(back_populates='semaforo_metrics')


class SemaforoReference(Base):
    __tablename__ = 'semaforo_reference'

    id:            Mapped[int]            = mapped_column(Integer, primary_key=True)
    color_label:   Mapped[str]            = mapped_column(String(30), nullable=False, unique=True)
    color_hex:     Mapped[str]            = mapped_column(String(7),  nullable=False)
    threshold_min: Mapped[Decimal]        = mapped_column(Numeric(5, 4), nullable=False)
    threshold_max: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 4))
    description:   Mapped[str]            = mapped_column(String(200), nullable=False)
    sort_order:    Mapped[int]            = mapped_column(Integer, nullable=False)
