# Splash Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la ventana splash del Portal de Acceso (340×300px) con anillo de progreso centrado, badge CFO interno, burbuja de porcentaje flotante y 4 segmentos de etapa etiquetados.

**Architecture:** Un único archivo `portal-launcher/launcher_ui.py` es modificado. Se ajustan las constantes de dimensión, se reemplaza `_draw_bar()` por `_draw_segments()`, se amplía el canvas del spinner para el anillo más grande (r=42), y se agrega el badge CFO y la burbuja de porcentaje con `.place()` sobre el canvas. No se introducen dependencias externas.

**Tech Stack:** Python 3.9+ · tkinter estándar · no requiere librerías adicionales

## Global Constraints

- Tipografía exclusiva: `'Segoe UI'` en todos los labels
- Sin gradientes decorativos — arco sólido `#4FD1B2`
- Paleta exacta del DS: `#0B1526` header · `#0D1B2A` body · `#00A878` logo · `#4FD1B2` acento · `#566C87` muted · `#162235` track · `#1C2E48` borde
- Logo badge: 32×32px, r-8px (tkinter: `highlightbackground` trick no existe — usar canvas oval + frame)
- Ventana sin decoración nativa: `overrideredirect(True)` se mantiene
- DPI awareness: bloque `windll.shcore.SetProcessDpiAwareness(2)` no se toca
- Lógica de arranque (`_startup_sequence`, `_ping`, `_kill_port`, `_run_proc`) no se modifica

---

### Task 1: Constantes, ventana y header actualizados

**Files:**
- Modify: `portal-launcher/launcher_ui.py` — constantes de clase + `_configure_root()` + `_build_header()`

**Interfaces:**
- Produces: `LauncherUI.W=340`, `LauncherUI.H=300`, `LauncherUI.SPIN_R=42`, `LauncherUI.BAR_W=280`, header con logo 32×32 y ✕ en x=312

- [ ] **Step 1: Actualizar constantes de clase**

En `launcher_ui.py`, dentro de `class LauncherUI:`, reemplazar el bloque de constantes:

```python
W, H    = 340, 300     # antes: 300, 248
HDR_H   = 46
SPIN_R  = 42           # antes: 28
SPIN_MS = 25
SPIN_STEP = 9
BAR_W   = 280          # antes: 230 — ahora es el ancho de los segmentos
BAR_H   = 4            # alto de cada segmento
BAR_R   = 3            # radio de esquinas de segmentos
```

- [ ] **Step 2: Actualizar `_configure_root()`**

El método ya usa `self.W` y `self.H` — no requiere cambio de código, solo verificar que usa las constantes (no valores hardcodeados). Confirmar que la línea `r.geometry(...)` usa `self.W` y `self.H`.

- [ ] **Step 3: Actualizar `_build_header()` — logo 32×32 y botón ✕ reposicionado**

Reemplazar el método completo:

```python
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
```

- [ ] **Step 4: Verificar manualmente que la ventana abre con el tamaño correcto**

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso\portal-launcher"
python launcher_ui.py
```

Verificar: ventana 340×300px, header con logo 32×32, botón ✕ en el extremo derecho. Cerrar con ✕.

- [ ] **Step 5: Commit**

```bash
git add portal-launcher/launcher_ui.py
git commit -m "feat(splash): ventana 340x300, logo 32x32, header DS actualizado"
```

---

### Task 2: Anillo de progreso + badge CFO + burbuja de porcentaje

**Files:**
- Modify: `portal-launcher/launcher_ui.py` — `_build_body()`, `_spin()`, `_stop_spinner()`, `_show_error()`

**Interfaces:**
- Consumes: `self.SPIN_R=42`, `self.W=340`, constantes de color del DS
- Produces: `self._canvas` (112×112px), `self._pct_bubble` (tk.Label con `.place()`), badge CFO centrado en canvas; `_spin()` dibuja arco r=42

- [ ] **Step 1: Reescribir `_build_body()` con ring layout**

Reemplazar el método completo:

```python
def _build_body(self, parent):
    body = tk.Frame(parent, bg=C_BODY)
    body.pack(fill='both', expand=True)

    # ── Canvas del anillo (spinner) ───────────────────────────────────────
    # Tamaño: (SPIN_R + 14) * 2 = 112px
    size = (self.SPIN_R + 14) * 2
    ring_wrap = tk.Frame(body, bg=C_BODY)
    ring_wrap.pack(pady=(22, 0))

    self._canvas = tk.Canvas(ring_wrap, width=size, height=size,
                             bg=C_BODY, highlightthickness=0)
    self._canvas.pack()

    # Badge CFO centrado sobre el canvas (posicionado con place relativo al ring_wrap)
    badge_size = 44
    badge_offset = (size - badge_size) // 2
    self._badge = tk.Frame(ring_wrap, bg=C_GREEN_LOG,
                           width=badge_size, height=badge_size)
    self._badge.place(x=badge_offset, y=badge_offset)
    self._badge.pack_propagate(False)
    tk.Label(self._badge, text='CFO', bg=C_GREEN_LOG, fg=C_WHITE,
             font=('Segoe UI', 11, 'bold')).place(relx=.5, rely=.5, anchor='center')

    # Burbuja de porcentaje — esquina top-right del canvas
    self._pct_var = tk.StringVar(value='0%')
    self._pct_bubble = tk.Label(
        ring_wrap,
        textvariable=self._pct_var,
        bg=C_TRACK, fg=C_ACCENT,
        font=('Segoe UI', 9, 'bold'),
        padx=6, pady=2,
        relief='flat',
    )
    # Posicionada a la derecha del canvas, un poco por encima del centro
    self._pct_bubble.place(x=size - 2, y=4)

    # ── Título principal ──────────────────────────────────────────────────
    tk.Label(body, text='Iniciando plataforma',
             bg=C_BODY, fg=C_WHITE,
             font=('Segoe UI', 14, 'bold')
             ).pack(pady=(14, 0))

    # ── Texto de paso ─────────────────────────────────────────────────────
    self.step_var = tk.StringVar(value='')
    self.step_lbl = tk.Label(body, textvariable=self.step_var,
                             bg=C_BODY, fg=C_MUTED,
                             font=('Segoe UI', 9),
                             wraplength=300, justify='center')
    self.step_lbl.pack(pady=(3, 0))

    # ── Segmentos de etapa ────────────────────────────────────────────────
    seg_frame = tk.Frame(body, bg=C_BODY)
    seg_frame.pack(pady=(18, 0))

    self._seg_canvas = tk.Canvas(
        seg_frame,
        width=self.BAR_W, height=self.BAR_H,
        bg=C_BODY, highlightthickness=0,
    )
    self._seg_canvas.pack()

    # Labels de etapas
    lbl_frame = tk.Frame(seg_frame, bg=C_BODY)
    lbl_frame.pack(fill='x', pady=(4, 0))
    seg_w = (self.BAR_W - 18) // 4  # 18px = 3 gaps de 6px
    for name in ('Puertos', 'Caché', 'Gateway', 'Portal'):
        tk.Label(lbl_frame, text=name, bg=C_BODY, fg=C_MUTED,
                 font=('Segoe UI', 8), width=seg_w // 7
                 ).pack(side='left', expand=True)

    # Dibuja segmentos iniciales (todos pendientes)
    self._draw_segments(0)

    # Inicia animación del spinner
    self._spin()
```

- [ ] **Step 2: Actualizar `_spin()` para el nuevo radio (r=42)**

El método `_spin()` usa `self.SPIN_R` y calcula `m = r + 14` (margen). Reemplazar el método:

```python
def _spin(self):
    if not self._alive or self._error:
        return
    c  = self._canvas
    r  = self.SPIN_R
    m  = r + 14         # margen hasta el borde del canvas
    x0, y0 = m - r, m - r
    x1, y1 = m + r, m + r

    c.delete('all')

    # Track (arco base, oscuro)
    c.create_arc(x0, y0, x1, y1,
                 start=0, extent=359,
                 outline=C_TRACK, width=5, style='arc')

    # Arco animado — 270° de apertura, color acento
    c.create_arc(x0, y0, x1, y1,
                 start=self._angle, extent=270,
                 outline=C_ACCENT, width=5, style='arc')

    self._angle = (self._angle - self.SPIN_STEP) % 360
    self._spin_job = self.root.after(self.SPIN_MS, self._spin)
```

- [ ] **Step 3: Actualizar `_stop_spinner()`**

```python
def _stop_spinner(self):
    if self._spin_job:
        self.root.after_cancel(self._spin_job)
        self._spin_job = None
    self._canvas.delete('all')
```

Sin cambios respecto al actual — solo verificar que sigue usando `self._canvas`.

- [ ] **Step 4: Actualizar `_show_error()` para el nuevo canvas size**

Reemplazar el método:

```python
def _show_error(self, msg: str):
    def _draw():
        self._error = True
        self._stop_spinner()

        c = self._canvas
        r = self.SPIN_R
        m = r + 14
        # Círculo rojo
        c.create_oval(m - r, m - r, m + r, m + r,
                      outline=C_ERROR, width=3)
        # X roja
        d = r * 0.5
        c.create_line(m - d, m - d, m + d, m + d, fill=C_ERROR, width=2)
        c.create_line(m + d, m - d, m - d, m + d, fill=C_ERROR, width=2)

        self.step_var.set(msg)
        self.step_lbl.config(fg=C_ERROR)

        close_lnk = tk.Label(self.root, text='Cerrar',
                              bg=C_BODY, fg=C_MUTED,
                              font=('Segoe UI', 8, 'underline'),
                              cursor='hand2')
        close_lnk.pack(pady=(8, 0))
        close_lnk.bind('<Button-1>', lambda _: self._on_close())

    self.root.after(0, _draw)
```

- [ ] **Step 5: Verificar visualmente el anillo**

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso\portal-launcher"
python launcher_ui.py
```

Verificar: anillo giratorio con arco `#4FD1B2`, badge CFO verde centrado, burbuja "0%" top-right.

- [ ] **Step 6: Commit**

```bash
git add portal-launcher/launcher_ui.py
git commit -m "feat(splash): anillo r=42 + badge CFO + burbuja porcentaje"
```

---

### Task 3: Segmentos de etapa + `_set_progress()` actualizado

**Files:**
- Modify: `portal-launcher/launcher_ui.py` — `_draw_bar()` → `_draw_segments()`, `_set_progress()`

**Interfaces:**
- Consumes: `self._seg_canvas` (280×4px), `self.BAR_W=280`, `self.BAR_H=4`, `self.BAR_R=3`, `self._pct_var`, `self._pct_bubble`
- Produces: `_draw_segments(pct)` — colorea 4 segmentos; `_set_progress(pct)` — llama a `_draw_segments` y actualiza burbuja

- [ ] **Step 1: Reemplazar `_draw_bar()` por `_draw_segments()`**

Eliminar el método `_draw_bar()` completo y agregar:

```python
# Umbrales por segmento: [Puertos, Caché, Gateway, Portal]
_SEG_THRESHOLDS = (25, 50, 75, 100)

def _draw_segments(self, pct: int):
    """Redibuja los 4 segmentos de etapa según el porcentaje (0-100)."""
    c   = self._seg_canvas
    w   = self.BAR_W
    h   = self.BAR_H
    r   = self.BAR_R
    gap = 6
    seg_w = (w - gap * 3) // 4   # ancho de cada segmento

    c.delete('all')

    for i, threshold in enumerate(self._SEG_THRESHOLDS):
        x1 = i * (seg_w + gap)
        x2 = x1 + seg_w

        if pct >= threshold:
            color = C_GREEN_LOG   # completado: #00A878
        elif i > 0 and pct >= self._SEG_THRESHOLDS[i - 1]:
            color = C_ACCENT      # activo: #4FD1B2
        elif i == 0 and pct > 0:
            color = C_ACCENT      # primer segmento activo desde pct > 0
        else:
            color = C_TRACK       # pendiente: #162235

        self._rounded_rect(c, x1, 0, x2, h, r, fill=color, outline='')
```

- [ ] **Step 2: Actualizar `_set_progress()`**

Reemplazar el método:

```python
def _set_progress(self, pct: int):
    """Actualiza segmentos y burbuja de porcentaje. Thread-safe."""
    self._pct = pct
    def _update():
        self._draw_segments(pct)
        self._pct_var.set(f'{pct}%')
    self.root.after(0, _update)
```

- [ ] **Step 3: Eliminar `_rounded_rect` duplicado si existe**

El método `_rounded_rect(self, canvas, x1, y1, x2, y2, radius, **kw)` ya existe en el archivo desde la implementación de la barra anterior — mantenerlo sin cambios. Verificar que no haya duplicado.

- [ ] **Step 4: Verificar segmentos en tiempo real**

Insertar temporalmente delays en `_startup_sequence` para observar cada estado:

```powershell
cd "C:\Esteban CFOTech\Portal de Acceso\portal-launcher"
python launcher_ui.py
```

Observar durante el arranque:
- pct=10: segmento 0 (Puertos) en `#4FD1B2` activo, resto `#162235`
- pct=25: segmento 0 verde `#00A878`, segmento 1 activo teal
- pct=50: segmentos 0+1 verdes, segmento 2 activo
- pct=75: segmentos 0+1+2 verdes, segmento 3 activo
- pct=100: todos verdes, ventana se cierra automáticamente

- [ ] **Step 5: Commit final**

```bash
git add portal-launcher/launcher_ui.py
git commit -m "feat(splash): segmentos de etapa etiquetados + set_progress actualizado"
```

---

## Self-Review

**Spec coverage:**
- ✅ 340×300px — Task 1 constantes
- ✅ Header logo 32×32, close reposicionado — Task 1 Step 3
- ✅ Anillo r=42, arco `#4FD1B2` sólido — Task 2 Step 2
- ✅ Badge CFO 44×44 centrado — Task 2 Step 1
- ✅ Burbuja porcentaje top-right — Task 2 Step 1
- ✅ 4 segmentos etiquetados con umbrales 25/50/75/100 — Task 3
- ✅ Error state: círculo rojo + X, `m = r + 14` correcto — Task 2 Step 4
- ✅ Lógica de arranque sin cambios — no hay tarea que la toque
- ✅ Sin gradientes decorativos — arco y segmentos usan colores sólidos del DS
- ✅ Tipografía Segoe UI en todos los labels — verificado en cada Label del plan

**Placeholder scan:** Ninguno encontrado. Todos los pasos tienen código completo.

**Type consistency:** `_draw_segments(pct: int)` llamado desde `_set_progress(pct: int)` ✅. `_rounded_rect` con misma firma en ambos usos ✅. `self._seg_canvas` creado en `_build_body()` y consumido en `_draw_segments()` ✅.
