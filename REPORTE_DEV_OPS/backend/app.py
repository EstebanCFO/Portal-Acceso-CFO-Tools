"""
app.py — Reporte DevOps CFOTech IT Tools
API Flask pura (sin templates). El frontend React corre separado en :5001.
Puerto: 5000
"""

import os
import json
import socket
import logging
import datetime
import threading
import subprocess
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from base64 import b64encode
from urllib.parse import quote as urlquote
from flask import Flask, jsonify, send_file, request
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# CORS: permite llamadas desde el frontend React y desde el portal shell.
# En entornos hosteados, definir FRONTEND_URL y PORTAL_ORIGIN en backend/.env.
FRONTEND_URL  = os.getenv('FRONTEND_URL',  'http://localhost:5001')
PORTAL_ORIGIN = os.getenv('PORTAL_ORIGIN', 'http://localhost:5174')
CORS(app, origins=[FRONTEND_URL, PORTAL_ORIGIN])

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.getenv('OUTPUT_DIR', os.path.join(BASE_DIR, 'output'))
LOG_DIR    = os.path.join(BASE_DIR, 'logs')
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(LOG_DIR,    exist_ok=True)

PAT = os.getenv('AZURE_DEVOPS_PAT')
HDR = {
    'Authorization': 'Basic ' + b64encode(f':{PAT}'.encode()).decode(),
    'Content-Type': 'application/json',
}


# ── Logger ──────────────────────────────────────────────────
def make_logger(name: str):
    ts   = datetime.datetime.now().strftime('Trace_%d_%m_%Y_%H_%M_%S')
    path = os.path.join(LOG_DIR, f'{ts}.log')
    log  = logging.getLogger(name)
    log.setLevel(logging.DEBUG)
    if not log.handlers:
        fh = logging.FileHandler(path, encoding='utf-8')
        fh.setFormatter(logging.Formatter(
            '%(asctime)s [%(levelname)s] %(message)s',
            datefmt='%d/%m/%Y %H:%M:%S',
        ))
        log.addHandler(fh)
    return log, path


app_logger, _ = make_logger('app')
app_logger.info('=' * 60)
app_logger.info('INICIO — Reporte DevOps CFOTech (API Flask)')
app_logger.info(f'BASE_DIR:    {BASE_DIR}')
app_logger.info(f'OUTPUT_DIR:  {OUTPUT_DIR}')
app_logger.info(f'FRONTEND:    {FRONTEND_URL}')
app_logger.info('=' * 60)

# Estado compartido de generación
estado = {
    'corriendo':        False,
    'ultimo_estado':    'idle',
    'ultimo_mensaje':   '',
    'ultimo_pdf':       '',
    'ultima_ejecucion': '',
    'ultimo_log':       '',
}


# ── Helpers Azure DevOps ────────────────────────────────────
def az_get(url: str):
    try:
        r = requests.get(url, headers=HDR, timeout=15)
        app_logger.debug(f'AZ GET {url} -> {r.status_code}')
        return r.json() if r.status_code == 200 else None
    except Exception as e:
        app_logger.error(f'AZ GET ERROR {url}: {e}')
        return None


def az_post(url: str, body: dict):
    try:
        r = requests.post(url, json=body, headers=HDR, timeout=15)
        app_logger.debug(f'AZ POST {url} -> {r.status_code}')
        return r.json() if r.status_code == 200 else None
    except Exception as e:
        app_logger.error(f'AZ POST ERROR {url}: {e}')
        return None


# ── Sprint helpers ──────────────────────────────────────────
# Estados considerados "cerrados" — igual que el script PowerShell de referencia.
ESTADOS_CERRADOS = frozenset({
    'Closed', 'Done', 'Resolved', 'Completed',
    'Fixed', 'Removed', 'Resuelta', 'Finalizado',
})


def _wiql_post(org: str, project_ref: str, query: str):
    """WIQL con charset=utf-8 explícito para soportar proyectos con tildes.
    No filtra por [System.TeamProject] en la query — evita problemas con
    caracteres especiales en nombres de proyecto."""
    ref  = urlquote(project_ref, safe='')
    url  = f'https://dev.azure.com/{org}/{ref}/_apis/wit/wiql?api-version=7.1'
    hdr  = dict(HDR)
    hdr['Content-Type'] = 'application/json; charset=utf-8'
    body = json.dumps({'query': query}).encode('utf-8')
    try:
        r = requests.post(url, data=body, headers=hdr, timeout=15)
        app_logger.debug(f'WIQL {org}/{project_ref} -> {r.status_code}')
        return r.json() if r.status_code == 200 else None
    except Exception as e:
        app_logger.error(f'WIQL error {url}: {e}')
        return None


def _az_get_ref(org: str, project_ref: str, path: str):
    """az_get con project_ref URL-encoded."""
    ref = urlquote(project_ref, safe='')
    return az_get(f'https://dev.azure.com/{org}/{ref}/{path}')


def get_resumen_sprint(org: str, project_ref: str, iter_path: str) -> dict:
    """Work items de una iteración: total / abiertas / cerradas / por estado.
    Batch de 200 IDs igual que el script PS."""
    result = {'total': 0, 'abiertas': 0, 'cerradas': 0, 'estados': {}}
    try:
        query = (
            f"SELECT [System.Id],[System.State] FROM WorkItems "
            f"WHERE [System.IterationPath] UNDER '{iter_path}'"
        )
        wiql = _wiql_post(org, project_ref, query)
        if not wiql:
            return result
        ids = [i['id'] for i in wiql.get('workItems', [])]
        result['total'] = len(ids)
        if not ids:
            return result
        ref = urlquote(project_ref, safe='')
        items = []
        for i in range(0, len(ids), 200):
            chunk = ','.join(map(str, ids[i:i + 200]))
            batch = az_get(
                f'https://dev.azure.com/{org}/{ref}/_apis/wit/workitems'
                f'?ids={chunk}&fields=System.State&api-version=7.1'
            )
            if batch:
                items.extend(batch.get('value', []))
        for item in items:
            estado = item.get('fields', {}).get('System.State', 'Unknown')
            result['estados'][estado] = result['estados'].get(estado, 0) + 1
            if estado in ESTADOS_CERRADOS:
                result['cerradas'] += 1
            else:
                result['abiertas'] += 1
    except Exception as e:
        app_logger.error(f'get_resumen_sprint error {org}/{project_ref}: {e}')
    return result


def get_tc_ids_por_iteracion(org: str, project_ref: str, iter_path: str) -> set:
    """IDs de Test Cases asignados a una iteración (para filtrar test points)."""
    ids: set = set()
    try:
        query = (
            f"SELECT [System.Id] FROM WorkItems "
            f"WHERE [System.WorkItemType]='Test Case' "
            f"AND [System.IterationPath] UNDER '{iter_path}'"
        )
        data = _wiql_post(org, project_ref, query)
        if data:
            ids = {i['id'] for i in data.get('workItems', [])}
    except Exception as e:
        app_logger.error(f'get_tc_ids error {org}/{project_ref}: {e}')
    return ids


def get_testplan_progress(
    org: str, project_ref: str, sprint_nombre: str, iter_path: str
) -> dict:
    """Test plan progress para un sprint.
    Estrategia: match por nombre de sprint → fallback al plan con ID más alto.
    Paginación via x-ms-continuationtoken igual que el script PS."""
    resultado = {
        'encontrado': False, 'planNombre': '', 'totalPlanes': 0,
        'total': 0, 'corridos': 0, 'pasados': 0,
        'pctCorridos': 0.0, 'pctPass': 0.0,
    }
    try:
        ref        = urlquote(project_ref, safe='')
        planes_raw = az_get(f'https://dev.azure.com/{org}/{ref}/_apis/testplan/plans?api-version=7.1')
        if not planes_raw:
            return resultado
        planes_activos = [p for p in planes_raw.get('value', []) if p.get('state') == 'Active']
        resultado['totalPlanes'] = len(planes_activos)
        if not planes_activos:
            return resultado

        # Estrategia 1: plan cuyo nombre contiene el nombre del sprint
        plan = next(
            (p for p in planes_activos if sprint_nombre.lower() in p['name'].lower()),
            None,
        )
        # Estrategia 2: plan más reciente por ID
        if not plan:
            plan = sorted(planes_activos, key=lambda p: p['id'], reverse=True)[0]

        resultado['encontrado'] = True
        resultado['planNombre'] = plan['name']
        plan_id = plan['id']

        # Test cases de la iteración (para filtrar test points)
        tc_ids_iter = get_tc_ids_por_iteracion(org, project_ref, iter_path)

        # Suites del plan
        suites_raw = az_get(
            f'https://dev.azure.com/{org}/{ref}/_apis/testplan/Plans/{plan_id}/suites?api-version=7.1'
        )
        if not suites_raw:
            return resultado

        total_casos = corridos = pasados = 0
        hdr_get = {k: v for k, v in HDR.items() if k != 'Content-Type'}

        for suite in suites_raw.get('value', []):
            sid = suite['id']
            try:
                # Contar test cases de la suite
                tc_raw = az_get(
                    f'https://dev.azure.com/{org}/{ref}/_apis/testplan/Plans/{plan_id}'
                    f'/Suites/{sid}/TestCase?api-version=7.1'
                )
                casos = tc_raw.get('value', []) if tc_raw else []
                if tc_ids_iter:
                    casos = [c for c in casos if int(c['workItem']['id']) in tc_ids_iter]
                total_casos += len(casos)

                # Test points con paginación
                cont_token = None
                while True:
                    url_tp = (
                        f'https://dev.azure.com/{org}/{ref}/_apis/testplan/Plans/{plan_id}'
                        f'/Suites/{sid}/TestPoint?api-version=7.1&$top=100'
                    )
                    if cont_token:
                        url_tp += f'&continuationToken={cont_token}'
                    resp = requests.get(url_tp, headers=hdr_get, timeout=10)
                    if resp.status_code != 200:
                        break
                    pt_data = resp.json()
                    for pt in pt_data.get('value', []):
                        if tc_ids_iter and int(pt['testCase']['id']) not in tc_ids_iter:
                            continue
                        outcome = (pt.get('results') or {}).get('outcome', '')
                        if outcome and outcome != 'unspecified':
                            corridos += 1
                            if outcome == 'passed':
                                pasados += 1
                    cont_token = resp.headers.get('x-ms-continuationtoken')
                    if not cont_token:
                        break
            except Exception as e:
                app_logger.warning(f'Suite {sid} progress error: {e}')
                continue

        resultado['total']       = total_casos
        resultado['corridos']    = corridos
        resultado['pasados']     = pasados
        resultado['pctCorridos'] = round(corridos / total_casos * 100, 1) if total_casos  > 0 else 0.0
        resultado['pctPass']     = round(pasados  / corridos  * 100, 1) if corridos > 0 else 0.0
    except Exception as e:
        app_logger.error(f'get_testplan_progress error {org}/{project_ref}: {e}')
    return resultado


# ── Pipeline de generación ──────────────────────────────────
def ejecutar_scripts():
    global estado
    ts         = datetime.datetime.now().strftime('Trace_%d_%m_%Y_%H_%M_%S')
    log_path   = os.path.join(LOG_DIR, f'{ts}.log')
    run_logger = logging.getLogger(ts)
    run_logger.setLevel(logging.DEBUG)
    fh = logging.FileHandler(log_path, encoding='utf-8')
    fh.setFormatter(logging.Formatter(
        '%(asctime)s [%(levelname)s] %(message)s', datefmt='%d/%m/%Y %H:%M:%S',
    ))
    run_logger.addHandler(fh)

    estado.update({
        'corriendo': True, 'ultimo_estado': 'corriendo',
        'ultima_ejecucion': datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S'),
        'ultimo_log': os.path.basename(log_path),
    })
    run_logger.info('=' * 60)
    run_logger.info('INICIO generacion de informe')

    scripts = [
        ('extraccion.py',    'Extrayendo datos de Azure DevOps...'),
        ('procesamiento.py', 'Calculando métricas...'),
        ('generar_pdf.py',   'Generando PDF...'),
    ]
    try:
        for script, msg in scripts:
            estado['ultimo_mensaje'] = msg
            run_logger.info(f'--- {script} ---')
            result = subprocess.run(
                ['python', os.path.join(BASE_DIR, script)],
                capture_output=True, text=True, cwd=BASE_DIR,
            )
            for line in (result.stdout or '').strip().splitlines():
                if line.strip():
                    run_logger.info(f'  [stdout] {line}')
            for line in (result.stderr or '').strip().splitlines():
                if line.strip():
                    run_logger.warning(f'  [stderr] {line}')
            if result.returncode != 0:
                raise RuntimeError(f'Error en {script}: {result.stderr[:300]}')

        pdfs = sorted([f for f in os.listdir(OUTPUT_DIR) if f.endswith('.pdf')], reverse=True)
        if pdfs:
            estado.update({'ultimo_pdf': pdfs[0], 'ultimo_estado': 'ok',
                           'ultimo_mensaje': f'Informe generado: {pdfs[0]}'})
        else:
            raise RuntimeError('PDF no encontrado tras la generación')
    except Exception as e:
        estado.update({'ultimo_estado': 'error', 'ultimo_mensaje': str(e)})
        run_logger.error(f'ERROR: {e}', exc_info=True)
    finally:
        estado['corriendo'] = False
        run_logger.info('FIN generacion')
        for h in run_logger.handlers[:]:
            h.close(); run_logger.removeHandler(h)


# ── Middleware ───────────────────────────────────────────────
@app.before_request
def log_req():
    if app.debug:  # guard: no logear requests en producción (S1-10)
        app_logger.debug(f'REQUEST:  {request.method} {request.path} from {request.remote_addr}')


@app.after_request
def log_res(response):
    if app.debug:  # guard: no logear responses en producción (S1-10)
        app_logger.debug(f'RESPONSE: {response.status_code} {request.method} {request.path}')
    return response


# ── Health ───────────────────────────────────────────────────
@app.route('/api/health')
def health():
    return jsonify({'ok': True, 'servicio': 'reporte-devops'})


# ── Generación ───────────────────────────────────────────────
@app.route('/api/generar', methods=['POST'])
def generar():
    if estado['corriendo']:
        return jsonify({'ok': False, 'mensaje': 'Ya hay una generación en curso'}), 409
    threading.Thread(target=ejecutar_scripts, daemon=True).start()
    return jsonify({'ok': True, 'mensaje': 'Iniciado'})


@app.route('/api/estado')
def get_estado():
    return jsonify(estado)


# ── Organizaciones ───────────────────────────────────────────
def _fetch_orgs_from_azure() -> list:
    """Consulta Azure DevOps API para obtener todas las orgs del PAT.
    Devuelve lista de {'nombre', 'url'} ordenada alfabéticamente.
    Lanza Exception si falla la llamada."""
    r_perfil = requests.get(
        'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1',
        headers=HDR, timeout=20,
    )
    if r_perfil.status_code != 200:
        raise Exception(f'Perfil HTTP {r_perfil.status_code}')
    user_id = r_perfil.json().get('id')
    if not user_id:
        raise Exception('Sin user_id en perfil')
    r_orgs = requests.get(
        f'https://app.vssps.visualstudio.com/_apis/accounts?memberId={user_id}&api-version=7.1',
        headers=HDR, timeout=20,
    )
    if r_orgs.status_code != 200:
        raise Exception(f'Cuentas HTTP {r_orgs.status_code}')
    return sorted(
        [{'nombre': o['accountName'], 'url': f'https://dev.azure.com/{o["accountName"]}'}
         for o in r_orgs.json().get('value', [])],
        key=lambda x: x['nombre'].lower(),
    )


@app.route('/api/organizaciones')
def get_organizaciones():
    """Consulta Azure DevOps al activarse la app.
    Fallback a AZURE_DEVOPS_ORGS/.env si la API no responde."""
    try:
        orgs = _fetch_orgs_from_azure()
        app_logger.info(f'GET organizaciones (Azure API): {len(orgs)} orgs')
        return jsonify(orgs)
    except Exception as e:
        app_logger.warning(f'Azure API fallo, usando fallback .env: {e}')
        orgs_env = os.getenv('AZURE_DEVOPS_ORGS', '')
        org_base = os.getenv('AZURE_DEVOPS_ORG', '')
        if orgs_env:
            nombres = [o.strip() for o in orgs_env.split(',') if o.strip()]
        elif org_base:
            nombres = [org_base.rstrip('/').split('/')[-1]]
        else:
            nombres = []
        app_logger.info(f'GET organizaciones (fallback .env): {len(nombres)} orgs')
        return jsonify([{'nombre': n, 'url': f'https://dev.azure.com/{n}'} for n in nombres])


# ── Proyectos ────────────────────────────────────────────────
@app.route('/api/proyectos/<org_name>')
def get_proyectos_org(org_name):
    data = az_get(f'https://dev.azure.com/{org_name}/_apis/projects?api-version=7.1&$top=200')
    if not data:
        return jsonify([])
    excluidos = [e.strip().lower() for e in os.getenv('PROYECTOS_EXCLUIDOS', '').split(',') if e.strip()]
    proyectos = [
        {'id': p['id'], 'nombre': p['name'], 'estado': p.get('state', '')}
        for p in data.get('value', [])
        if p['name'].lower() not in excluidos
    ]
    app_logger.info(f'GET proyectos {org_name}: {len(proyectos)}')
    return jsonify(proyectos)


@app.route('/api/proyecto_info/<org_name>/<path:project_name>')
def get_proyecto_info(org_name, project_name):
    org_url = f'https://dev.azure.com/{org_name}'
    try:
        iter_data  = az_get(f'{org_url}/{project_name}/_apis/work/teamsettings/iterations?api-version=7.1')
        iterations = iter_data.get('value', []) if iter_data else []
        fecha_inicio = fecha_fin = '--'
        if iterations:
            starts  = sorted(i['attributes'].get('startDate',  '') for i in iterations if i.get('attributes', {}).get('startDate'))
            finishs = sorted(i['attributes'].get('finishDate', '') for i in iterations if i.get('attributes', {}).get('finishDate'))
            if starts:  fecha_inicio = starts[0][:10]
            if finishs: fecha_fin    = finishs[-1][:10]
        teams_data = az_get(f'{org_url}/_apis/projects/{project_name}/teams?api-version=7.1')
        headcount  = 0; miembros = []
        if teams_data and teams_data.get('value'):
            tid = teams_data['value'][0]['id']
            md  = az_get(f'{org_url}/_apis/projects/{project_name}/teams/{tid}/members?api-version=7.1')
            if md:
                miembros  = [m['identity']['displayName'] for m in md.get('value', [])]
                headcount = len(miembros)
        return jsonify({'total_sprints': len(iterations), 'fecha_inicio': fecha_inicio,
                        'fecha_fin': fecha_fin, 'headcount': headcount, 'miembros': miembros})
    except Exception as e:
        app_logger.error(f'ERROR proyecto_info: {e}', exc_info=True)
        return jsonify({'total_sprints': 0, 'fecha_inicio': '--', 'fecha_fin': '--', 'headcount': 0, 'miembros': []})


@app.route('/api/proyecto/<org_name>/<path:project_name>')
def get_proyecto_detalle(org_name, project_name):
    org_url = f'https://dev.azure.com/{org_name}'
    app_logger.info(f'GET detalle: {org_name}/{project_name}')
    DONE = ('Resolved', 'Closed', 'Done', 'Completed', 'Fixed')
    wiql = {'query': (
        f"SELECT [System.Id],[System.State],[System.WorkItemType],"
        f"[Microsoft.VSTS.Scheduling.StoryPoints],"
        f"[Microsoft.VSTS.Scheduling.CompletedWork],"
        f"[Microsoft.VSTS.Scheduling.RemainingWork] "
        f"FROM WorkItems WHERE [System.TeamProject]='{project_name}'"
    )}
    wiql_data = az_post(f'{org_url}/{project_name}/_apis/wit/wiql?api-version=7.1', wiql)
    items = []
    if wiql_data:
        ids = [i['id'] for i in wiql_data.get('workItems', [])][:200]
        if ids:
            fields = ('System.Id,System.State,System.WorkItemType,'
                      'Microsoft.VSTS.Scheduling.StoryPoints,'
                      'Microsoft.VSTS.Scheduling.CompletedWork,'
                      'Microsoft.VSTS.Scheduling.RemainingWork')
            data = az_get(f'{org_url}/{project_name}/_apis/wit/workitems'
                          f'?ids={",".join(map(str, ids))}&fields={fields}&api-version=7.1')
            if data: items = data.get('value', [])
    epic_data = az_post(f'{org_url}/{project_name}/_apis/wit/wiql?api-version=7.1',
                        {'query': f"SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject]='{project_name}' AND [System.WorkItemType]='Epic'"})
    us_data   = az_post(f'{org_url}/{project_name}/_apis/wit/wiql?api-version=7.1',
                        {'query': f"SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject]='{project_name}' AND [System.WorkItemType]='User Story'"})
    iter_data  = az_get(f'{org_url}/{project_name}/_apis/work/teamsettings/iterations?api-version=7.1')
    iterations = iter_data.get('value', []) if iter_data else []
    estados, tipos = {}, {}
    sp_total = sp_done = horas_comp = horas_rest = items_done = 0
    for it in items:
        f    = it.get('fields', {})
        est  = f.get('System.State', 'Unknown')
        tip  = f.get('System.WorkItemType', 'Unknown')
        sp   = f.get('Microsoft.VSTS.Scheduling.StoryPoints')  or 0
        comp = f.get('Microsoft.VSTS.Scheduling.CompletedWork') or 0
        rest = f.get('Microsoft.VSTS.Scheduling.RemainingWork') or 0
        estados[est] = estados.get(est, 0) + 1
        tipos[tip]   = tipos.get(tip,   0) + 1
        sp_total += sp; horas_comp += comp; horas_rest += rest
        if est in DONE: sp_done += sp; items_done += 1
    avance = round(items_done / len(items) * 100, 1) if items else 0
    hoy    = datetime.date.today()
    desvios = []
    for it in iterations:
        attr = it.get('attributes', {}); fin = attr.get('finishDate', ''); tf = attr.get('timeFrame', 'unknown')
        desvio = 0
        if tf == 'current' and fin:
            try:
                fin_dt = datetime.date.fromisoformat(fin[:10])
                if hoy > fin_dt: desvio = (hoy - fin_dt).days
            except Exception: pass
        desvios.append({'nombre': it.get('name', ''), 'inicio': attr.get('startDate', '')[:10] if attr.get('startDate') else '--',
                        'fin_planeado': fin[:10] if fin else '--', 'estado': tf, 'desvio_dias': desvio,
                        'alerta': 'RIESGO' if desvio > 7 else ('DESVIO' if desvio > 0 else 'OK')})
    sprints_con_desvio = sum(1 for d in desvios if d['desvio_dias'] > 0)
    return jsonify({'proyecto': project_name, 'organizacion': org_name,
                    'metricas': {'total': len(items), 'epicas': len(epic_data.get('workItems', [])) if epic_data else 0,
                                 'user_stories': len(us_data.get('workItems', [])) if us_data else 0,
                                 'estados': estados, 'tipos': tipos,
                                 'sp_total': round(sp_total, 1), 'sp_done': round(sp_done, 1),
                                 'avance_pct': avance, 'items_done': items_done,
                                 'horas_comp': round(horas_comp, 1), 'horas_rest': round(horas_rest, 1)},
                    'desvios': desvios, 'sprints_con_desvio': sprints_con_desvio})


@app.route('/api/testplans/<org_name>/<path:project_name>')
def get_testplans(org_name, project_name):
    org_url = f'https://dev.azure.com/{org_name}'
    try:
        plans_data = az_get(f'{org_url}/{project_name}/_apis/testplan/plans?api-version=7.1')
        if not plans_data: return jsonify([])
        result = []
        for plan in plans_data.get('value', []):
            pid         = plan['id']
            suites_data = az_get(f'{org_url}/{project_name}/_apis/testplan/Plans/{pid}/suites?api-version=7.1')
            suites      = [{'id': s['id'], 'nombre': s['name'], 'casos': s.get('testCaseCount', 0)}
                           for s in (suites_data.get('value', []) if suites_data else [])]
            runs_data   = az_get(f'{org_url}/{project_name}/_apis/test/runs?planId={pid}&api-version=7.1')
            runs        = [{'id': r['id'], 'nombre': r['name'], 'estado': r.get('state', ''),
                            'total': r.get('totalTests', 0), 'pasados': r.get('passedTests', 0),
                            'fallidos': r.get('failedTests', 0)}
                           for r in (runs_data.get('value', [])[:10] if runs_data else [])]
            result.append({'id': pid, 'nombre': plan['name'], 'estado': plan.get('state', ''),
                           'suites': suites, 'runs': runs,
                           'resumen': {'total_suites': len(suites),
                                       'total_casos': sum(s['casos'] for s in suites if s['casos']),
                                       'total_runs': len(runs),
                                       'total_ejecutados': sum(r['total']    for r in runs),
                                       'pasados':          sum(r['pasados']  for r in runs),
                                       'fallidos':         sum(r['fallidos'] for r in runs)}})
        return jsonify(result)
    except Exception as e:
        app_logger.error(f'ERROR testplans: {e}', exc_info=True); return jsonify([])


@app.route('/api/sprints')
def get_sprints():
    """Sprint actual + anterior + futuros con work items y test plan progress.
    Recibe org y project como query params para evitar problemas de routing
    con caracteres no-ASCII en path segments (tildes, ñ, etc.)."""
    org_name     = request.args.get('org',     '').strip()
    project_name = request.args.get('project', '').strip()
    if not org_name or not project_name:
        return jsonify({'error': 'Parámetros org y project son requeridos'}), 400
    try:
        ref       = urlquote(project_name, safe='')
        iter_data = az_get(
            f'https://dev.azure.com/{org_name}/{ref}/_apis/work/teamsettings/iterations?api-version=7.1'
        )
        if not iter_data:
            return jsonify({'error': 'No se pudieron obtener las iteraciones'}), 404

        iterations = iter_data.get('value', [])

        def fmt(d: str) -> str:
            return d[:10] if d else '--'

        def attr(sprint):
            return sprint.get('attributes', {})

        current  = next((i for i in iterations if attr(i).get('timeFrame') == 'current'), None)
        futuros  = [i for i in iterations if attr(i).get('timeFrame') == 'future']
        pasados  = [
            i for i in iterations
            if attr(i).get('timeFrame') == 'past' and attr(i).get('finishDate')
        ]
        # Sprint anterior: el past con finishDate más reciente
        anterior = (
            sorted(pasados, key=lambda x: attr(x)['finishDate'], reverse=True)[0]
            if pasados else None
        )

        def build_sprint(sprint: dict) -> dict:
            a = attr(sprint)
            return {
                'nombre':    sprint['name'],
                'path':      sprint['path'],
                'inicio':    fmt(a.get('startDate',  '')),
                'fin':       fmt(a.get('finishDate', '')),
                'workitems': get_resumen_sprint(org_name, project_name, sprint['path']),
                'testplan':  get_testplan_progress(
                    org_name, project_name, sprint['name'], sprint['path']
                ),
            }

        result = {
            'current':  build_sprint(current)  if current  else None,
            'anterior': build_sprint(anterior) if anterior else None,
            'futuros':  [
                {
                    'nombre': s['name'],
                    'inicio': fmt(attr(s).get('startDate',  '')),
                    'fin':    fmt(attr(s).get('finishDate', '')),
                }
                for s in futuros
            ],
        }
        app_logger.info(
            f'GET sprints {org_name}/{project_name}: '
            f'current={current["name"] if current else "none"}, '
            f'futuros={len(futuros)}'
        )
        return jsonify(result)
    except Exception as e:
        app_logger.error(f'ERROR sprints: {e}', exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/historial')
def historial():
    try:
        files = [{'nombre': f,
                  'fecha': datetime.datetime.fromtimestamp(os.path.getmtime(os.path.join(OUTPUT_DIR, f))).strftime('%d/%m/%Y %H:%M'),
                  'size': f'{round(os.path.getsize(os.path.join(OUTPUT_DIR, f)) / 1024, 1)} KB'}
                 for f in os.listdir(OUTPUT_DIR) if f.endswith('.pdf')]
        return jsonify(sorted(files, key=lambda x: x['fecha'], reverse=True)[:20])
    except Exception: return jsonify([])


@app.route('/api/logs')
def get_logs():
    try:
        logs = [{'nombre': f,
                 'fecha': datetime.datetime.fromtimestamp(os.path.getmtime(os.path.join(LOG_DIR, f))).strftime('%d/%m/%Y %H:%M:%S'),
                 'size': f'{round(os.path.getsize(os.path.join(LOG_DIR, f)) / 1024, 1)} KB'}
                for f in os.listdir(LOG_DIR) if f.startswith('Trace_') and f.endswith('.log')]
        return jsonify(sorted(logs, key=lambda x: x['nombre'], reverse=True)[:30])
    except Exception: return jsonify([])


@app.route('/api/logs/<nombre>')
def ver_log(nombre):
    ruta = os.path.join(LOG_DIR, nombre)
    if not os.path.exists(ruta) or not nombre.startswith('Trace_'):
        return jsonify({'error': 'No encontrado'}), 404
    try:
        with open(ruta, 'r', encoding='utf-8') as f:
            return jsonify({'nombre': nombre, 'contenido': f.read()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/descargar/<nombre>')
def descargar(nombre):
    ruta = os.path.join(OUTPUT_DIR, nombre)
    if not os.path.exists(ruta):
        return jsonify({'error': 'No encontrado'}), 404
    return send_file(ruta, as_attachment=True, download_name=nombre)


@app.route('/api/datos')
def datos():
    p = os.path.join(BASE_DIR, 'datos_procesados.json')
    if not os.path.exists(p): return jsonify(None)
    try:
        with open(p, 'r', encoding='utf-8') as f: return jsonify(json.load(f))
    except Exception: return jsonify(None)


@app.route('/api/salir', methods=['POST'])
def salir():
    def shutdown():
        import time; time.sleep(0.8)
        app_logger.info('Cerrando servidor...')
        os._exit(0)
    threading.Thread(target=shutdown, daemon=True).start()
    return jsonify({'ok': True, 'mensaje': 'Servidor detenido'})


# ── Mapeo fijo de clientes (Consulta Full) ─────────────────────
# Refleja exactamente el $mapeo del script PowerShell de referencia.
# Para agregar/quitar un cliente: editar esta lista.
MAPEO_FULL = [
    {
        'org': 'CLARO-CFO', 'id': None,
        'proyectoRef': 'CML', 'proyectoWiql': 'CML',
        'cliente': 'Claro - CML',
    },
    {
        'org': 'CLARO-CFO-2', 'id': 'b7f57d38-b782-4854-9f55-8fac935f1d95',
        'proyectoRef': 'b7f57d38-b782-4854-9f55-8fac935f1d95',
        'proyectoWiql': 'CLARO - Reingenieria de Ventas',
        'cliente': 'Claro - Ventas',
    },
    {
        'org': 'Supervielle-CFO', 'id': None,
        'proyectoRef': 'portalventas', 'proyectoWiql': 'portalventas',
        'cliente': 'Supervielle',
    },
    {
        'org': 'Infobae-CFO', 'id': None,
        'proyectoRef': 'Plataform de integracion para clientes y facturacion',
        'proyectoWiql': 'Plataform de integracion para clientes y facturacion',
        'cliente': 'Infobae',
    },
    {
        'org': 'COOPERATIVAUNION-CFO', 'id': None,
        'proyectoRef': 'Cooperativa-Union', 'proyectoWiql': 'Cooperativa-Union',
        'cliente': 'Cooperativa Union - Billetera',
    },
    {
        'org': 'COOPERATIVAUNION-CFO', 'id': None,
        'proyectoRef': 'Cooperativa-Union-POCs', 'proyectoWiql': 'Cooperativa-Union-POCs',
        'cliente': 'Cooperativa Union - Mantenimiento',
    },
    {
        'org': 'PNET-CFO', 'id': None,
        'proyectoRef': 'Integraciones Visma Human', 'proyectoWiql': 'Integraciones Visma Human',
        'cliente': 'PNET',
    },
    {
        'org': 'IRSA-CFO', 'id': 'fb02bc1c-042a-455e-aacd-1ce2ffee3298',
        'proyectoRef': 'fb02bc1c-042a-455e-aacd-1ce2ffee3298',
        'proyectoWiql': 'Migracion SUF a SICOT',
        'cliente': 'IRSA - SICOT',
    },
    {
        'org': 'IRSA-CFO', 'id': 'ad726ef4-a9b1-4af2-aeba-0e521cf02188',
        'proyectoRef': 'ad726ef4-a9b1-4af2-aeba-0e521cf02188',
        'proyectoWiql': 'Parking -Mantenimiento',
        'cliente': 'IRSA - Parky',
    },
]

# ── Helpers para rediseño: filtrado por año ─────────────────────

def _project_first_sprint_in_year(org: str, project: str, year: int) -> bool:
    """True si el primer sprint del proyecto (cronológico) tiene startDate en `year`."""
    try:
        ref  = urlquote(project, safe='')
        data = az_get(
            f'https://dev.azure.com/{org}/{ref}'
            f'/_apis/work/teamsettings/iterations?api-version=7.1'
        )
        if not data:
            return False
        iters = [i for i in data.get('value', [])
                 if i.get('attributes', {}).get('startDate')]
        if not iters:
            return False
        iters.sort(key=lambda x: x['attributes']['startDate'])
        return iters[0]['attributes']['startDate'][:4] == str(year)
    except Exception:
        return False


def get_sprint_items(org: str, project_ref: str, iter_path: str) -> list:
    """Tasks y Bugs de una iteración con campos completos
    (id, title, state, type, assignedTo). Batch de 200 IDs."""
    query = (
        f"SELECT [System.Id] FROM WorkItems "
        f"WHERE [System.IterationPath] UNDER '{iter_path}' "
        f"AND [System.WorkItemType] IN ('Task', 'Bug')"
    )
    wiql = _wiql_post(org, project_ref, query)
    if not wiql:
        return []
    ids = [i['id'] for i in wiql.get('workItems', [])]
    if not ids:
        return []

    ref    = urlquote(project_ref, safe='')
    fields = 'System.Id,System.Title,System.State,System.WorkItemType,System.AssignedTo'
    items: list = []
    for i in range(0, len(ids), 200):
        chunk = ','.join(map(str, ids[i:i + 200]))
        batch = az_get(
            f'https://dev.azure.com/{org}/{ref}/_apis/wit/workitems'
            f'?ids={chunk}&fields={fields}&api-version=7.1'
        )
        if batch:
            items.extend(batch.get('value', []))

    result = []
    for item in items:
        f  = item.get('fields', {})
        at = f.get('System.AssignedTo')
        result.append({
            'id':         f.get('System.Id', item['id']),
            'title':      f.get('System.Title', ''),
            'state':      f.get('System.State', ''),
            'type':       f.get('System.WorkItemType', ''),
            'assignedTo': at.get('displayName', '') if isinstance(at, dict) else (at or ''),
        })
    return result


# ── Nuevos endpoints: filtros por año ───────────────────────────

@app.route('/api/orgs-for-year/<int:year>')
def get_orgs_for_year(year: int):
    """Orgs que tienen al menos un proyecto cuyo PRIMER sprint (cronológico)
    tiene startDate dentro del año indicado. Chequea orgs en paralelo."""
    try:
        all_orgs = _fetch_orgs_from_azure()
    except Exception as e:
        app_logger.warning(f'orgs-for-year: Azure API falló, usando fallback .env: {e}')
        orgs_env = os.getenv('AZURE_DEVOPS_ORGS', '')
        org_base = os.getenv('AZURE_DEVOPS_ORG', '')
        nombres  = [o.strip() for o in orgs_env.split(',') if o.strip()]
        if not nombres and org_base:
            nombres = [org_base.rstrip('/').split('/')[-1]]
        all_orgs = [{'nombre': n, 'url': f'https://dev.azure.com/{n}'} for n in nombres]

    def check_org(org_info):
        org_name = org_info['nombre']
        try:
            data = az_get(
                f'https://dev.azure.com/{org_name}/_apis/projects?api-version=7.1&$top=200'
            )
            if not data:
                return None
            for proj in data.get('value', []):
                if _project_first_sprint_in_year(org_name, proj['name'], year):
                    return org_info
        except Exception:
            pass
        return None

    matching: list = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(check_org, o): o for o in all_orgs}
        for fut in as_completed(futures):
            result = fut.result()
            if result:
                matching.append(result)

    matching.sort(key=lambda x: x['nombre'].lower())
    app_logger.info(f'GET orgs-for-year/{year}: {len(matching)} matching')
    return jsonify(matching)


@app.route('/api/projects-for-year/<org_name>/<int:year>')
def get_projects_for_year(org_name: str, year: int):
    """Proyectos de una org cuyo primer sprint tiene startDate en el año dado.
    Chequea proyectos en paralelo."""
    data = az_get(
        f'https://dev.azure.com/{org_name}/_apis/projects?api-version=7.1&$top=200'
    )
    if not data:
        return jsonify([])
    excluidos = [e.strip().lower()
                 for e in os.getenv('PROYECTOS_EXCLUIDOS', '').split(',') if e.strip()]
    projects  = [p for p in data.get('value', [])
                 if p['name'].lower() not in excluidos]

    def check_project(proj):
        if _project_first_sprint_in_year(org_name, proj['name'], year):
            return {'nombre': proj['name'], 'id': proj['id']}
        return None

    result: list = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(check_project, p) for p in projects]
        for fut in as_completed(futures):
            r = fut.result()
            if r:
                result.append(r)

    result.sort(key=lambda x: x['nombre'].lower())
    app_logger.info(f'GET projects-for-year/{org_name}/{year}: {len(result)} matching')
    return jsonify(result)


@app.route('/api/sprint-report')
def get_sprint_report():
    """Reporte completo: sprint actual + anterior.
    Devuelve items (Task/Bug) con detalles completos + test plan progress.
    Consulta los dos sprints en paralelo para reducir latencia."""
    org     = request.args.get('org',     '').strip()
    project = request.args.get('project', '').strip()
    if not org or not project:
        return jsonify({'error': 'Faltan parámetros org y project'}), 400

    try:
        ref       = urlquote(project, safe='')
        iter_data = az_get(
            f'https://dev.azure.com/{org}/{ref}'
            f'/_apis/work/teamsettings/iterations?api-version=7.1'
        )
        if not iter_data:
            return jsonify({'error': 'No se pudieron obtener iteraciones'}), 404

        iterations = iter_data.get('value', [])
        def attr(s): return s.get('attributes', {})

        # Fecha del primer sprint del proyecto (para mostrar en UI)
        with_dates = [i for i in iterations if attr(i).get('startDate')]
        with_dates.sort(key=lambda x: attr(x)['startDate'])
        first_sprint_dt = attr(with_dates[0])['startDate'][:10] if with_dates else None

        current  = next((i for i in iterations if attr(i).get('timeFrame') == 'current'), None)
        pasados  = [i for i in iterations
                    if attr(i).get('timeFrame') == 'past' and attr(i).get('finishDate')]
        anterior = (sorted(pasados, key=lambda x: attr(x)['finishDate'], reverse=True)[0]
                    if pasados else None)

        def build(sprint: dict) -> dict:
            """Construye datos de un sprint: items Task/Bug + test plan progress."""
            a = attr(sprint)
            items    = get_sprint_items(org, project, sprint['path'])
            testplan = get_testplan_progress(org, project, sprint['name'], sprint['path'])
            return {
                'name':       sprint['name'],
                'startDate':  a.get('startDate',  '')[:10] if a.get('startDate')  else None,
                'finishDate': a.get('finishDate', '')[:10] if a.get('finishDate') else None,
                'items':      items,
                'testplan':   testplan,
            }

        # Construir current y anterior en paralelo (cada uno llama Azure DevOps)
        current_data = anterior_data = None
        sprint_tasks: dict = {}
        with ThreadPoolExecutor(max_workers=2) as ex:
            if current:  sprint_tasks['current']  = ex.submit(build, current)
            if anterior: sprint_tasks['anterior'] = ex.submit(build, anterior)
            if 'current'  in sprint_tasks: current_data  = sprint_tasks['current'].result()
            if 'anterior' in sprint_tasks: anterior_data = sprint_tasks['anterior'].result()

        app_logger.info(
            f'GET sprint-report {org}/{project}: '
            f'current={current["name"] if current else "none"}, '
            f'anterior={anterior["name"] if anterior else "none"}'
        )
        return jsonify({
            'firstSprintDate': first_sprint_dt,
            'current':         current_data,
            'anterior':        anterior_data,
        })

    except Exception as e:
        app_logger.error(f'ERROR sprint-report: {e}', exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/full-report')
def get_full_report():
    """Consulta Full: sprint actual + anterior para todos los proyectos de MAPEO_FULL.
    Filtra por año: sólo incluye proyectos cuyo primer sprint tiene startDate >= year.
    Procesa los 9 proyectos en paralelo (max 5 workers) para minimizar latencia."""
    year = request.args.get('year', type=int)
    if not year:
        return jsonify({'error': 'Parámetro year requerido'}), 400

    def process_entry(m: dict) -> dict:
        org     = m['org']
        ref     = m['proyectoRef']
        cliente = m['cliente']
        base    = {'cliente': cliente, 'org': org, 'proyecto': ref,
                   'firstSprintDate': None, 'current': None, 'anterior': None}
        try:
            encoded_ref = urlquote(ref, safe='')
            iter_data = az_get(
                f'https://dev.azure.com/{org}/{encoded_ref}'
                f'/_apis/work/teamsettings/iterations?api-version=7.1'
            )
            if not iter_data:
                return {**base, 'omitido': True,
                        'razonOmision': 'Sin iteraciones (error de conexión)'}

            iterations = iter_data.get('value', [])

            def attr(s): return s.get('attributes', {})

            with_dates = [i for i in iterations if attr(i).get('startDate')]
            if not with_dates:
                return {**base, 'omitido': True,
                        'razonOmision': 'Sin sprints con fecha de inicio'}

            with_dates.sort(key=lambda x: attr(x)['startDate'])
            first      = with_dates[0]
            first_year = int(attr(first)['startDate'][:4])
            first_dt   = attr(first)['startDate'][:10]

            if first_year < year:
                return {**base, 'omitido': True,
                        'firstSprintDate': first_dt,
                        'razonOmision': (
                            f'1° sprint: {first["name"]} ({first_year}) < {year}'
                        )}

            # Proyecto incluido — obtener sprint actual y anterior
            current  = next(
                (i for i in iterations if attr(i).get('timeFrame') == 'current'), None
            )
            pasados  = [
                i for i in iterations
                if attr(i).get('timeFrame') == 'past' and attr(i).get('finishDate')
            ]
            anterior = (
                sorted(pasados, key=lambda x: attr(x)['finishDate'], reverse=True)[0]
                if pasados else None
            )

            def build(sprint: dict) -> dict:
                a        = attr(sprint)
                items    = get_sprint_items(org, ref, sprint['path'])
                testplan = get_testplan_progress(org, ref, sprint['name'], sprint['path'])
                return {
                    'name':       sprint['name'],
                    'startDate':  a.get('startDate',  '')[:10] if a.get('startDate')  else None,
                    'finishDate': a.get('finishDate', '')[:10] if a.get('finishDate') else None,
                    'items':      items,
                    'testplan':   testplan,
                }

            current_data = anterior_data = None
            tasks: dict = {}
            with ThreadPoolExecutor(max_workers=2) as ex:
                if current:  tasks['current']  = ex.submit(build, current)
                if anterior: tasks['anterior'] = ex.submit(build, anterior)
                if 'current'  in tasks: current_data  = tasks['current'].result()
                if 'anterior' in tasks: anterior_data = tasks['anterior'].result()

            return {
                **base,
                'omitido':         False,
                'razonOmision':    None,
                'firstSprintDate': first_dt,
                'current':         current_data,
                'anterior':        anterior_data,
            }

        except Exception as e:
            app_logger.error(f'full-report error {cliente}: {e}', exc_info=True)
            return {**base, 'omitido': True,
                    'razonOmision': f'Error: {str(e)[:120]}'}

    results: list = []
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(process_entry, m): m for m in MAPEO_FULL}
        for fut in as_completed(futures):
            results.append(fut.result())

    # Restaurar el orden original del MAPEO_FULL
    orden = {m['cliente']: i for i, m in enumerate(MAPEO_FULL)}
    results.sort(key=lambda x: orden.get(x['cliente'], 999))

    app_logger.info(f'GET full-report year={year}: {len(results)} entradas')
    return jsonify(results)


if __name__ == '__main__':
    try: ip = socket.gethostbyname(socket.gethostname())
    except Exception: ip = '127.0.0.1'
    print(f'\n  CFOTech IT Tools — Reporte DevOps (API)')
    print(f'  API  : http://127.0.0.1:5000')
    print(f'  Red  : http://{ip}:5000')
    print(f'  Front: {FRONTEND_URL}\n')
    app.run(host='0.0.0.0', port=5000, debug=False)
