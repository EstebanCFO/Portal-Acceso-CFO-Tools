"""
launcher_ui.py — Portal de Acceso CFOTech
Splash screen minimalista: spinner animado + "Iniciando Plataforma".
Se cierra automáticamente cuando el portal levanta.
Sin botones ni paneles de estado — la secuencia es invisible para el usuario.
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
_env_path = os.path.join(LAUNCHER_DIR, '.env')
_ui_cfg: dict[str, str] = {}
if os.path.exists(_env_path):
    with open(_env_path, encoding='utf-8') as _f:
        for _l in _f:
            _l = _l.strip()
            if _l and not _l.startswith('#') and '=' in _l:
                _k, _v = _l.split('=', 1)
                _ui_cfg[_k.strip()] = _v.strip()

LAUNCHER_PORT = int(_ui_cfg.get('PORT',        '4999'))
APP_HOST      =     _ui_cfg.get('APP_HOST',    'localhost')
PORTAL_PORT   = int(_ui_cfg.get('PORTAL_PORT', '5174'))

LAUNCHER_URL  = f'http://localhost:{LAUNCHER_PORT}'
PORTAL_URL    = f'http://{APP_HOST}:{PORTAL_PORT}'

# ── Design System tokens ──────────────────────────────────────────────────────
C_HEADER    = '#0B1526'
C_BORDER    = '#1C2E48'
C_BODY      = '#0D1B2A'   # fondo oscuro unificado para splash
C_GREEN_LOG = '#00A878'
C_ACCENT    = '#4FD1B2'
C_WHITE     = '#FFFFFF'
C_MUTED     = '#566C87'
C_ERROR     = '#FC8181'


# ── Helpers de proceso ────────────────────────────────────────────────────────

def _ping(url: str, timeout: float = 2.0) -> bool:
    try:
        urllib.request.urlopen(url, timeout=timeout)
        return True
    except Exception:
        return False


def _kill_port(port: int) -> None:
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
    kw: dict = dict(cwd=cwd, shell=True,
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if sys.platform == 'win32':
        kw['creationflags'] = 0x08000000   # CREATE_NO_WINDOW
    return subprocess.Popen(cmd, **kw)


# ── UI ────────────────────────────────────────────────────────────────────────

class LauncherUI:

    W, H    = 280, 210
    HDR_H   = 46
    SPIN_R  = 28          # radio del arco del spinner (px)
    SPIN_MS = 25          # ms entre frames del spinner
    SPIN_STEP = 9         # grados por frame

    def __init__(self):
        self._procs:   dict = {}
        self._alive    = True
        self._drag     = (0, 0)
        self._angle    = 0
        self._spin_job = None
        self._error    = False

        self.root = tk.Tk()
        self._configure_root()
        self._build_ui()

        threading.Thread(target=self._startup_sequence, daemon=True).start()
        self.root.mainloop()

    # ── ventana ───────────────────────────────────────────────────────────────

    def _configure_root(self):
        r = self.root
        r.title('CFOTech IT Tools')
        r.resizable(False, False)
        r.overrideredirect(True)
        r.configure(bg=C_BORDER)
        r.update_idletasks()
        x = (r.winfo_screenwidth()  - self.W) // 2
        y = (r.winfo_screenheight() - self.H) // 2
        r.geometry(f'{self.W}x{self.H}+{x}+{y}')

    # ── construcción UI ───────────────────────────────────────────────────────

    def _build_ui(self):
        wrap = tk.Frame(self.root, bg=C_BODY)
        wrap.pack(fill='both', expand=True, padx=1, pady=1)

        self._build_header(wrap)
        self._build_body(wrap)

    def _build_header(self, parent):
        hdr = tk.Frame(parent, bg=C_HEADER, height=self.HDR_H)
        hdr.pack(fill='x')
        hdr.pack_propagate(False)
        for evt in ('<Button-1>', '<B1-Motion>'):
            hdr.bind(evt, self._drag_start if '1>' in evt else self._drag_move)
        hdr.bind('<Button-1>',  self._drag_start)
        hdr.bind('<B1-Motion>', self._drag_move)

        # Logo badge
        logo = tk.Frame(hdr, bg=C_GREEN_LOG, width=28, height=28)
        logo.place(x=12, y=9)
        logo.pack_propagate(False)
        lbl = tk.Label(logo, text='CFO', bg=C_GREEN_LOG, fg=C_WHITE,
                       font=('Segoe UI', 7, 'bold'))
        lbl.place(relx=.5, rely=.5, anchor='center')
        for w in (logo, lbl):
            w.bind('<Button-1>',  self._drag_start)
            w.bind('<B1-Motion>', self._drag_move)

        # Brand
        brand = tk.Frame(hdr, bg=C_HEADER)
        brand.place(x=48, y=6)
        brand.bind('<Button-1>',  self._drag_start)
        brand.bind('<B1-Motion>', self._drag_move)
        tk.Label(brand, text='CFOTech', bg=C_HEADER, fg=C_WHITE,
                 font=('Segoe UI', 11, 'bold')).pack(side='left')
        tk.Label(brand, text='  IT Tools', bg=C_HEADER, fg=C_ACCENT,
                 font=('Segoe UI', 10, 'bold')).pack(side='left')
        sub = tk.Label(hdr, text='Portal de Acceso', bg=C_HEADER,
                       fg=C_MUTED, font=('Segoe UI', 7))
        sub.place(x=49, y=28)
        sub.bind('<Button-1>',  self._drag_start)
        sub.bind('<B1-Motion>', self._drag_move)

        # Botón cerrar
        close = tk.Label(hdr, text='✕', bg=C_HEADER, fg=C_MUTED,
                         font=('Segoe UI', 12), cursor='hand2')
        close.place(x=self.W - 26, y=14)
        close.bind('<Button-1>', lambda _: self._on_close())
        close.bind('<Enter>',    lambda _: close.config(fg=C_WHITE))
        close.bind('<Leave>',    lambda _: close.config(fg=C_MUTED))

    def _build_body(self, parent):
        body = tk.Frame(parent, bg=C_BODY)
        body.pack(fill='both', expand=True)

        # Canvas para el spinner
        size = (self.SPIN_R + 8) * 2
        self._canvas = tk.Canvas(body, width=size, height=size,
                                 bg=C_BODY, highlightthickness=0)
        self._canvas.pack(pady=(22, 0))

        # Título principal
        tk.Label(body, text='Iniciando Plataforma',
                 bg=C_BODY, fg=C_WHITE,
                 font=('Segoe UI', 12, 'bold')
                 ).pack(pady=(10, 0))

        # Texto de paso (step detail)
        self.step_var = tk.StringVar(value='')
        self.step_lbl = tk.Label(body, textvariable=self.step_var,
                                 bg=C_BODY, fg=C_MUTED,
                                 font=('Segoe UI', 8),
                                 wraplength=240, justify='center')
        self.step_lbl.pack(pady=(4, 0))

        # Inicia animación del spinner
        self._spin()

    # ── spinner ───────────────────────────────────────────────────────────────

    def _spin(self):
        """Dibuja el arco rotante en el canvas. Llamado cada SPIN_MS ms."""
        if not self._alive or self._error:
            return
        c  = self._canvas
        r  = self.SPIN_R
        m  = r + 8          # margen hasta el borde del canvas
        x0, y0 = m - r, m - r
        x1, y1 = m + r, m + r

        c.delete('all')

        # Pista (arco base, gris oscuro)
        c.create_arc(x0, y0, x1, y1,
                     start=0, extent=359,
                     outline='#1C2E48', width=4, style='arc')

        # Arco animado (270° de apertura)
        c.create_arc(x0, y0, x1, y1,
                     start=self._angle, extent=270,
                     outline=C_ACCENT, width=4, style='arc')

        self._angle = (self._angle - self.SPIN_STEP) % 360
        self._spin_job = self.root.after(self.SPIN_MS, self._spin)

    def _stop_spinner(self):
        if self._spin_job:
            self.root.after_cancel(self._spin_job)
            self._spin_job = None
        self._canvas.delete('all')

    # ── drag ──────────────────────────────────────────────────────────────────

    def _drag_start(self, e):
        self._drag = (e.x_root - self.root.winfo_x(),
                      e.y_root - self.root.winfo_y())

    def _drag_move(self, e):
        self.root.geometry(
            f'+{e.x_root - self._drag[0]}+{e.y_root - self._drag[1]}')

    # ── helpers thread-safe ───────────────────────────────────────────────────

    def _set_step(self, text: str):
        self.root.after(0, self.step_var.set, text)

    def _show_error(self, msg: str):
        """Detiene spinner, muestra el error y un link para cerrar."""
        def _draw():
            self._error = True
            self._stop_spinner()

            # Dibujar X roja en el canvas
            c = self._canvas
            r = self.SPIN_R
            m = r + 8
            c.create_oval(m - r, m - r, m + r, m + r,
                          outline=C_ERROR, width=3)
            d = r * 0.55
            c.create_line(m - d, m - d, m + d, m + d,
                          fill=C_ERROR, width=2)
            c.create_line(m + d, m - d, m - d, m + d,
                          fill=C_ERROR, width=2)

            self.step_var.set(msg)
            self.step_lbl.config(fg=C_ERROR)

            # Link para cerrar
            close_lnk = tk.Label(self.root, text='Cerrar',
                                  bg=C_BODY, fg=C_MUTED,
                                  font=('Segoe UI', 8, 'underline'),
                                  cursor='hand2')
            close_lnk.pack(pady=(8, 0))
            close_lnk.bind('<Button-1>', lambda _: self._on_close())

        self.root.after(0, _draw)

    # ── secuencia de arranque ─────────────────────────────────────────────────

    def _startup_sequence(self):
        # 1. Liberar puertos
        self._set_step('Liberando puertos…')
        _kill_port(LAUNCHER_PORT)
        _kill_port(PORTAL_PORT)
        time.sleep(0.4)

        # 2. pip install — solo si algún paquete requerido falta (S1-9)
        self._set_step('Verificando dependencias…')
        import importlib.util as _il
        _pkgs = ['flask', 'flask_cors', 'requests']
        if not all(_il.find_spec(p) is not None for p in _pkgs):
            subprocess.run(
                'pip install -r requirements.txt -q',
                cwd=LAUNCHER_DIR, shell=True,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )

        # 3. Portal Launcher Flask
        self._set_step('Iniciando servicios…')
        if not _ping(f'{LAUNCHER_URL}/api/health', 1):
            self._procs['launcher'] = _run_proc('python launcher.py', LAUNCHER_DIR)

        deadline = time.time() + 20
        while time.time() < deadline:
            if _ping(f'{LAUNCHER_URL}/api/health', 1):
                break
            time.sleep(0.8)
        else:
            self._show_error('El servicio interno no respondió.\nReintentar o ejecutar START.bat manualmente.')
            return

        # 4. npm install si falta node_modules
        if not os.path.isdir(os.path.join(BASE_DIR, 'node_modules')):
            self._set_step('Instalando dependencias (primera vez)…')
            subprocess.run(
                'npm install --silent',
                cwd=BASE_DIR, shell=True,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )

        # 5. Portal Vite
        self._set_step('')
        local_portal = f'http://localhost:{PORTAL_PORT}'
        if not _ping(local_portal, 1):
            self._procs['portal'] = _run_proc('npm run dev', BASE_DIR)

        deadline = time.time() + 45
        while time.time() < deadline:
            if _ping(local_portal, 1):
                self.root.after(0, self._on_portal_ready)
                return
            time.sleep(1)

        self._show_error('El portal no respondió en el tiempo esperado.\nVerificar Node.js y ejecutar START.bat.')

    def _on_portal_ready(self):
        """Portal listo: abre el browser y cierra la ventana splash."""
        webbrowser.open(PORTAL_URL)
        self._alive = False
        self.root.destroy()

    def _on_close(self):
        """Cierra la ventana. Los servicios siguen corriendo en background."""
        self._alive = False
        self.root.destroy()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    LauncherUI()
