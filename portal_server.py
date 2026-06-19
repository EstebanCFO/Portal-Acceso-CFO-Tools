"""
portal_server.py — Portal Unificado CFOTech
════════════════════════════════════════════
Un solo proceso. Un solo puerto: http://localhost:5174

Al arrancar:
  • Inicia TODOS los backends en paralelo (Reporte DevOps, Job Matcher,
    Bandas Salariales, Survey) — sin esperar a que el usuario abra una app.
  • Sound Catch: router FastAPI montado inline (sin subprocess, sin puerto extra).
  • Inicia los frontends Vite de cada app (si no tienen dist/ ya construido).
  • Sirve el portal React desde dist/ (o proxea al Vite de dev en :5175).
  • Sirve Sound Catch frontend desde dist/ en /apps/sound-catch/.

Reemplaza: portal-launcher/launcher.py (:4999) y la necesidad de Vite corriendo
en :5174 como punto de entrada. El viejo launcher.py queda como fallback.

─── Modo dev (cuando se está desarrollando el portal o una app) ───────────────
  Portal:     npm run dev  en Portal de Acceso/ (Vite escucha en :5175)
              El gateway en :5174 lo proxea automáticamente.
  Sound Catch: npm run dev  en web/frontend/ (Vite en :5009 con base /apps/sound-catch/)
               Y python app.py  en web/backend/ (:5008)
               El gateway proxea /apps/sound-catch/ → :5009

─── Modo prod (uso diario, zero-delay) ────────────────────────────────────────
  1. cd "Portal de Acceso" && npm run build   (una vez o al actualizar el portal)
  2. cd "Sound Catch/web/frontend" && npm run build  (una vez o al actualizar SC)
  3. python portal_server.py                          (el único comando que importa)
"""

import os
import sys
import time
import subprocess
import threading
import atexit
from pathlib import Path
from contextlib import asynccontextmanager

# ── Fix encoding Windows ──────────────────────────────────────────────────────
# Windows usa cp1252 cuando stdout está redirigido (modo launcher: stdout→DEVNULL).
# Caracteres Unicode fuera de cp1252 (✓ ▶ ■ → …) causan UnicodeEncodeError y
# crashean el proceso antes de que uvicorn inicie → el health check nunca responde
# → el browser nunca abre. Forzamos UTF-8 con errors='replace' como safety-net.
for _stream in (sys.stdout, sys.stderr):
    if _stream is not None:
        try:
            _stream.reconfigure(encoding='utf-8', errors='replace')
        except AttributeError:
            pass

import httpx
import uvicorn
from dotenv import dotenv_values
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

# ── Directorios ───────────────────────────────────────────────────────────────
BASE_DIR  = Path(__file__).parent      # …/Portal de Acceso/
APPS_ROOT = BASE_DIR.parent            # …/Esteban CFOTech/

# Leer config del gateway sin contaminar os.environ (apps hijo leen su propio .env)
_gw = dotenv_values(BASE_DIR / '.env')
PORT = int(_gw.get('PORT') or os.environ.get('PORT', 5174))

# Python ejecutable (evitar App Execution Aliases de Windows Store)
_PY = sys.executable
if _PY.lower().endswith('pythonw.exe'):
    _PY = _PY[:-len('pythonw.exe')] + 'python.exe'

# ── Configuración de apps ─────────────────────────────────────────────────────
#
#   backend_inline    = True  → FastAPI router montado aquí (Sound Catch)
#   backend_cmd/dir   → comando e dir para lanzar el subprocess
#   backend_port      → puerto interno donde escucha el backend
#   backend_health    → URL de health check
#   backend_timeout   → segundos máximos esperando el health
#   frontend_cmd/dir  → comando para arrancar el Vite dev (si no hay dist/)
#   frontend_port     → puerto del Vite dev server
#   frontend_dist     → carpeta dist/ del build (preferido sobre Vite dev)
#
APPS: dict[str, dict] = {
    'sound-catch': {
        'backend_inline':    True,
        # Frontend: servido como estático desde dist/
        # Si dist/ no existe, el gateway proxea al Vite dev en :5009
        'frontend_cmd':    'npm run dev',
        'frontend_dir':    APPS_ROOT / 'Sound Catch' / 'web' / 'frontend',
        'frontend_port':   5009,
        'frontend_dist':   APPS_ROOT / 'Sound Catch' / 'web' / 'frontend' / 'dist',
    },
    'reporte-devops': {
        'backend_cmd':     f'"{_PY}" app.py',
        'backend_dir':     BASE_DIR / 'REPORTE_DEV_OPS' / 'backend',
        'backend_port':    5000,
        'backend_health':  'http://localhost:5000/api/health',
        'backend_timeout': 20,
        'frontend_cmd':    'npm run dev',
        'frontend_dir':    BASE_DIR / 'REPORTE_DEV_OPS' / 'frontend',
        'frontend_port':   5001,
        'frontend_dist':   BASE_DIR / 'REPORTE_DEV_OPS' / 'frontend' / 'dist',
    },
    'job-matcher': {
        'backend_cmd':     'node server.js',
        'backend_dir':     BASE_DIR / 'JOB_MATCHER' / 'backend',
        'backend_port':    5002,
        'backend_health':  'http://localhost:5002/api/health',
        'backend_timeout': 15,
        # Job Matcher tiene rutas mixtas: /api/health Y /upload, /analyze, /ask-question...
        # Con prefix='' el gateway envía la ruta tal cual al backend (sin anteponer /api/).
        'backend_path_prefix': '',
        'frontend_cmd':    'npm run dev',
        'frontend_dir':    BASE_DIR / 'JOB_MATCHER' / 'frontend',
        'frontend_port':   5003,
        'frontend_dist':   BASE_DIR / 'JOB_MATCHER' / 'frontend' / 'dist',
    },
    'bandas-salariales': {
        'backend_cmd':     'dotnet run',
        'backend_dir':     BASE_DIR / 'BANDAS_SALARIALES' / 'BandasSalariales.Web',
        'backend_port':    5050,
        'backend_health':  'http://localhost:5050/api/health',
        'backend_timeout': 45,
        'frontend_cmd':    'npm run dev',
        'frontend_dir':    BASE_DIR / 'BANDAS_SALARIALES' / 'bandas-frontend',
        'frontend_port':   5173,
        'frontend_dist':   BASE_DIR / 'BANDAS_SALARIALES' / 'bandas-frontend' / 'dist',
    },
    'survey': {
        'backend_cmd':     'dotnet run',
        'backend_dir':     BASE_DIR / 'SURVEY' / 'SurveyApp.Web',
        'backend_port':    5055,
        'backend_health':  'http://localhost:5055/api/health',
        'backend_timeout': 45,
        'frontend_cmd':    'npm run dev',
        'frontend_dir':    BASE_DIR / 'SURVEY' / 'survey-frontend',
        'frontend_port':   5176,
        'frontend_dist':   BASE_DIR / 'SURVEY' / 'survey-frontend' / 'dist',
    },
}

# ── Subprocess management ─────────────────────────────────────────────────────
_procs:  dict[str, subprocess.Popen] = {}   # subprocesos activos
_status: dict[str, dict]             = {}   # estado de cada app

_CREATE_NO_WINDOW = 0x08000000 if sys.platform == 'win32' else 0


def _spawn(cmd: str, cwd: Path) -> subprocess.Popen:
    """Lanza un proceso sin ventana de consola."""
    kwargs: dict = dict(
        cwd=str(cwd), shell=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if sys.platform == 'win32':
        kwargs['creationflags'] = _CREATE_NO_WINDOW
    return subprocess.Popen(cmd, **kwargs)


def _ping(url: str, timeout: float = 2.0) -> bool:
    try:
        import requests
        return requests.get(url, timeout=timeout).status_code < 500
    except Exception:
        return False


def _start_backend(app_id: str, cfg: dict) -> None:
    """Arranca el backend de una app y espera el health check. Corre en hilo."""
    if cfg.get('backend_inline'):
        _status[app_id] = {**_status.get(app_id, {}), 'backend': 'inline'}
        return

    health = cfg['backend_health']
    port   = cfg['backend_port']

    if _ping(health, timeout=0.5):
        print(f"  [{app_id}] backend ya corriendo en :{port}")
        _status[app_id] = {**_status.get(app_id, {}), 'backend': 'ready'}
        return

    _status[app_id] = {**_status.get(app_id, {}), 'backend': 'launching'}
    proc = _spawn(cfg['backend_cmd'], cfg['backend_dir'])
    _procs[f'{app_id}_backend'] = proc

    deadline = time.time() + cfg.get('backend_timeout', 30)
    while time.time() < deadline:
        if _ping(health, timeout=1):
            _status[app_id] = {**_status.get(app_id, {}), 'backend': 'ready'}
            print(f"  [{app_id}] backend listo :{port}")
            return
        time.sleep(1)

    _status[app_id] = {**_status.get(app_id, {}), 'backend': 'error'}
    print(f"  [{app_id}] WARNING backend no respondió en {cfg.get('backend_timeout', 30)}s")


def _start_frontend(app_id: str, cfg: dict) -> None:
    """Arranca el frontend Vite de una app (solo si no hay dist/ construido)."""
    dist: Path = cfg.get('frontend_dist', Path('.'))
    port = cfg.get('frontend_port')

    if dist.exists():
        # dist/ listo → se sirve estáticamente, no hace falta Vite dev
        _status[app_id] = {**_status.get(app_id, {}), 'frontend': 'static'}
        return

    if not port or not cfg.get('frontend_cmd'):
        return

    # Verificar si ya hay algo en ese puerto
    try:
        import requests
        requests.get(f'http://localhost:{port}', timeout=1)
        _status[app_id] = {**_status.get(app_id, {}), 'frontend': 'ready'}
        return
    except Exception:
        pass

    cmd = cfg['frontend_cmd']
    cwd = cfg['frontend_dir']
    if not cwd.exists():
        return

    proc = _spawn(cmd, cwd)
    _procs[f'{app_id}_frontend'] = proc
    _status[app_id] = {**_status.get(app_id, {}), 'frontend': 'launching'}
    print(f"  [{app_id}] arrancando frontend dev :{port}")


def _boot_all() -> None:
    """Arranca backends y frontends de todas las apps en paralelo al boot."""
    threads: list[threading.Thread] = []

    for app_id, cfg in APPS.items():
        t_back = threading.Thread(
            target=_start_backend, args=(app_id, cfg), daemon=True, name=f'boot-{app_id}-back'
        )
        t_front = threading.Thread(
            target=_start_frontend, args=(app_id, cfg), daemon=True, name=f'boot-{app_id}-front'
        )
        threads.extend([t_back, t_front])
        t_back.start()
        t_front.start()

    for t in threads:
        t.join(timeout=60)


def _stop_app(app_id: str) -> None:
    """Termina los subprocesos de una app."""
    for key in (f'{app_id}_backend', f'{app_id}_frontend'):
        proc = _procs.pop(key, None)
        if proc:
            try:
                proc.terminate()
            except Exception:
                pass
    _status.pop(app_id, None)


def _stop_all() -> None:
    for app_id in list(_status.keys()):
        _stop_app(app_id)


atexit.register(_stop_all)

# ── Sound Catch: router inline ────────────────────────────────────────────────
# Se importa aquí para que FastAPI lo monte directamente —
# sin subprocess, sin puerto separado.
_SC_BACKEND = APPS_ROOT / 'Sound Catch' / 'web' / 'backend'

if str(_SC_BACKEND) not in sys.path:
    sys.path.insert(0, str(_SC_BACKEND))
if str(APPS_ROOT / 'Sound Catch') not in sys.path:
    sys.path.insert(0, str(APPS_ROOT / 'Sound Catch'))

try:
    from router import router as _sc_router        # noqa: E402
    _SC_ROUTER_OK = True
except ImportError as _e:
    _sc_router    = None
    _SC_ROUTER_OK = False
    print(f"  [sound-catch] WARNING: no se pudo cargar router.py → {_e}")

# ── FastAPI app ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def _lifespan(app_: FastAPI):
    print(f"\n▶  Portal Unificado CFOTech — arrancando en http://localhost:{PORT}")
    print("   Iniciando backends y frontends en background…\n")
    threading.Thread(target=_boot_all, daemon=True, name='portal-boot').start()
    yield
    print("\n■  Portal detenido — cerrando subprocesos…")
    _stop_all()


app = FastAPI(lifespan=_lifespan, docs_url=None, redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar Sound Catch inline bajo /api/sound-catch/
if _SC_ROUTER_OK:
    # Prefijo /api/sound-catch/api para que coincida con los fetch del frontend:
    # client.ts llama ${API}/api/health → /api/sound-catch/api/health
    app.include_router(_sc_router, prefix='/api/sound-catch/api')
    print("  [sound-catch] router montado en /api/sound-catch/api/ [OK]")

# ── Endpoints del gateway (compatibles con el launcher antiguo) ───────────────

@app.get('/api/health')
def gateway_health():
    return {'ok': True, 'service': 'portal-unificado', 'port': PORT}


@app.get('/api/status/{app_id}')
def app_status(app_id: str):
    if app_id not in APPS:
        raise HTTPException(404, detail='App no registrada')
    s   = _status.get(app_id, {})
    cfg = APPS[app_id]
    return {
        'backend':       s.get('backend',  'idle'),
        'frontend':      s.get('frontend', 'idle'),
        'done':          s.get('backend') in ('ready', 'inline') and s.get('frontend') in ('ready', 'static', 'launching'),
        'error':         s.get('error'),
        'backendLabel':  'inline' if cfg.get('backend_inline') else f":{cfg.get('backend_port')}",
        'frontendLabel': 'static' if (cfg.get('frontend_dist', Path('.')).exists()) else f":{cfg.get('frontend_port')}",
    }


@app.post('/api/launch/{app_id}')
def launch_app(app_id: str):
    """Compatibilidad con el launcher antiguo.
    En el portal unificado los apps arrancan al boot; este endpoint es no-op
    si la app ya está corriendo, o inicia manualmente si falló al boot.
    """
    if app_id not in APPS:
        raise HTTPException(404, detail='App no registrada')

    s = _status.get(app_id, {})
    # Si ya está OK, responder inmediatamente
    if s.get('backend') in ('ready', 'inline'):
        return {'ok': True, 'already': True}

    # Re-intentar arranque en background
    cfg = APPS[app_id]
    threading.Thread(target=_start_backend,  args=(app_id, cfg), daemon=True).start()
    threading.Thread(target=_start_frontend, args=(app_id, cfg), daemon=True).start()
    return {'ok': True}


@app.post('/api/stop/{app_id}')
def stop_app(app_id: str):
    if app_id not in APPS:
        raise HTTPException(404, detail='App no registrada')
    _stop_app(app_id)
    return {'ok': True, 'stopped': app_id}


@app.post('/api/stop-all')
def stop_all_apps():
    _stop_all()
    return {'ok': True, 'stopped': list(APPS.keys())}


# ── Proxy httpx para backends no-inline ──────────────────────────────────────
# Clientes persistentes por app (reusan conexiones TCP).
_http: dict[str, httpx.AsyncClient] = {}


async def _client(key: str) -> httpx.AsyncClient:
    if key not in _http:
        _http[key] = httpx.AsyncClient(timeout=httpx.Timeout(60.0), follow_redirects=True)
    return _http[key]


@app.api_route(
    '/api/{app_id}/{path:path}',
    methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
)
async def proxy_api(app_id: str, path: str, request: Request):
    """Proxy hacia el backend del app_id (para apps no-inline)."""
    cfg = APPS.get(app_id)
    if not cfg:
        raise HTTPException(404, detail=f"App '{app_id}' no registrada")
    if cfg.get('backend_inline'):
        # El router de Sound Catch captura /api/sound-catch/* antes de llegar aquí.
        # Si llega, es un endpoint no existente.
        raise HTTPException(404, detail='Endpoint no encontrado')

    port   = cfg['backend_port']
    # backend_path_prefix: prefijo que se antepone al path en el backend.
    #   '/api' (default) → gateway envía /api/{path}
    #   ''               → gateway envía /{path} tal cual (Job Matcher: rutas mixtas)
    bp     = cfg.get('backend_path_prefix', '/api')
    target_url = f"http://localhost:{port}{bp}/{path}" if bp else f"http://localhost:{port}/{path}"
    qs = request.url.query
    if qs:
        target_url += f"?{qs}"

    # Filtrar headers que generan conflicto en el proxy.
    # IMPORTANTE: 'accept-encoding' se excluye deliberadamente.
    # Los backends (ASP.NET Core, Node.js/compression) comprimen respuestas cuando
    # el cliente envía Accept-Encoding: br,gzip.  httpx decodifica gzip/deflate pero
    # requiere el paquete 'brotli' para Brotli — si no está instalado, pasa los bytes
    # comprimidos sin decodificar y al mismo tiempo nosotros ya strippeamos el header
    # Content-Encoding → el browser recibe bytes comprimidos sin header → JSON.parse falla.
    # Al excluir accept-encoding, httpx negocia solo los encodings que puede manejar.
    skip = {'host', 'content-length', 'transfer-encoding', 'connection', 'accept-encoding'}
    headers = {k: v for k, v in request.headers.items() if k.lower() not in skip}
    body    = await request.body()
    client  = await _client(app_id)

    try:
        resp = await client.request(
            method=request.method, url=target_url,
            headers=headers, content=body,
        )
    except httpx.ConnectError:
        raise HTTPException(503, detail=f"Backend {app_id} no disponible en :{port}")

    # Filtrar headers de respuesta que httpx ya maneja
    skip_resp = {'content-encoding', 'transfer-encoding', 'content-length', 'connection'}
    resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in skip_resp}

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=resp_headers,
        media_type=resp.headers.get('content-type'),
    )


# ── Servir frontends React (genérico para todas las apps) ────────────────────
# /apps/{app_id}/*  → dist/ estático si existe (prod)
#                   → proxy a Vite dev server si no hay dist/ (dev)
#
# Vite en dev se configura con base='/apps/{id}/' en cada vite.config.ts,
# por lo que sus URLs tienen exactamente el mismo prefijo que el gateway usa.


async def _proxy_vite(port: int, path: str, request: Request) -> Response:
    """Proxea una petición al Vite dev server en `port`."""
    qs     = request.url.query
    target = f"http://localhost:{port}/{path}" + (f"?{qs}" if qs else "")
    skip   = {'host', 'content-length', 'transfer-encoding', 'connection', 'accept-encoding'}
    headers = {k: v for k, v in request.headers.items() if k.lower() not in skip}
    body    = await request.body()
    try:
        c    = await _client(f'_vite_{port}')
        resp = await c.request(request.method, target, headers=headers, content=body)
        skip_r = {'content-encoding', 'transfer-encoding', 'content-length', 'connection'}
        resp_h = {k: v for k, v in resp.headers.items() if k.lower() not in skip_r}
        return Response(resp.content, resp.status_code, resp_h,
                        media_type=resp.headers.get('content-type'))
    except httpx.ConnectError:
        return HTMLResponse(
            f"<p>Frontend no disponible en :{port}.<br>"
            "<b>Prod</b>: <code>npm run build</code><br>"
            "<b>Dev</b>: <code>npm run dev</code></p>",
            status_code=503,
        )


@app.get('/apps/{app_id}/{path:path}')
async def serve_app_frontend(app_id: str, path: str, request: Request):
    """Sirve el frontend de cualquier app: estático desde dist/ o proxy Vite."""
    cfg = APPS.get(app_id)
    if not cfg:
        raise HTTPException(404, detail=f"App '{app_id}' no registrada")

    dist: Path = cfg.get('frontend_dist', Path(''))

    # ── Modo prod: dist/ existe → servir como estáticos ──────────────────────
    if dist.exists():
        if path:
            candidate = dist / path
            if candidate.is_file():
                return FileResponse(str(candidate))
        # SPA fallback → React Router maneja el resto
        return FileResponse(str(dist / 'index.html'))

    # ── Modo dev: proxy al Vite dev server ───────────────────────────────────
    dev_port = cfg.get('frontend_port')
    if not dev_port:
        return HTMLResponse(f"Frontend {app_id} no disponible (sin dist/ ni dev server)", 503)

    # Vite sirve bajo /apps/{app_id}/ cuando base está configurada
    dev_path = f"apps/{app_id}/{path}"
    return await _proxy_vite(dev_port, dev_path, request)


@app.get('/apps/{app_id}')
async def serve_app_root(app_id: str, request: Request):
    return await serve_app_frontend(app_id, '', request)


# ── Servir el Portal React ────────────────────────────────────────────────────
# /* → dist/ estático del portal (prod) o proxy a Vite dev :5175 (dev)

PORTAL_DIST    = BASE_DIR / 'dist'
PORTAL_DEV_PORT = 5175   # el portal dev se mueve a :5175 para no colisionar


@app.get('/{path:path}')
async def serve_portal(path: str, request: Request):
    # Proteger rutas internas (ya manejadas antes)
    if path.startswith(('api/', 'apps/')):
        raise HTTPException(404)

    # Modo prod: servir desde dist/
    if PORTAL_DIST.exists():
        candidate = PORTAL_DIST / path
        if path and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(PORTAL_DIST / 'index.html'))

    # Modo dev: proxy a Vite portal en :5175
    qs     = request.url.query
    target = f"http://localhost:{PORTAL_DEV_PORT}/{path}" + (f"?{qs}" if qs else "")
    skip   = {'host', 'content-length', 'transfer-encoding', 'connection', 'accept-encoding'}
    headers = {k: v for k, v in request.headers.items() if k.lower() not in skip}
    body    = await request.body()
    try:
        c    = await _client('__portal__')
        resp = await c.request(request.method, target, headers=headers, content=body)
        skip_resp = {'content-encoding', 'transfer-encoding', 'content-length', 'connection'}
        resp_h = {k: v for k, v in resp.headers.items() if k.lower() not in skip_resp}
        return Response(resp.content, resp.status_code, resp_h,
                        media_type=resp.headers.get('content-type'))
    except httpx.ConnectError:
        return HTMLResponse(
            "<h2>Portal no disponible</h2>"
            "<p>El build del portal no existe aún.</p>"
            "<p>Ejecutá: <code>cd \"Portal de Acceso\" &amp;&amp; npm run build</code></p>"
            "<p>O para desarrollo: <code>npm run dev</code> (Vite en :5175)</p>",
            status_code=503,
        )


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=PORT, log_level='warning')
