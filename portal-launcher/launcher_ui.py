"""
launcher_ui.py — Portal de Acceso CFOTech
Ventana flotante informativa que reemplaza la consola DOS del START.bat.
Arranca Portal Launcher (:4999) y Portal React (:5174) en background,
muestra estado en tiempo real con el Design System CFOTech.
"""

import tkinter as tk
import threading
import subprocess
import urllib.request
import webbrowser
import time
import os
import sys

# ── Paths ─────────────────────────────────────────────────────────────────────
LAUNCHER_DIR = os.path.dirname(os.path.abspath(__file__))   # portal-launcher/
BASE_DIR     = os.path.dirname(LAUNCHER_DIR)                # Portal de Acceso/

# ── Config desde launcher/.env ────────────────────────────────────────────────
# Leemos el mismo .env que usa launcher.py para obtener APP_HOST y PORTAL_PORT.
_env_path = os.path.join(LAUNCHER_DIR, '.env')
_ui_cfg: dict[str, str] = {}
if os.path.exists(_env_path):
    with open(_env_path, encoding='utf-8') as _f:
        for _l in _f:
            _l = _l.strip()
            if _l and not _l.startswith('#') and '=' in _l:
                _k, _v = _l.split('=', 1)
                _ui_cfg[_k.strip()] = _v.strip()

LAUNCHER_PORT = int(_ui_cfg.get('PORT',         '4999'))
APP_HOST      =     _ui_cfg.get('APP_HOST',     'localhost')
PORTAL_PORT   = int(_ui_cfg.get('PORTAL_PORT',  '5174'))

LAUNCHER_URL  = f'http://localhost:{LAUNCHER_PORT}'   # siempre local (mismo PC)
PORTAL_URL    = f'http://{APP_HOST}:{PORTAL_PORT}'    # puede ser IP/dominio en red

# ── Design System tokens ──────────────────────────────────────────────────────
C_HEADER    = '#0B1526'   # --navy-dark   header bg
C_BORDER    = '#1C2E48'   # header border / window outline
C_BODY      = '#F4F6F9'   # --gray1       body bg
C_NAVY      = '#0A1F44'   # --navy        botón principal
C_NAVY_HOV  = '#1B3F8A'   # hover primary
C_GREEN_LOG = '#00A878'   # --logo-green  logo badge
C_ACCENT    = '#4FD1B2'   # --green-a     subtitle + dot ready
C_WHITE     = '#FFFFFF'
C_TEXT      = '#0D1B2A'   # --text
C_TEXT2     = '#4A5568'   # --text2
C_MUTED     = '#8898AA'
C_DIVIDER   = '#E8ECF2'   # --gray2
C_BORDER_W  = '#D1D9E6'   # --border

# Estado → color del punto / etiqueta
DOT_FG = {
    'pending':   '#CBD5E0',
    'launching': '#F6AD55',
    'ready':     '#4FD1B2',
    'error':     '#FC8181',
}
DOT_TXT = {
    'pending':   'Pendiente',
    'launching': 'Iniciando…',
    'ready':     'Listo  ✓',
    'error':     'Error  ✗',
}
DOT_TXT_FG = {
    'pending':   '#A0AEC0',
    'launching': '#C05621',
    'ready':     '#2C7A7B',
    'error':     '#C53030',
}


# ── Helpers de proceso ────────────────────────────────────────────────────────

def _ping(url: str, timeout: float = 2.0) -> bool:
    try:
        urllib.request.urlopen(url, timeout=timeout)
        return True
    except Exception:
        return False


def _kill_port(port: int) -> None:
    """Termina cualquier proceso que esté escuchando en `port` (Windows)."""
    try:
        r = subprocess.run(
            f'netstat -ano | findstr :{port} | findstr LISTENING',
            shell=True, capture_output=True, text=True,
        )
        for line in r.stdout.strip().splitlines():
            pid = line.split()[-1]
            if pid.isdigit():
                subprocess.run(f'taskkill /PID {pid} /F',
                               shell=True, capture_output=True)
    except Exception:
        pass


def _run_proc(cmd: str, cwd: str) -> subprocess.Popen:
    """Lanza un subproceso sin ventana de consola visible."""
    kw: dict = dict(cwd=cwd, shell=True,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if sys.platform == 'win32':
        kw['creationflags'] = 0x08000000   # CREATE_NO_WINDOW
    return subprocess.Popen(cmd, **kw)


# ── UI ────────────────────────────────────────────────────────────────────────

class LauncherUI:

    W, H     = 390, 320
    HDR_H    = 52
    POLL_MS  = 3_000   # intervalo de polling de salud (ms)

    def __init__(self):
        self._procs: dict = {}
        self._status = {'launcher': 'pending', 'portal': 'pending'}
        self._alive  = True
        self._drag   = (0, 0)
        self._rows:  dict = {}    # { key: {'dot': Label, 'status': Label} }

        self.root = tk.Tk()
        self._configure_root()
        self._build_ui()

        # Arrancar servicios en background
        threading.Thread(target=self._startup_sequence, daemon=True).start()
        # Primer check de salud luego del delay inicial
        self.root.after(self.POLL_MS, self._poll)
        self.root.mainloop()

    # ── configuración de la ventana ──────────────────────────────────────────

    def _configure_root(self):
        r = self.root
        r.title('CFOTech IT Tools')
        r.geometry(f'{self.W}x{self.H}')
        r.resizable(False, False)
        r.overrideredirect(True)      # chrome propio (sin barra de título OS)
        r.configure(bg=C_BORDER)      # borde de 1px via bg del root

        # Centrar en pantalla
        r.update_idletasks()
        x = (r.winfo_screenwidth()  - self.W) // 2
        y = (r.winfo_screenheight() - self.H) // 2
        r.geometry(f'{self.W}x{self.H}+{x}+{y}')

    # ── construcción de la UI ────────────────────────────────────────────────

    def _build_ui(self):
        # Marco interno (deja el borde del root visible)
        wrap = tk.Frame(self.root, bg=C_BODY)
        wrap.pack(fill='both', expand=True, padx=1, pady=1)

        self._build_header(wrap)
        self._build_body(wrap)

    # ── header ───────────────────────────────────────────────────────────────

    def _build_header(self, parent):
        hdr = tk.Frame(parent, bg=C_HEADER, height=self.HDR_H)
        hdr.pack(fill='x')
        hdr.pack_propagate(False)
        hdr.bind('<Button-1>',  self._drag_start)
        hdr.bind('<B1-Motion>', self._drag_move)

        # ── Logo badge (32×32 verde, texto "CFO") ───────────────────────────
        logo = tk.Frame(hdr, bg=C_GREEN_LOG, width=32, height=32)
        logo.place(x=14, y=10)
        logo.pack_propagate(False)
        lbl_cfo = tk.Label(logo, text='CFO', bg=C_GREEN_LOG, fg=C_WHITE,
                           font=('Segoe UI', 8, 'bold'))
        lbl_cfo.place(relx=0.5, rely=0.5, anchor='center')
        for w in (logo, lbl_cfo):
            w.bind('<Button-1>',  self._drag_start)
            w.bind('<B1-Motion>', self._drag_move)

        # ── Brand: "CFOTech  IT Tools" ───────────────────────────────────────
        brand = tk.Frame(hdr, bg=C_HEADER)
        brand.place(x=54, y=7)
        brand.bind('<Button-1>',  self._drag_start)
        brand.bind('<B1-Motion>', self._drag_move)
        tk.Label(brand, text='CFOTech', bg=C_HEADER, fg=C_WHITE,
                 font=('Segoe UI', 13, 'bold')).pack(side='left')
        tk.Label(brand, text='  IT Tools', bg=C_HEADER, fg=C_ACCENT,
                 font=('Segoe UI', 11, 'bold')).pack(side='left')

        tk.Label(hdr, text='Portal de Acceso', bg=C_HEADER,
                 fg='#566C87', font=('Segoe UI', 8)).place(x=55, y=33)

        # ── Botón cerrar ─────────────────────────────────────────────────────
        close = tk.Label(hdr, text='✕', bg=C_HEADER, fg='#566C87',
                         font=('Segoe UI', 13), cursor='hand2')
        close.place(x=356, y=13)
        close.bind('<Button-1>', lambda _: self._on_close())
        close.bind('<Enter>',    lambda _: close.config(fg=C_WHITE))
        close.bind('<Leave>',    lambda _: close.config(fg='#566C87'))

    # ── body ─────────────────────────────────────────────────────────────────

    def _build_body(self, parent):
        body = tk.Frame(parent, bg=C_BODY)
        body.pack(fill='both', expand=True)

        # Título sección
        tk.Label(body, text='Estado de servicios', bg=C_BODY, fg=C_TEXT,
                 font=('Segoe UI', 10, 'bold')
                 ).pack(anchor='w', padx=20, pady=(16, 6))

        tk.Frame(body, bg=C_DIVIDER, height=1).pack(fill='x', padx=20)

        # Filas de servicio
        for key, name, port in (
            ('launcher', 'Portal Launcher', ':4999'),
            ('portal',   'Portal React',    ':5174'),
        ):
            self._rows[key] = self._make_service_row(body, name, port)

        tk.Frame(body, bg=C_DIVIDER, height=1).pack(fill='x', padx=20, pady=(4, 0))

        # Etiqueta de paso actual
        self.step_var = tk.StringVar(value='Iniciando…')
        tk.Label(body, textvariable=self.step_var,
                 bg=C_BODY, fg=C_MUTED,
                 font=('Segoe UI', 8), wraplength=350, justify='left',
                 ).pack(anchor='w', padx=20, pady=5)

        tk.Frame(body, bg=C_DIVIDER, height=1).pack(fill='x', padx=20, pady=(0, 10))

        # Botones
        btns = tk.Frame(body, bg=C_BODY)
        btns.pack(fill='x', padx=20)

        self.btn_abrir = tk.Button(
            btns, text='Abrir portal en navegador',
            bg=C_NAVY, fg=C_WHITE, relief='flat', bd=0,
            font=('Segoe UI', 10, 'bold'), cursor='hand2',
            activebackground=C_NAVY_HOV, state='disabled',
            command=self._open_browser, pady=8,
        )
        self.btn_abrir.pack(fill='x', pady=(0, 6))

        self.btn_detener = tk.Button(
            btns, text='Detener todos los servicios',
            bg=C_BODY, fg='#C53030', relief='flat', bd=0,
            font=('Segoe UI', 9), cursor='hand2',
            activebackground='#FFF5F5',
            command=self._stop_all, pady=6,
            highlightthickness=1, highlightbackground='#FEB2B2',
        )
        self.btn_detener.pack(fill='x')

        # Nota pie
        tk.Label(body,
                 text='Cerrar esta ventana no detiene los servicios.',
                 bg=C_BODY, fg='#A0AEC0', font=('Segoe UI', 7),
                 ).pack(side='bottom', pady=(4, 8))

    def _make_service_row(self, parent, name: str, port: str) -> dict:
        """Crea una fila de estado para un servicio."""
        row = tk.Frame(parent, bg=C_BODY)
        row.pack(fill='x', padx=20, pady=7)

        dot = tk.Label(row, text='●', bg=C_BODY, fg=DOT_FG['pending'],
                       font=('Segoe UI', 18))
        dot.pack(side='left')

        info = tk.Frame(row, bg=C_BODY)
        info.pack(side='left', padx=10)
        tk.Label(info, text=name, bg=C_BODY, fg=C_TEXT,
                 font=('Segoe UI', 10)).pack(anchor='w')
        tk.Label(info, text=f'localhost{port}', bg=C_BODY, fg=C_TEXT2,
                 font=('Segoe UI', 8)).pack(anchor='w')

        status_lbl = tk.Label(row, text=DOT_TXT['pending'],
                              bg=C_BODY, fg=DOT_TXT_FG['pending'],
                              font=('Segoe UI', 9, 'bold'))
        status_lbl.pack(side='right')

        return {'dot': dot, 'status': status_lbl}

    # ── drag ─────────────────────────────────────────────────────────────────

    def _drag_start(self, e):
        self._drag = (e.x_root - self.root.winfo_x(),
                      e.y_root - self.root.winfo_y())

    def _drag_move(self, e):
        x = e.x_root - self._drag[0]
        y = e.y_root - self._drag[1]
        self.root.geometry(f'+{x}+{y}')

    # ── helpers de estado ─────────────────────────────────────────────────────

    def _set_status(self, key: str, status: str):
        """Actualiza estado y refresca la UI (thread-safe via after)."""
        self._status[key] = status
        self.root.after(0, self._refresh_row, key)

    def _set_step(self, text: str):
        """Actualiza la etiqueta de paso actual (thread-safe)."""
        self.root.after(0, self.step_var.set, text)

    def _refresh_row(self, key: str):
        s   = self._status[key]
        row = self._rows[key]
        row['dot'].config(fg=DOT_FG.get(s, '#CBD5E0'))
        row['status'].config(
            text=DOT_TXT.get(s, s),
            fg=DOT_TXT_FG.get(s, C_MUTED),
        )

    # ── secuencia de arranque ─────────────────────────────────────────────────

    def _startup_sequence(self):
        # 1. Liberar puertos
        self._set_step(f'Liberando puertos {LAUNCHER_PORT} y {PORTAL_PORT}…')
        _kill_port(LAUNCHER_PORT)
        _kill_port(PORTAL_PORT)
        time.sleep(0.4)

        # 2. pip install (silencioso)
        self._set_step('Verificando dependencias Python…')
        self._set_status('launcher', 'launching')
        subprocess.run(
            'pip install -r requirements.txt -q',
            cwd=LAUNCHER_DIR, shell=True,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

        # 3. Arrancar Portal Launcher (siempre en localhost — mismo PC)
        self._set_step(f'Iniciando Portal Launcher (:{LAUNCHER_PORT})…')
        if not _ping(f'{LAUNCHER_URL}/api/health', 1):
            self._procs['launcher'] = _run_proc('python launcher.py', LAUNCHER_DIR)

        deadline = time.time() + 20
        while time.time() < deadline:
            if _ping(f'{LAUNCHER_URL}/api/health', 1):
                self._set_status('launcher', 'ready')
                break
            time.sleep(0.8)
        else:
            self._set_status('launcher', 'error')
            self._set_step(f'Error: Portal Launcher no respondió en 20 s.')
            return

        # 4. npm install si falta node_modules
        self._set_status('portal', 'launching')
        if not os.path.isdir(os.path.join(BASE_DIR, 'node_modules')):
            self._set_step('Instalando dependencias npm (primera vez, aguarda)…')
            subprocess.run(
                'npm install --silent',
                cwd=BASE_DIR, shell=True,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )

        # 5. Arrancar Vite portal (Vite siempre escucha en localhost)
        local_portal = f'http://localhost:{PORTAL_PORT}'
        self._set_step(f'Iniciando Portal React + Vite (:{PORTAL_PORT})…')
        if not _ping(local_portal, 1):
            self._procs['portal'] = _run_proc('npm run dev', BASE_DIR)

        deadline = time.time() + 45
        while time.time() < deadline:
            if _ping(local_portal, 1):
                self._set_status('portal', 'ready')
                self._set_step(f'Portal listo — {PORTAL_URL}')
                self.root.after(0, self._on_portal_ready)
                return
            time.sleep(1)

        self._set_status('portal', 'error')
        self._set_step(f'Error: Portal no respondió en 45 s.')

    def _on_portal_ready(self):
        """Habilita el botón Abrir y abre el browser automáticamente."""
        self.btn_abrir.config(state='normal', bg=C_NAVY)
        webbrowser.open(PORTAL_URL)

    # ── health polling ────────────────────────────────────────────────────────

    def _poll(self):
        if not self._alive:
            return
        threading.Thread(target=self._check_health, daemon=True).start()

    def _check_health(self):
        local_portal = f'http://localhost:{PORTAL_PORT}'
        l_ok = _ping(f'{LAUNCHER_URL}/api/health', 1.5)
        p_ok = _ping(local_portal, 1.5)
        if self._alive:
            self.root.after(0, self._apply_health, l_ok, p_ok)

    def _apply_health(self, launcher_ok: bool, portal_ok: bool):
        if self._status['launcher'] == 'ready' and not launcher_ok:
            self._set_status('launcher', 'error')
            self._set_step(f'Advertencia: Launcher (:{LAUNCHER_PORT}) no responde.')
        if self._status['portal'] == 'ready' and not portal_ok:
            self._set_status('portal', 'error')
            self._set_step(f'Advertencia: Portal (:{PORTAL_PORT}) no responde.')
        if self._alive:
            self.root.after(self.POLL_MS, self._poll)

    # ── acciones ─────────────────────────────────────────────────────────────

    def _open_browser(self):
        webbrowser.open(PORTAL_URL)

    def _stop_all(self):
        self._set_step('Deteniendo servicios…')
        # Pedir al launcher que detenga todas las apps
        try:
            req = urllib.request.Request(
                f'{LAUNCHER_URL}/api/stop-all',
                data=b'', method='POST')
            urllib.request.urlopen(req, timeout=3)
        except Exception:
            pass
        # Terminar procesos propios
        for proc in self._procs.values():
            if proc:
                try:
                    proc.terminate()
                except Exception:
                    pass
        self._procs.clear()
        _kill_port(LAUNCHER_PORT)
        _kill_port(PORTAL_PORT)
        self._set_status('launcher', 'pending')
        self._set_status('portal',   'pending')
        self._set_step('Servicios detenidos.')
        self.root.after(0, lambda: self.btn_abrir.config(state='disabled'))

    def _on_close(self):
        """Cierra solo la ventana. Los servicios siguen corriendo en background."""
        self._alive = False
        self.root.destroy()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    LauncherUI()
