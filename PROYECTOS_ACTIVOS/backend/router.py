"""router.py — FastAPI router (montable inline en portal_server.py o standalone)."""
from __future__ import annotations
import os
import sys
import shutil
import tempfile
from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db

# Ruta al ETL (un nivel arriba del backend/)
_ETL_DIR = os.path.join(os.path.dirname(__file__), '..', 'etl')
if _ETL_DIR not in sys.path:
    sys.path.insert(0, _ETL_DIR)

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


# ── Ingest Excel ──────────────────────────────────────────────────────────────

@router.post('/api/ingest')
async def ingest_excel(file: UploadFile = File(...)):
    """
    Recibe un archivo .xlsx, ejecuta el ETL completo y devuelve estadísticas.
    El frontend lo usa para actualizar los datos sin salir de la app.
    """
    if not file.filename or not file.filename.lower().endswith('.xlsx'):
        raise HTTPException(status_code=422, detail='Solo se aceptan archivos .xlsx')

    # Guardar en archivo temporal (el ETL necesita una ruta en disco)
    tmp = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
    try:
        shutil.copyfileobj(file.file, tmp)
        tmp.close()

        from ingest import ingest_from_file
        stats = ingest_from_file(tmp.name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error en ETL: {e}')
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass

    return {
        'ok':                  True,
        'period':              stats.get('period'),
        'solapas_real':        stats.get('solapas_real', 0),
        'recursos_total':      stats.get('recursos_total', 0),
        'semaforo_acumulado':  stats.get('semaforo_acumulado', 0),
        'semaforo_mensual':    stats.get('semaforo_mensual', 0),
        'semaforo_matched':    stats.get('semaforo_matched', 0),
        'semaforo_unmatched':  stats.get('semaforo_unmatched', 0),
        'unmatched_names':     stats.get('unmatched_names', []),
    }
