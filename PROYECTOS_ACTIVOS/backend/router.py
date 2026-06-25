"""router.py — FastAPI router (montable inline en portal_server.py o standalone)."""
from __future__ import annotations
from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db

router = APIRouter(tags=['proyectos-activos'])


# ── Health ────────────────────────────────────────────────────────────────────

@router.get('/api/health')
def health():
    return {'status': 'ok', 'app': 'proyectos-activos'}


# ── Períodos ──────────────────────────────────────────────────────────────────

@router.get('/api/periodos', response_model=List[schemas.PeriodoOut])
def list_periodos(db: Session = Depends(get_db)):
    """Lista todos los períodos disponibles (meses con datos cargados)."""
    return crud.get_periodos(db)


# ── Referencia de semáforo ────────────────────────────────────────────────────

@router.get('/api/semaforo/referencia', response_model=List[schemas.SemaforoReferenceOut])
def semaforo_referencia(db: Session = Depends(get_db)):
    """Umbrales de color del semáforo (tabla paramétrica)."""
    return crud.get_semaforo_referencia(db)


# ── Semáforo General ──────────────────────────────────────────────────────────

@router.get('/api/semaforo', response_model=schemas.SemaforoGeneralOut)
def semaforo_general(
    period: Optional[str] = Query(None, description='Período YYYY-MM-DD. Default: último disponible.'),
    type:   str            = Query('ACUMULADO', description='ACUMULADO | MENSUAL'),
    db:     Session        = Depends(get_db),
):
    """
    Cuadro de semáforo general.
    Si no se especifica `period`, usa el período más reciente disponible.
    """
    if period:
        try:
            period_date = date.fromisoformat(period if len(period) == 10 else f'{period}-01')
        except ValueError:
            raise HTTPException(status_code=422, detail=f'Período inválido: {period}. Usar YYYY-MM-DD o YYYY-MM.')
    else:
        period_date = crud.get_latest_period(db)
        if not period_date:
            raise HTTPException(status_code=404, detail='No hay datos cargados aún. Ejecutar el ETL.')

    semaforo_type = type.upper()
    if semaforo_type not in ('ACUMULADO', 'MENSUAL'):
        raise HTTPException(status_code=422, detail='type debe ser ACUMULADO o MENSUAL.')

    return crud.get_semaforo_general(db, period_date, semaforo_type)


# ── Lista de proyectos ────────────────────────────────────────────────────────

@router.get('/api/proyectos', response_model=List[schemas.ProjectListItem])
def list_proyectos(
    solo_activos: bool    = Query(True),
    db:           Session = Depends(get_db),
):
    """Lista todos los proyectos (con cliente)."""
    return crud.get_projects(db, only_active=solo_activos)


# ── Ejercicio Económico ───────────────────────────────────────────────────────

@router.get('/api/proyectos/{project_id}/ejercicio', response_model=schemas.EjercicioEconomicoOut)
def ejercicio_economico(
    project_id: int,
    period:     Optional[str] = Query(None, description='Período YYYY-MM-DD. Default: último disponible.'),
    db:         Session       = Depends(get_db),
):
    """
    Detalle completo del ejercicio económico de un proyecto:
    recursos, financiero y serie histórica.
    """
    if period:
        try:
            period_date = date.fromisoformat(period if len(period) == 10 else f'{period}-01')
        except ValueError:
            raise HTTPException(status_code=422, detail=f'Período inválido: {period}')
    else:
        period_date = crud.get_latest_period(db)
        if not period_date:
            raise HTTPException(status_code=404, detail='No hay datos cargados aún. Ejecutar el ETL.')

    result = crud.get_ejercicio_economico(db, project_id, period_date)
    if not result:
        raise HTTPException(status_code=404, detail=f'Proyecto {project_id} no encontrado.')
    return result
