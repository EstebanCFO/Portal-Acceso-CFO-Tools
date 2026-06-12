"""
conftest.py
Fixtures compartidas para todos los tests del backend.
Las variables de entorno se fijan ANTES de importar app.py para
que load_dotenv() no las sobreescriba.
"""
import os
import sys
import tempfile
import json
import pytest

# ── Variables de entorno de test (se fijan antes del import) ─────────────────
_TMP = tempfile.mkdtemp(prefix='devops_test_')

os.environ['AZURE_DEVOPS_PAT']  = 'test-pat-fake-12345'
os.environ['AZURE_DEVOPS_ORG']  = 'https://dev.azure.com/TestOrg1/'
os.environ['AZURE_DEVOPS_ORGS'] = 'TestOrg1,TestOrg2,TestOrg3'
os.environ['OUTPUT_DIR']        = _TMP
os.environ['FRONTEND_URL']      = 'http://localhost:5001'
os.environ['PROYECTOS_EXCLUIDOS'] = 'ProyectoIgnorado'

# Asegurar que app se importa con las env vars correctas
if 'app' in sys.modules:
    del sys.modules['app']

import app as _flask_app  # noqa: E402  — import tardío intencional


# ── Fixture: cliente Flask ────────────────────────────────────────────────────
@pytest.fixture
def client():
    _flask_app.app.config['TESTING'] = True
    with _flask_app.app.test_client() as c:
        yield c


# ── Fixture: reset estado de generación entre tests ──────────────────────────
@pytest.fixture(autouse=True)
def reset_estado():
    _flask_app.estado.update({
        'corriendo':        False,
        'ultimo_estado':    'idle',
        'ultimo_mensaje':   '',
        'ultimo_pdf':       '',
        'ultima_ejecucion': '',
        'ultimo_log':       '',
    })
    yield


# ── Fixture: archivo PDF de prueba en OUTPUT_DIR ─────────────────────────────
@pytest.fixture
def pdf_en_output():
    nombre = 'informe_devops_20260610.pdf'
    path   = os.path.join(_TMP, nombre)
    with open(path, 'wb') as f:
        f.write(b'%PDF-1.4 fake pdf content')
    yield nombre
    if os.path.exists(path):
        os.remove(path)


# ── Fixture: datos procesados de prueba ──────────────────────────────────────
@pytest.fixture
def datos_procesados():
    datos = [
        {
            'proyecto':     'ProyectoAlpha',
            'organizacion': 'TestOrg1',
            'estado':       'wellFormed',
            'metricas': {
                'total': 42, 'estados': {'Active': 20, 'Closed': 22},
                'tipos': {'User Story': 30, 'Bug': 12},
                'sp_total': 84.0, 'sp_done': 44.0, 'avance_pct': 52.4,
                'items_done': 22, 'horas_comp': 120.0, 'horas_rest': 80.0,
            },
            'desvios': [
                {'nombre': 'Sprint 1', 'inicio': '2026-01-01',
                 'fin_planeado': '2026-01-14', 'estado': 'past',
                 'desvio_dias': 0, 'alerta': 'OK'},
            ],
        }
    ]
    path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'datos_procesados.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(datos, f)
    yield datos
    if os.path.exists(path):
        os.remove(path)


# ── Payloads Azure mock ───────────────────────────────────────────────────────
AZURE_PROJECTS = {
    'count': 2,
    'value': [
        {'id': 'proj-1', 'name': 'ProyectoAlpha', 'state': 'wellFormed'},
        {'id': 'proj-2', 'name': 'ProyectoIgnorado', 'state': 'wellFormed'},
    ],
}

AZURE_WIQL = {
    'workItems': [{'id': 101}, {'id': 102}],
}

AZURE_WORK_ITEMS = {
    'value': [
        {
            'id': 101,
            'fields': {
                'System.State': 'Active',
                'System.WorkItemType': 'User Story',
                'Microsoft.VSTS.Scheduling.StoryPoints': 3,
                'Microsoft.VSTS.Scheduling.CompletedWork': 10,
                'Microsoft.VSTS.Scheduling.RemainingWork': 5,
            },
        },
        {
            'id': 102,
            'fields': {
                'System.State': 'Closed',
                'System.WorkItemType': 'Bug',
                'Microsoft.VSTS.Scheduling.StoryPoints': 1,
                'Microsoft.VSTS.Scheduling.CompletedWork': 4,
                'Microsoft.VSTS.Scheduling.RemainingWork': 0,
            },
        },
    ]
}

AZURE_ITERATIONS = {
    'value': [
        {
            'id': 'iter-1', 'name': 'Sprint 1',
            'attributes': {
                'startDate': '2026-01-01T00:00:00Z',
                'finishDate': '2026-01-14T00:00:00Z',
                'timeFrame': 'past',
            },
        },
    ]
}

AZURE_TEAMS = {
    'value': [{'id': 'team-1', 'name': 'Equipo Alpha'}]
}

AZURE_MEMBERS = {
    'value': [
        {'identity': {'displayName': 'Juan Pérez'}},
        {'identity': {'displayName': 'Ana García'}},
    ]
}

AZURE_TEST_PLANS = {
    'value': [
        {'id': 1, 'name': 'Plan de Pruebas Alpha', 'state': 'Active'},
    ]
}

AZURE_TEST_SUITES = {
    'value': [
        {'id': 10, 'name': 'Suite Login', 'testCaseCount': 5},
    ]
}

AZURE_TEST_RUNS = {
    'value': [
        {'id': 100, 'name': 'Run 1', 'state': 'Completed',
         'totalTests': 5, 'passedTests': 4, 'failedTests': 1},
    ]
}
