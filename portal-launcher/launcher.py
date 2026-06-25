"""
launcher.py — Portal de Acceso CFOTech
Servicio local que levanta el backend y frontend de cada app
cuando el usuario hace click en "Abrir" desde el portal.

Puerto: 4999  (reservado para el launcher, no colisiona con las apps)
"""

import os
import sys
import time
import threading
import subprocess
from pathlib import Path

import requests
from flask import Flask, jsonify
from flask_cors import CORS

# ── Config desde .env ────────────────────────────────────────────────────────
# Leemos el .env en un dict LOCAL — NO lo volcamos a os.environ para no
# contaminar el entorno heredado por los procesos hijo (node server.js,
# python app.py, dotnet run…).  Si esos procesos heredan PORT=4999,
# su propio .env queda ignorado (dotenv no overridea vars de entorno).
_env_path = Path(__file__).parent / '.env'
_env_cfg: dict[str, str] = {}
if _env_path.exists():
    for _line in _env_path.read_text(encoding='utf-8').splitlines():
        _line = _line.strip()
        if _line and not _line.startswith('#') and '=' in _line:
            _k, _v = _line.split('=', 1)
            _env_cfg[_k.strip()] = _v.strip()

PORT            = int(_env_cfg.get('PORT', os.environ.get('PORT', 4999)))
ALLOWED_ORIGINS = _env_cfg.get('ALLOWED_ORIGINS', os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5174')).split(',')
APP_HOST        = _env_cfg.get('APP_HOST',  os.environ.get('APP_HOST',  'localhost'))
PORTAL_PORT     = int(_env_cfg.get('PORTAL_PORT', os.environ.get('PORTAL_PORT', 5174)))
AUTOSTART_APPS  = _env_cfg.get('AUTOSTART_APPS', os.environ.get('AUTOSTART_APPS', 'false')).strip().lower() == 'true'

# ── Setup ────────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app, origins=ALLOWED_ORIGINS)

# Directorio raíz del portal (un nivel arriba de este archivo)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Directorio padre de "Portal de Acceso" (contiene todas las apps hermanas)
_APPS_ROOT = os.path.dirname(BASE_DIR)   # C:\Esteban CFOTech

# Ruta absoluta al intérprete Python que corre este launcher.
# Usar sys.executable evita colisiones con App Execution Aliases de Windows Store
# que interceptan "python" en procesos sin consola.
# Si el launcher corre con pythonw.exe, lo normalizamos a python.exe.
_PY = sys.executable
if _PY.lower().endswith('pythonw.exe'):
    _PY = _PY[:-len('pythonw.exe')] + 'python.exe'
_PY_CMD = f'"{_PY}"'   # entre comillas para manejar espacios en la ruta

# ── Configuración de apps ────────────────────────────────────────────────────

APP_CONFIGS: dict[str, dict] = {
    'reporte-devops': {
        'backend': {
            'dir':     'REPORTE_DEV_OPS\\backend',
            'cmd':     'python app.py',
            'health':  'http://localhost:5000/api/health',
            'timeout': 20,
            'label':   'Backend Flask',
        },
        'frontend': {
            'dir':     'REPORTE_DEV_OPS\\frontend',
            'cmd':     'npm run dev',
            'url':     'http://localhost:5001',
            'timeout': 30,
            'label':   'Frontend React',
        },
    },
    'bandas-salariales': {
        'backend': {
            'dir':     'BANDAS_SALARIALES\\BandasSalariales.Web',
            'cmd':     'dotnet run',
            'health':  'http://localhost:5050/api/health',
            'timeout': 40,   # dotnet build inicial es más lento
            'label':   'Backend ASP.NET',
        },
        'frontend': {
            'dir':     'BANDAS_SALARIALES\\bandas-frontend',
            'cmd':     'npm run dev',
            'url':     'http://localhost:5173',
            'timeout': 30,
            'label':   'Frontend React',
        },
    },
    'job-matcher': {
        # FASE 3: backend API puro (:5002) + frontend React Vite (:5003)
        'backend': {
            'dir':     'JOB_MATCHER\\backend',
            'cmd':     'node server.js',
            'health':  'http://localhost:5002/api/health',
            'timeout': 15,
            'label':   'API Node.js',
        },
        'frontend': {
            'dir':     'JOB_MATCHER\\frontend',
            'cmd':     'npm run dev',
            'url':     'http://localhost:5003',
            'timeout': 40,
            'label':   'Frontend React',
        },
    },
    'survey': {
        # FASE 6: backend ASP.NET Core (:5055) + frontend React Vite (:5176)
        'backend': {
            'dir':     'SURVEY\\SurveyApp.Web',
            'cmd':     'dotnet run',
            'health':  'http://localhost:5055/api/health',
            'timeout': 45,   # dotnet build inicial puede tardar
            'label':   'Backend ASP.NET',
        },
        'frontend': {
            'dir':     'SURVEY\\survey-frontend',
            'cmd':     'npm run dev',
            'url':     'http://localhost:5176',
            'timeout': 35,
            'label':   'Frontend React',
        },
    },
    'sound-catch': {
        # FastAPI :5008 (backend Whisper) + React Vite :5009 (frontend)
        # WS_A_TEXTO está dentro del repo del portal (BASE_DIR / 'WS_A_TEXTO').
        # En portal_server.py el backend se monta inline — este config es solo para
        # el launcher legacy (:4999) que raramente se usa.
        'backend': {
            'dir':     os.path.join(BASE_DIR, 'WS_A_TEXTO', 'web', 'backend'),
            'cmd':     f'{_PY_CMD} app.py',
            'health':  'http://localhost:5008/api/health',
            'timeout': 30,
            'label':   'Backend FastAPI',
        },
        'frontend': {
            'dir':     os.path.join(BASE_DIR, 'WS_A_TEXTO', 'web', 'frontend'),
            'cmd':     'npm run dev',
            'url':     'http://localhost:5009',
            'timeout': 40,
            'label':   'Frontend React',
        },
    },
}

# Estado de lanzamiento y procesos en memoria
_status: dict[str, dict]  = {}   # { appId: { backend, frontend, done, error } }
_procs:  dict[str, dict]  = {}   # { appId: { backend: Popen, frontend: Popen } }

# ── Helpers ──────────────────────────────────────────────────────────────────

def _ping(url: str, timeout: float = 2.0) -> bool:
    """True si la URL responde con código < 500."""
    try:
        return requests.get(url, timeout=timeout).status_code < 500
    except Exception:
        return False


def _kill_port(port: int) -> None:
    """Windows: termina cualquier proceso que esté escuchando en `port`."""
    if sys.platform != 'win32':
        return
    try:
        result = subprocess.run(
            f'netstat -ano | findstr :{port} | findstr LISTENING',
            shell=True, capture_output=True, text=True,
        )
        for line in result.stdout.strip().splitlines():
            parts = line.split()
            if parts:
                subprocess.run(
                    f'taskkill /PID {parts[-1]} /F',
                    shell=True, capture_output=True,
                )
    except Exception:
        pass


def _start_proc(cmd: str, cwd: str) -> subprocess.Popen:
    """Lanza un proceso sin ventana de consola (silencioso para el usuario)."""
    kwargs: dict = dict(cwd=cwd, shell=True,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL)
    if sys.platform == 'win32':
        # CREATE_NO_WINDOW: sin ventana DOS visible; proceso corre en segundo plano
        CREATE_NO_WINDOW = 0x08000000
        kwargs['creationflags'] = CREATE_NO_WINDOW
    return subprocess.Popen(cmd, **kwargs)


# ── Hilo de lanzamiento ──────────────────────────────────────────────────────

def _launch_worker(app_id: str) -> None:
    cfg    = APP_CONFIGS[app_id]
    status = _status[app_id]

    # ── 1. Backend ───────────────────────────────────────────
    status['backend'] = 'launching'

    if not _ping(cfg['backend']['health'], timeout=1):
        backend_dir = os.path.normpath(os.path.join(BASE_DIR, cfg['backend']['dir']))
        proc = _start_proc(cfg['backend']['cmd'], backend_dir)
        _procs.setdefault(app_id, {})['backend'] = proc

    deadline = time.time() + cfg['backend']['timeout']
    while time.time() < deadline:
        if _ping(cfg['backend']['health'], timeout=1):
            status['backend'] = 'ready'
            break
        time.sleep(0.8)
    else:
        status['backend'] = 'error'
        status['error']   = f"Backend no respondió en {cfg['backend']['timeout']}s"
        return

    # ── 2. Frontend ──────────────────────────────────────────
    status['frontend'] = 'launching'

    if not _ping(cfg['frontend']['url'], timeout=1):
        # cmd vacío = monolito (el backend ya sirve el frontend, no hay proceso extra)
        if cfg['frontend'].get('cmd'):
            frontend_dir = os.path.normpath(os.path.join(BASE_DIR, cfg['frontend']['dir']))
            proc = _start_proc(cfg['frontend']['cmd'], frontend_dir)
            _procs.setdefault(app_id, {})['frontend'] = proc

    deadline = time.time() + cfg['frontend']['timeout']
    while time.time() < deadline:
        if _ping(cfg['frontend']['url'], timeout=1):
            status['frontend'] = 'ready'
            break
        time.sleep(0.8)
    else:
        status['frontend'] = 'error'
        status['error']    = f"Frontend no respondió en {cfg['frontend']['timeout']}s"
        return

    status['done'] = True


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post('/api/launch/<app_id>')
def launch(app_id: str):
    if app_id not in APP_CONFIGS:
        return jsonify({'ok': False, 'error': 'App no registrada'}), 404

    cfg      = APP_CONFIGS[app_id]
    existing = _status.get(app_id, {})

    # Si el lanzamiento está en curso, no reiniciar
    if existing.get('backend') == 'launching':
        return jsonify({'ok': True, 'already': True})

    # Si el estado dice "listo", verificar que los procesos sigan vivos.
    # Escenario stale: el usuario cerró el portal sin hacer click en "Salir",
    # los procesos murieron pero el launcher aún tiene done=True en memoria.
    # En ese caso, limpiamos el estado y re-lanzamos.
    if existing.get('done'):
        still_up = (
            _ping(cfg['backend']['health'], timeout=0.5) and
            _ping(cfg['frontend']['url'],   timeout=0.5)
        )
        if still_up:
            return jsonify({'ok': True, 'already': True})
        # Procesos muertos — limpiar y re-lanzar
        _status.pop(app_id, None)
        _procs.pop(app_id,  None)

    _status[app_id] = {
        'backend':  'pending',
        'frontend': 'pending',
        'done':     False,
        'error':    None,
    }

    threading.Thread(target=_launch_worker, args=(app_id,), daemon=True).start()
    return jsonify({'ok': True})


@app.get('/api/status/<app_id>')
def status_app(app_id: str):
    if app_id not in APP_CONFIGS:
        return jsonify({'ok': False, 'error': 'App no registrada'}), 404

    s = _status.get(app_id, {})
    cfg = APP_CONFIGS[app_id]
    return jsonify({
        'backend':        s.get('backend',  'idle'),
        'frontend':       s.get('frontend', 'idle'),
        'done':           s.get('done',     False),
        'error':          s.get('error'),
        'backendLabel':   cfg['backend']['label'],
        'frontendLabel':  cfg['frontend']['label'],
    })


def _stop_app_internal(app_id: str) -> None:
    """Lógica de parada de una app — termina procesos, mata puertos, limpia estado."""
    cfg = APP_CONFIGS.get(app_id)
    if not cfg:
        return

    # Terminar procesos Popen rastreados
    procs = _procs.pop(app_id, {})
    for proc in procs.values():
        try:
            proc.terminate()
        except Exception:
            pass

    # Fallback: matar por puerto
    backend_port  = int(cfg['backend']['health'].split(':')[-1].split('/')[0])
    frontend_port = int(cfg['frontend']['url'].rstrip('/').split(':')[-1])
    _kill_port(backend_port)
    _kill_port(frontend_port)

    # Limpiar estado
    _status.pop(app_id, None)


@app.post('/api/stop/<app_id>')
def stop_app(app_id: str):
    """Detiene backend y frontend de una app y limpia su estado."""
    if app_id not in APP_CONFIGS:
        return jsonify({'ok': False, 'error': 'App no registrada'}), 404
    _stop_app_internal(app_id)
    return jsonify({'ok': True, 'stopped': app_id})


@app.post('/api/stop-all')
def stop_all():
    """Detiene todas las apps con estado conocido (llamado al cerrar el portal)."""
    stopped = []
    # Iterar sobre una copia para poder mutar _status/_procs durante la iteración
    for app_id in list(_status.keys()):
        _stop_app_internal(app_id)
        stopped.append(app_id)
    return jsonify({'ok': True, 'stopped': stopped})


@app.get('/api/health')
def health():
    return jsonify({'ok': True, 'service': 'portal-launcher', 'port': PORT})


# ── Auto-start ───────────────────────────────────────────────────────────────

def _autostart_all() -> None:
    """Lanza todas las apps en background cuando AUTOSTART_APPS=true.
    Se ejecuta en un hilo separado para no bloquear el arranque de Flask."""
    time.sleep(2)   # esperar que Flask esté completamente levantado
    for app_id in APP_CONFIGS:
        if app_id in _status:
            continue   # ya lanzada (no debería ocurrir al boot)
        _status[app_id] = {
            'backend':  'pending',
            'frontend': 'pending',
            'done':     False,
            'error':    None,
        }
        threading.Thread(target=_launch_worker, args=(app_id,), daemon=True).start()


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print(f' * Portal Launcher CFOTech — puerto {PORT}')
    print(f' * BASE_DIR: {BASE_DIR}')
    print(f' * CORS origins: {ALLOWED_ORIGINS}')
    print(f' * APP_HOST: {APP_HOST}  |  PORTAL_PORT: {PORTAL_PORT}')
    print(f' * AUTOSTART_APPS: {AUTOSTART_APPS}')
    if AUTOSTART_APPS:
        print(' * Auto-start activado — las apps arrancarán en background…')
        threading.Thread(target=_autostart_all, daemon=True).start()
    # Escucha en todas las interfaces para ser accesible desde la red.
    # En local, 0.0.0.0 incluye 127.0.0.1 — sin cambio para el browser local.
    app.run(host='0.0.0.0', port=PORT, debug=False)
