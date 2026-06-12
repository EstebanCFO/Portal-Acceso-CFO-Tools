"""
test_api.py
Tests del backend Flask — camino feliz + manejo de errores.
Estructura:
  - TestHealth
  - TestOrganizaciones
  - TestProyectos
  - TestProyectoDetalle
  - TestTestPlans
  - TestGeneracion
  - TestHistorial
  - TestLogs
  - TestDescarga
  - TestSeguridad
  - TestProcesamiento   (procesamiento.py — sin HTTP)
  - TestExtraccion      (extraccion.py — sin HTTP)
"""
import os
import json
import pytest
from unittest.mock import patch, MagicMock, call
from tests.conftest import (
    AZURE_PROJECTS, AZURE_WIQL, AZURE_WORK_ITEMS, AZURE_ITERATIONS,
    AZURE_TEAMS, AZURE_MEMBERS, AZURE_TEST_PLANS, AZURE_TEST_SUITES,
    AZURE_TEST_RUNS, _TMP,
)

# ══════════════════════════════════════════════════════════════════════════════
# Health
# ══════════════════════════════════════════════════════════════════════════════

class TestHealth:
    def test_retorna_ok(self, client):
        r = client.get('/api/health')
        assert r.status_code == 200
        data = r.get_json()
        assert data['ok'] is True
        assert data['servicio'] == 'reporte-devops'

    def test_no_requiere_autenticacion(self, client):
        r = client.get('/api/health')
        assert r.status_code == 200

    def test_metodo_post_no_permitido(self, client):
        r = client.post('/api/health')
        assert r.status_code == 405


# ══════════════════════════════════════════════════════════════════════════════
# Organizaciones
# ══════════════════════════════════════════════════════════════════════════════

class TestOrganizaciones:
    def test_retorna_lista_desde_env(self, client):
        r = client.get('/api/organizaciones')
        assert r.status_code == 200
        orgs = r.get_json()
        assert isinstance(orgs, list)
        nombres = [o['nombre'] for o in orgs]
        assert 'TestOrg1' in nombres
        assert 'TestOrg2' in nombres
        assert 'TestOrg3' in nombres

    def test_cada_org_tiene_nombre_y_url(self, client):
        r = client.get('/api/organizaciones')
        for org in r.get_json():
            assert 'nombre' in org
            assert 'url' in org
            assert org['url'].startswith('https://dev.azure.com/')

    def test_url_incluye_nombre_org(self, client):
        r = client.get('/api/organizaciones')
        for org in r.get_json():
            assert org['nombre'] in org['url']

    # ── Refresh ──
    def test_refresh_con_azure_exitoso(self, client):
        perfil = {'id': 'user-123', 'displayName': 'Test User'}
        cuentas = {'value': [
            {'accountName': 'OrgRemota1'},
            {'accountName': 'OrgRemota2'},
        ]}
        with patch('requests.get') as mock_get:
            mock_get.side_effect = [
                MagicMock(status_code=200, json=lambda: perfil),
                MagicMock(status_code=200, json=lambda: cuentas),
            ]
            r = client.get('/api/organizaciones/refresh')
        assert r.status_code == 200
        data = r.get_json()
        assert data['ok'] is True
        assert data['total'] == 2
        nombres = [o['nombre'] for o in data['orgs']]
        assert 'OrgRemota1' in nombres

    def test_refresh_con_azure_fallido_retorna_ok_false(self, client):
        with patch('requests.get') as mock_get:
            mock_get.return_value = MagicMock(status_code=401, json=lambda: {})
            r = client.get('/api/organizaciones/refresh')
        assert r.status_code == 200  # endpoint no falla, devuelve ok:false
        data = r.get_json()
        assert data['ok'] is False
        assert data['total'] == 0

    def test_refresh_con_timeout_retorna_ok_false(self, client):
        with patch('requests.get', side_effect=Exception('Connection timeout')):
            r = client.get('/api/organizaciones/refresh')
        data = r.get_json()
        assert data['ok'] is False


# ══════════════════════════════════════════════════════════════════════════════
# Proyectos
# ══════════════════════════════════════════════════════════════════════════════

class TestProyectos:
    def test_retorna_proyectos_de_org(self, client):
        with patch('requests.get') as mock_get:
            mock_get.return_value = MagicMock(status_code=200, json=lambda: AZURE_PROJECTS)
            r = client.get('/api/proyectos/TestOrg1')
        assert r.status_code == 200
        proyectos = r.get_json()
        assert isinstance(proyectos, list)
        nombres = [p['nombre'] for p in proyectos]
        assert 'ProyectoAlpha' in nombres

    def test_excluye_proyectos_configurados(self, client):
        with patch('requests.get') as mock_get:
            mock_get.return_value = MagicMock(status_code=200, json=lambda: AZURE_PROJECTS)
            r = client.get('/api/proyectos/TestOrg1')
        proyectos = r.get_json()
        nombres = [p['nombre'] for p in proyectos]
        assert 'ProyectoIgnorado' not in nombres

    def test_cada_proyecto_tiene_id_nombre_estado(self, client):
        with patch('requests.get') as mock_get:
            mock_get.return_value = MagicMock(status_code=200, json=lambda: AZURE_PROJECTS)
            r = client.get('/api/proyectos/TestOrg1')
        for p in r.get_json():
            assert 'id' in p
            assert 'nombre' in p
            assert 'estado' in p

    def test_org_no_encontrada_retorna_lista_vacia(self, client):
        with patch('requests.get') as mock_get:
            mock_get.return_value = MagicMock(status_code=404, json=lambda: {})
            r = client.get('/api/proyectos/OrgInexistente')
        assert r.status_code == 200
        assert r.get_json() == []

    def test_timeout_azure_retorna_lista_vacia(self, client):
        with patch('requests.get', side_effect=Exception('Timeout')):
            r = client.get('/api/proyectos/TestOrg1')
        assert r.status_code == 200
        assert r.get_json() == []

    # ── Proyecto info ──
    def test_proyecto_info_retorna_estructura_esperada(self, client):
        with patch('requests.get') as mock_get:
            mock_get.side_effect = [
                MagicMock(status_code=200, json=lambda: AZURE_ITERATIONS),
                MagicMock(status_code=200, json=lambda: AZURE_TEAMS),
                MagicMock(status_code=200, json=lambda: AZURE_MEMBERS),
            ]
            r = client.get('/api/proyecto_info/TestOrg1/ProyectoAlpha')
        assert r.status_code == 200
        data = r.get_json()
        assert 'total_sprints' in data
        assert 'headcount' in data
        assert 'fecha_inicio' in data
        assert 'fecha_fin' in data
        assert 'miembros' in data

    def test_proyecto_info_con_error_azure_retorna_defaults(self, client):
        with patch('requests.get', side_effect=Exception('Network error')):
            r = client.get('/api/proyecto_info/TestOrg1/ProyectoAlpha')
        assert r.status_code == 200
        data = r.get_json()
        assert data['total_sprints'] == 0
        assert data['headcount'] == 0


# ══════════════════════════════════════════════════════════════════════════════
# Proyecto detalle (métricas + desvíos)
# ══════════════════════════════════════════════════════════════════════════════

class TestProyectoDetalle:
    def _mock_azure(self, mock_post, mock_get):
        # Orden de llamadas en get_proyecto_detalle:
        # post: WIQL general
        # get: work items
        # post: WIQL epicas
        # post: WIQL user stories
        # get: iterations
        mock_post.side_effect = [
            MagicMock(status_code=200, json=lambda: AZURE_WIQL),
            MagicMock(status_code=200, json=lambda: {'workItems': [{'id': 201}]}),  # epicas
            MagicMock(status_code=200, json=lambda: {'workItems': [{'id': 301}, {'id': 302}]}),  # US
        ]
        mock_get.side_effect = [
            MagicMock(status_code=200, json=lambda: AZURE_WORK_ITEMS),
            MagicMock(status_code=200, json=lambda: AZURE_ITERATIONS),
        ]

    def test_retorna_metricas_correctas(self, client):
        with patch('requests.post') as mp, patch('requests.get') as mg:
            self._mock_azure(mp, mg)
            r = client.get('/api/proyecto/TestOrg1/ProyectoAlpha')
        assert r.status_code == 200
        data = r.get_json()
        m = data['metricas']
        assert m['total'] == 2
        assert m['items_done'] == 1          # Closed
        assert m['avance_pct'] == 50.0
        assert m['horas_comp'] == 14.0       # 10 + 4
        assert m['horas_rest'] == 5.0        # 5 + 0
        assert m['sp_total'] == 4.0          # 3 + 1

    def test_retorna_desvios(self, client):
        with patch('requests.post') as mp, patch('requests.get') as mg:
            self._mock_azure(mp, mg)
            r = client.get('/api/proyecto/TestOrg1/ProyectoAlpha')
        data = r.get_json()
        assert isinstance(data['desvios'], list)
        assert data['desvios'][0]['nombre'] == 'Sprint 1'
        assert data['desvios'][0]['alerta'] in ('OK', 'DESVIO', 'RIESGO')

    def test_retorna_nombre_y_org(self, client):
        with patch('requests.post') as mp, patch('requests.get') as mg:
            self._mock_azure(mp, mg)
            r = client.get('/api/proyecto/TestOrg1/ProyectoAlpha')
        data = r.get_json()
        assert data['proyecto'] == 'ProyectoAlpha'
        assert data['organizacion'] == 'TestOrg1'

    def test_sin_work_items_avance_es_cero(self, client):
        wiql_vacio  = {'workItems': []}
        iters_vacio = {'value': []}
        with patch('requests.post') as mp, patch('requests.get') as mg:
            mp.side_effect = [
                MagicMock(status_code=200, json=lambda: wiql_vacio),
                MagicMock(status_code=200, json=lambda: wiql_vacio),
                MagicMock(status_code=200, json=lambda: wiql_vacio),
            ]
            mg.side_effect = [
                MagicMock(status_code=200, json=lambda: {'value': []}),
                MagicMock(status_code=200, json=lambda: iters_vacio),
            ]
            r = client.get('/api/proyecto/TestOrg1/ProyectoVacio')
        m = r.get_json()['metricas']
        assert m['total'] == 0
        assert m['avance_pct'] == 0


# ══════════════════════════════════════════════════════════════════════════════
# Test Plans
# ══════════════════════════════════════════════════════════════════════════════

class TestTestPlans:
    def test_retorna_planes_con_suites_y_runs(self, client):
        with patch('requests.get') as mg:
            mg.side_effect = [
                MagicMock(status_code=200, json=lambda: AZURE_TEST_PLANS),
                MagicMock(status_code=200, json=lambda: AZURE_TEST_SUITES),
                MagicMock(status_code=200, json=lambda: AZURE_TEST_RUNS),
            ]
            r = client.get('/api/testplans/TestOrg1/ProyectoAlpha')
        assert r.status_code == 200
        planes = r.get_json()
        assert len(planes) == 1
        plan = planes[0]
        assert plan['nombre'] == 'Plan de Pruebas Alpha'
        assert len(plan['suites']) == 1
        assert len(plan['runs']) == 1

    def test_resumen_calcula_totales(self, client):
        with patch('requests.get') as mg:
            mg.side_effect = [
                MagicMock(status_code=200, json=lambda: AZURE_TEST_PLANS),
                MagicMock(status_code=200, json=lambda: AZURE_TEST_SUITES),
                MagicMock(status_code=200, json=lambda: AZURE_TEST_RUNS),
            ]
            r = client.get('/api/testplans/TestOrg1/ProyectoAlpha')
        res = r.get_json()[0]['resumen']
        assert res['total_suites'] == 1
        assert res['total_casos'] == 5
        assert res['total_runs'] == 1
        assert res['pasados'] == 4
        assert res['fallidos'] == 1

    def test_sin_planes_retorna_lista_vacia(self, client):
        with patch('requests.get') as mg:
            mg.return_value = MagicMock(status_code=200, json=lambda: {'value': []})
            r = client.get('/api/testplans/TestOrg1/ProyectoAlpha')
        assert r.get_json() == []

    def test_error_azure_retorna_lista_vacia(self, client):
        with patch('requests.get', side_effect=Exception('Azure error')):
            r = client.get('/api/testplans/TestOrg1/ProyectoAlpha')
        assert r.status_code == 200
        assert r.get_json() == []


# ══════════════════════════════════════════════════════════════════════════════
# Generación (pipeline)
# ══════════════════════════════════════════════════════════════════════════════

class TestGeneracion:
    def test_generar_inicia_correctamente(self, client):
        with patch('threading.Thread') as mt:
            mt.return_value = MagicMock()
            r = client.post('/api/generar')
        assert r.status_code == 200
        data = r.get_json()
        assert data['ok'] is True

    def test_generar_con_generacion_en_curso_retorna_409(self, client):
        import app as _app
        _app.estado['corriendo'] = True
        r = client.post('/api/generar')
        assert r.status_code == 409
        data = r.get_json()
        assert data['ok'] is False

    def test_estado_inicial_es_idle(self, client):
        r = client.get('/api/estado')
        assert r.status_code == 200
        data = r.get_json()
        assert data['corriendo'] is False
        assert data['ultimo_estado'] == 'idle'

    def test_estado_tiene_todos_los_campos(self, client):
        r = client.get('/api/estado')
        data = r.get_json()
        campos = ['corriendo', 'ultimo_estado', 'ultimo_mensaje',
                  'ultimo_pdf', 'ultima_ejecucion', 'ultimo_log']
        for campo in campos:
            assert campo in data, f'Falta campo: {campo}'


# ══════════════════════════════════════════════════════════════════════════════
# Historial (PDFs generados)
# ══════════════════════════════════════════════════════════════════════════════

class TestHistorial:
    def test_lista_vacia_cuando_no_hay_pdfs(self, client):
        r = client.get('/api/historial')
        assert r.status_code == 200
        data = r.get_json()
        assert isinstance(data, list)

    def test_lista_pdf_cuando_existe_uno(self, client, pdf_en_output):
        r = client.get('/api/historial')
        assert r.status_code == 200
        data = r.get_json()
        nombres = [f['nombre'] for f in data]
        assert pdf_en_output in nombres

    def test_cada_pdf_tiene_nombre_fecha_size(self, client, pdf_en_output):
        r = client.get('/api/historial')
        for f in r.get_json():
            assert 'nombre' in f
            assert 'fecha' in f
            assert 'size' in f

    def test_maximo_20_pdfs(self, client):
        # Crear 25 PDFs en output dir
        nombres = []
        for i in range(25):
            nombre = f'informe_devops_202601{i:02d}.pdf'
            path   = os.path.join(_TMP, nombre)
            with open(path, 'wb') as f:
                f.write(b'%PDF fake')
            nombres.append((nombre, path))
        r = client.get('/api/historial')
        assert len(r.get_json()) <= 20
        for _, path in nombres:
            if os.path.exists(path): os.remove(path)


# ══════════════════════════════════════════════════════════════════════════════
# Logs
# ══════════════════════════════════════════════════════════════════════════════

class TestLogs:
    def _crear_log(self, contenido='INFO Test log line\nERROR Test error'):
        import app as _app
        nombre = 'Trace_10_06_2026_12_00_00.log'
        path   = os.path.join(_app.LOG_DIR, nombre)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(contenido)
        return nombre, path

    def test_lista_logs(self, client):
        nombre, path = self._crear_log()
        try:
            r = client.get('/api/logs')
            assert r.status_code == 200
            assert isinstance(r.get_json(), list)
        finally:
            if os.path.exists(path): os.remove(path)

    def test_log_en_lista_tiene_campos_esperados(self, client):
        nombre, path = self._crear_log()
        try:
            r  = client.get('/api/logs')
            ls = [l for l in r.get_json() if l['nombre'] == nombre]
            assert len(ls) == 1
            assert 'nombre' in ls[0]
            assert 'fecha'  in ls[0]
            assert 'size'   in ls[0]
        finally:
            if os.path.exists(path): os.remove(path)

    def test_leer_contenido_de_log(self, client):
        contenido = '10/06/2026 [INFO] Servidor iniciado\n10/06/2026 [ERROR] Falló algo'
        nombre, path = self._crear_log(contenido)
        try:
            r = client.get(f'/api/logs/{nombre}')
            assert r.status_code == 200
            data = r.get_json()
            assert data['nombre'] == nombre
            assert 'Servidor iniciado' in data['contenido']
        finally:
            if os.path.exists(path): os.remove(path)

    def test_log_inexistente_retorna_404(self, client):
        r = client.get('/api/logs/Trace_no_existe.log')
        assert r.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# Descarga de PDF
# ══════════════════════════════════════════════════════════════════════════════

class TestDescarga:
    def test_descarga_pdf_existente(self, client, pdf_en_output):
        r = client.get(f'/api/descargar/{pdf_en_output}')
        assert r.status_code == 200
        assert r.content_type in ('application/pdf', 'application/octet-stream')

    def test_descarga_pdf_inexistente_retorna_404(self, client):
        r = client.get('/api/descargar/no_existe.pdf')
        assert r.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# Seguridad — path traversal + acceso a archivos no autorizados
# ══════════════════════════════════════════════════════════════════════════════

class TestSeguridad:
    def test_logs_solo_acepta_archivos_trace(self, client):
        # Intentar leer un archivo que no empieza con "Trace_"
        for nombre in ['../app.py', '.env', 'requirements.txt', 'notrace.log']:
            r = client.get(f'/api/logs/{nombre}')
            assert r.status_code == 404, f'Debería rechazar: {nombre}'

    def test_descarga_no_sirve_archivos_no_pdf(self, client):
        # Solo archivos .pdf en OUTPUT_DIR
        for nombre in ['app.py', '../.env', 'datos_raw.json']:
            r = client.get(f'/api/descargar/{nombre}')
            assert r.status_code == 404, f'Debería rechazar: {nombre}'

    def test_cors_origen_permitido(self, client):
        r = client.get('/api/health', headers={'Origin': 'http://localhost:5001'})
        assert r.status_code == 200
        # flask-cors agrega el header Access-Control-Allow-Origin
        assert 'Access-Control-Allow-Origin' in r.headers


# ══════════════════════════════════════════════════════════════════════════════
# Tests de lógica pura — procesamiento.py (sin HTTP)
# ══════════════════════════════════════════════════════════════════════════════

class TestProcesamiento:
    def setup_method(self):
        import sys
        if 'procesamiento' in sys.modules:
            del sys.modules['procesamiento']
        import procesamiento
        self.proc = procesamiento

    def test_calcular_metricas_con_items(self):
        items = [
            {'fields': {'System.State': 'Active',   'System.WorkItemType': 'User Story',
                        'Microsoft.VSTS.Scheduling.StoryPoints': 5,
                        'Microsoft.VSTS.Scheduling.CompletedWork': 10,
                        'Microsoft.VSTS.Scheduling.RemainingWork': 5}},
            {'fields': {'System.State': 'Closed',   'System.WorkItemType': 'Bug',
                        'Microsoft.VSTS.Scheduling.StoryPoints': 2,
                        'Microsoft.VSTS.Scheduling.CompletedWork': 8,
                        'Microsoft.VSTS.Scheduling.RemainingWork': 0}},
        ]
        m = self.proc.calcular_metricas(items)
        assert m['total']      == 2
        assert m['items_done'] == 1        # Closed
        assert m['sp_total']   == 7.0
        assert m['sp_done']    == 2.0
        assert m['avance_pct'] == 50.0
        assert m['horas_comp'] == 18.0
        assert m['horas_rest'] == 5.0

    def test_calcular_metricas_lista_vacia(self):
        m = self.proc.calcular_metricas([])
        assert m['total']      == 0
        assert m['avance_pct'] == 0
        assert m['sp_total']   == 0

    def test_calcular_metricas_sin_story_points(self):
        items = [{'fields': {'System.State': 'Active', 'System.WorkItemType': 'Task'}}]
        m = self.proc.calcular_metricas(items)
        assert m['sp_total']  == 0
        assert m['horas_comp'] == 0

    def test_calcular_desvios_sprint_actual_sin_desvio(self):
        from datetime import date, timedelta
        fin_futuro = (date.today() + timedelta(days=7)).isoformat() + 'T00:00:00Z'
        iters = [{'id': 'i1', 'name': 'Sprint Actual',
                  'attributes': {'startDate': date.today().isoformat() + 'T00:00:00Z',
                                 'finishDate': fin_futuro, 'timeFrame': 'current'}}]
        desvios = self.proc.calcular_desvios(iters)
        assert desvios[0]['desvio_dias'] == 0
        assert desvios[0]['alerta'] == 'OK'

    def test_calcular_desvios_sprint_vencido_con_desvio(self):
        from datetime import date, timedelta
        fin_pasado = (date.today() - timedelta(days=10)).isoformat() + 'T00:00:00Z'
        iters = [{'id': 'i1', 'name': 'Sprint Retrasado',
                  'attributes': {'startDate': '2026-01-01T00:00:00Z',
                                 'finishDate': fin_pasado, 'timeFrame': 'current'}}]
        desvios = self.proc.calcular_desvios(iters)
        assert desvios[0]['desvio_dias'] == 10
        assert desvios[0]['alerta'] == 'RIESGO'

    def test_calcular_desvios_sprint_pasado_sin_desvio(self):
        """Sprints pasados (timeFrame='past') nunca tienen desvío aunque la fecha haya pasado."""
        iters = [{'id': 'i1', 'name': 'Sprint Pasado',
                  'attributes': {'startDate': '2026-01-01T00:00:00Z',
                                 'finishDate': '2026-01-14T00:00:00Z', 'timeFrame': 'past'}}]
        desvios = self.proc.calcular_desvios(iters)
        assert desvios[0]['desvio_dias'] == 0

    def test_alerta_es_desvio_para_1_a_7_dias(self):
        from datetime import date, timedelta
        fin_pasado = (date.today() - timedelta(days=3)).isoformat() + 'T00:00:00Z'
        iters = [{'id': 'i1', 'name': 'Sprint Leve',
                  'attributes': {'startDate': '2026-01-01T00:00:00Z',
                                 'finishDate': fin_pasado, 'timeFrame': 'current'}}]
        desvios = self.proc.calcular_desvios(iters)
        assert desvios[0]['alerta'] == 'DESVIO'


# ══════════════════════════════════════════════════════════════════════════════
# Tests de extraccion.py (lógica pura, sin HTTP)
# ══════════════════════════════════════════════════════════════════════════════

class TestExtraccion:
    def setup_method(self):
        import sys
        if 'extraccion' in sys.modules:
            del sys.modules['extraccion']
        import extraccion
        self.ext = extraccion

    def test_get_orgs_desde_csv_env(self):
        orgs = self.ext.get_orgs()
        assert len(orgs) == 3
        assert 'https://dev.azure.com/TestOrg1' in orgs[0]

    def test_get_projects_exitoso(self):
        with patch('requests.get') as mg:
            mg.return_value = MagicMock(status_code=200, json=lambda: AZURE_PROJECTS)
            proyectos = self.ext.get_projects('https://dev.azure.com/TestOrg1')
        assert len(proyectos) == 2

    def test_get_projects_http_error_retorna_vacio(self):
        with patch('requests.get') as mg:
            mg.return_value = MagicMock(status_code=403)
            proyectos = self.ext.get_projects('https://dev.azure.com/TestOrg1')
        assert proyectos == []

    def test_get_projects_timeout_retorna_vacio(self):
        with patch('requests.get', side_effect=Exception('Timeout')):
            proyectos = self.ext.get_projects('https://dev.azure.com/TestOrg1')
        assert proyectos == []

    def test_get_work_items_retorna_items(self):
        with patch('requests.post') as mp, patch('requests.get') as mg:
            mp.return_value = MagicMock(status_code=200, json=lambda: AZURE_WIQL)
            mg.return_value = MagicMock(status_code=200, json=lambda: AZURE_WORK_ITEMS)
            items = self.ext.get_work_items('https://dev.azure.com/TestOrg1', 'ProyectoAlpha')
        assert len(items) == 2

    def test_get_work_items_sin_ids_retorna_vacio(self):
        wiql_vacio = {'workItems': []}
        with patch('requests.post') as mp:
            mp.return_value = MagicMock(status_code=200, json=lambda: wiql_vacio)
            items = self.ext.get_work_items('https://dev.azure.com/TestOrg1', 'ProyectoVacio')
        assert items == []

    def test_get_iterations_retorna_sprints(self):
        with patch('requests.get') as mg:
            mg.return_value = MagicMock(status_code=200, json=lambda: AZURE_ITERATIONS)
            iters = self.ext.get_iterations('https://dev.azure.com/TestOrg1', 'ProyectoAlpha')
        assert len(iters) == 1
        assert iters[0]['name'] == 'Sprint 1'
