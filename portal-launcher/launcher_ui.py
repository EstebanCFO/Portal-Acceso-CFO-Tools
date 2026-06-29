"""
launcher_ui.py — Portal de Acceso CFOTech
Splash screen: spinner animado + progress bar con porcentaje + texto de paso.
Se cierra automáticamente cuando el portal levanta.
"""

import tkinter as tk
import threading
import subprocess
import urllib.request
import webbrowser
import time
import os
import sys

# ── DPI awareness (Windows) ───────────────────────────────────────────────────
# Sin esto, en displays 4K / HiDPI Windows escala el proceso con interpolación
# bilineal → textos y bordes se ven borrosos ("baja calidad de imagen").
# SetProcessDpiAwareness(2) = Per-Monitor DPI Aware v1 (Win 8.1+).
try:
    from ctypes import windll
    windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    try:
        from ctypes import windll
        windll.user32.SetProcessDPIAware()   # fallback Win Vista+
    except Exception:
        pass

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
C_TRACK     = '#162235'   # fondo de la barra de progreso


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

    W, H    = 340, 300     # antes: 300, 248
    HDR_H   = 46
    SPIN_R  = 42           # antes: 28
    SPIN_MS = 25            # ms entre frames del spinner
    SPIN_STEP = 9           # grados por frame
    BAR_W   = 280          # antes: 230 — ahora es el ancho de los segmentos
    BAR_H   = 4             # alto de cada segmento
    BAR_R   = 3             # radio de esquinas de segmentos

    def __init__(self):
        self._procs:   dict = {}
        self._alive    = True
        self._drag     = (0, 0)
        self._angle    = 0
        self._spin_job = None
        self._error    = False
        self._pct      = 0

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
        hdr.bind('<Button-1>',  self._drag_start)
        hdr.bind('<B1-Motion>', self._drag_move)

        # Logo badge 32×32px (#00A878, r-8 aproximado con padding)
        logo = tk.Frame(hdr, bg=C_GREEN_LOG, width=32, height=32)
        logo.place(x=12, y=7)
        logo.pack_propagate(False)
        lbl = tk.Label(logo, text='CFO', bg=C_GREEN_LOG, fg=C_WHITE,
                       font=('Segoe UI', 8, 'bold'))
        lbl.place(relx=.5, rely=.5, anchor='center')
        for w in (logo, lbl):
            w.bind('<Button-1>',  self._drag_start)
            w.bind('<B1-Motion>', self._drag_move)

        # Brand
        brand = tk.Frame(hdr, bg=C_HEADER)
        brand.place(x=52, y=5)
        brand.bind('<Button-1>',  self._drag_start)
        brand.bind('<B1-Motion>', self._drag_move)
        tk.Label(brand, text='CFOTech', bg=C_HEADER, fg=C_WHITE,
                 font=('Segoe UI', 13, 'bold')).pack(side='left')
        tk.Label(brand, text='  IT Tools', bg=C_HEADER, fg=C_ACCENT,
                 font=('Segoe UI', 11, 'bold')).pack(side='left')
        sub = tk.Label(hdr, text='Portal de Acceso', bg=C_HEADER,
                       fg=C_MUTED, font=('Segoe UI', 7))
        sub.place(x=53, y=28)
        sub.bind('<Button-1>',  self._drag_start)
        sub.bind('<B1-Motion>', self._drag_move)

        # Botón cerrar — reposicionado para ancho 340
        close = tk.Label(hdr, text='✕', bg=C_HEADER, fg=C_MUTED,
                         font=('Segoe UI', 12), cursor='hand2')
        close.place(x=self.W - 28, y=14)
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
        self._canvas.pack(pady=(18, 0))

        # Título principal
        tk.Label(body, text='Iniciando Plataforma',
                 bg=C_BODY, fg=C_WHITE,
                 font=('Segoe UI', 12, 'bold')
                 ).pack(pady=(8, 0))

        # Texto de paso (step detail)
        self.step_var = tk.StringVar(value='')
        self.step_lbl = tk.Label(body, textvariable=self.step_var,
                                 bg=C_BODY, fg=C_MUTED,
                                 font=('Segoe UI', 8),
                                 wraplength=260, justify='center')
        self.step_lbl.pack(pady=(3, 0))

        # ── Barra de progreso ──────────────────────────────────────────────
        bar_frame = tk.Frame(body, bg=C_BODY)
        bar_frame.pack(pady=(12, 0))

        self._bar_canvas = tk.Canvas(
            bar_frame,
            width=self.BAR_W, height=self.BAR_H,
            bg=C_BODY, highlightthickness=0,
        )
        self._bar_canvas.pack()

        # Porcentaje a la derecha de la barra
        pct_row = tk.Frame(body, bg=C_BODY)
        pct_row.pack(pady=(4, 0))
        self._pct_var = tk.StringVar(value='0%')
        tk.Label(pct_row, textvariable=self._pct_var,
                 bg=C_BODY, fg=C_ACCENT,
                 font=('Segoe UI', 8, 'bold')).pack()

        # Dibuja la barra inicial vacía
        self._draw_bar(0)

        # Inicia animación del spinner
        self._spin()

    # ── barra de progreso ─────────────────────────────────────────────────────

    def _draw_bar(self, pct: int):
        """Redibuja la barra de progreso para el porcentaje dado (0-100)."""
        c  = self._bar_canvas
        w  = self.BAR_W
        h  = self.BAR_H
        r  = self.BAR_R
        c.delete('all')

        # Pista (fondo)
        c.create_rounded_rect = lambda *a, **kw: self._rounded_rect(c, *a, **kw)

        # Fondo de la pista
        self._rounded_rect(c, 0, 0, w, h, r, fill=C_TRACK, outline='')

        # Porción rellena
        filled_w = max(0, int(w * pct / 100))
        if filled_w > 0:
            self._rounded_rect(c, 0, 0, filled_w, h, r, fill=C_ACCENT, outline='')

    def _rounded_rect(self, canvas, x1, y1, x2, y2, radius, **kw):
        """Dibuja un rectángulo con esquinas redondeadas en el canvas dado."""
        r = radius
        # Si el ancho es menor que 2*radio, recortar el radio
        r = min(r, (x2 - x1) // 2, (y2 - y1) // 2)
        if r < 1:
            canvas.create_rectangle(x1, y1, x2, y2, **kw)
            return
        # Construir polígono con arcos en las esquinas
        canvas.create_polygon(
            x1 + r, y1,
            x2 - r, y1,
            x2,     y1,
            x2,     y1 + r,
            x2,     y2 - r,
            x2,     y2,
            x2 - r, y2,
            x1 + r, y2,
            x1,     y2,
            x1,     y2 - r,
            x1,     y1 + r,
            x1,     y1,
            smooth=True, **kw,
        )

    def _set_progress(self, pct: int):
        """Actualiza la barra y el porcentaje. Thread-safe."""
        self._pct = pct
        def _update():
            self._draw_bar(pct)
            self._pct_var.set(f'{pct}%')
        self.root.after(0, _update)

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
        # 1. Liberar el puerto del portal (5174 = gateway unificado)
        self._set_step('Liberando puertos…')
        self._set_progress(10)
        _kill_port(PORTAL_PORT)
        time.sleep(0.4)
        self._set_progress(25)

        # 2. Limpiar caché del portal antes de arrancar
        #    · __pycache__ en la raíz → bytecode viejo del gateway
        #    · node_modules/.vite/    → caché de módulos del Vite dev server
        self._set_step('Limpiando caché…')
        import shutil as _shutil
        # Python bytecode — raíz del portal
        for _cache in ['__pycache__', 'portal-launcher/__pycache__']:
            _cache_path = os.path.join(BASE_DIR, _cache)
            if os.path.isdir(_cache_path):
                try:
                    _shutil.rmtree(_cache_path, ignore_errors=True)
                except Exception:
                    pass
        # Vite module cache — puede crecer y causar problemas de resolución de módulos
        _vite_cache = os.path.join(BASE_DIR, 'node_modules', '.vite')
        if os.path.isdir(_vite_cache):
            try:
                _shutil.rmtree(_vite_cache, ignore_errors=True)
            except Exception:
                pass
        self._set_progress(50)

        # 3. pip install — dependencias del gateway (uvicorn, fastapi, httpx, etc.)
        self._set_step('Verificando dependencias…')
        import importlib.util as _il
        _pkgs = ['uvicorn', 'fastapi', 'httpx', 'dotenv']
        _dotenv_ok = _il.find_spec('dotenv') is not None or _il.find_spec('python_dotenv') is not None
        if not all(_il.find_spec(p) is not None for p in ['uvicorn', 'fastapi', 'httpx']) or not _dotenv_ok:
            subprocess.run(
                f'"{sys.executable}" -m pip install uvicorn fastapi httpx python-dotenv requests -q',
                shell=True,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
        self._set_progress(75)

        # 4. Arrancar portal_server.py (gateway unificado en PORTAL_PORT)
        self._set_step('Iniciando plataforma…')
        local_portal = f'http://localhost:{PORTAL_PORT}'
        gateway_script = os.path.join(BASE_DIR, 'portal_server.py')
        if not _ping(f'{local_portal}/api/health', 1) and os.path.exists(gateway_script):
            self._procs['gateway'] = _run_proc(
                f'"{sys.executable}" portal_server.py',
                BASE_DIR,
            )

        # 5. Esperar a que el gateway responda (hasta 45s — arranca backends en background)
        self._set_step('Esperando respuesta del portal…')
        deadline = time.time() + 45
        while time.time() < deadline:
            if _ping(f'{local_portal}/api/health', 1):
                self._set_progress(100)
                self._set_step('¡Listo!')
                time.sleep(0.4)
                self.root.after(0, self._on_portal_ready)
                return
            time.sleep(1)

        self._show_error('El portal no respondió en el tiempo esperado.\nVerificar Python y ejecutar START.bat.')

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
