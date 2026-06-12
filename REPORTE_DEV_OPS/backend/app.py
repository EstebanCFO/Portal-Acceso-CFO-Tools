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
from base64 import b64encode
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
    app_logger.debug(f'REQUEST:  {request.method} {request.path} from {request.remote_addr}')


@app.after_request
def log_res(response):
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
@app.route('/api/organizaciones')
def get_organizaciones():
    orgs_env = os.getenv('AZURE_DEVOPS_ORGS', '')
    org_base = os.getenv('AZURE_DEVOPS_ORG', '')
    if orgs_env:
        nombres = [o.strip() for o in orgs_env.split(',') if o.strip()]
    elif org_base:
        nombres = [org_base.rstrip('/').split('/')[-1]]
    else:
        nombres = []
    app_logger.info(f'GET organizaciones (env): {len(nombres)} orgs')
    return jsonify([{'nombre': n, 'url': f'https://dev.azure.com/{n}'} for n in nombres])


@app.route('/api/organizaciones/refresh')
def refresh_organizaciones():
    try:
        r_perfil = requests.get(
            'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1',
            headers=HDR, timeout=20,
        )
        if r_perfil.status_code != 200:
            raise Exception(f'Perfil HTTP {r_perfil.status_code}')
        user_id = r_perfil.json().get('id')
        if not user_id:
            raise Exception('Sin user_id')
        r_orgs = requests.get(
            f'https://app.vssps.visualstudio.com/_apis/accounts?memberId={user_id}&api-version=7.1',
            headers=HDR, timeout=20,
        )
        if r_orgs.status_code != 200:
            raise Exception(f'Cuentas HTTP {r_orgs.status_code}')
        orgs = sorted(
            [{'nombre': o['accountName'], 'url': f'https://dev.azure.com/{o["accountName"]}'}
             for o in r_orgs.json().get('value', [])],
            key=lambda x: x['nombre'].lower(),
        )
        app_logger.info(f'Refresh organizaciones: {len(orgs)} encontradas')
        return jsonify({'ok': True, 'orgs': orgs, 'total': len(orgs)})
    except Exception as e:
        app_logger.warning(f'Refresh falló: {e}')
        return jsonify({'ok': False, 'error': str(e), 'orgs': [], 'total': 0})


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


if __name__ == '__main__':
    try: ip = socket.gethostbyname(socket.gethostname())
    except Exception: ip = '127.0.0.1'
    print(f'\n  CFOTech IT Tools — Reporte DevOps (API)')
    print(f'  API  : http://127.0.0.1:5000')
    print(f'  Red  : http://{ip}:5000')
    print(f'  Front: {FRONTEND_URL}\n')
    app.run(host='0.0.0.0', port=5000, debug=False)
