# Spec: Rediseño ventana splash — Portal de Acceso CFOTech

**Fecha:** 2026-06-29  
**Archivo objetivo:** `portal-launcher/launcher_ui.py`  
**Estado:** Aprobado por usuario

---

## Contexto

La ventana splash actual (`LauncherUI`) tiene 300×248px, un spinner de arco suelto y una barra de progreso horizontal genérica. El rediseño mantiene el mismo comportamiento funcional pero eleva la identidad visual: anillo de progreso centrado con el logo CFO dentro, burbuja de porcentaje flotante y cuatro segmentos de etapa etiquetados.

---

## Tamaño de ventana

| | Actual | Nuevo |
|---|---|---|
| Ancho | 300px | 340px |
| Alto | 248px | 300px |

---

## Estructura visual

```
┌─────────────────────────────────────┐  ← borde 1px #1C2E48
│ [CFO] CFOTech  IT Tools        [✕] │  ← header 46px, bg #0B1526, border-bottom 3px #1C2E48
├─────────────────────────────────────┤
│                                     │
│          ┌──────────────┐           │
│          │  ╭────────╮  │           │
│          │  │  [CFO] │  │  [60%]    │  ← burbuja top-right del anillo
│          │  ╰────────╯  │           │
│          └──────────────┘           │
│                                     │
│       Iniciando plataforma          │  ← 14px bold #fff
│       Iniciando gateway…            │  ← 9px #566C87
│                                     │
│   ▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓  ░░░░░░  ░░░│  ← 4 segmentos 4px h
│   Puertos    Caché    Gateway  Portal│  ← labels 8px
│                                     │
└─────────────────────────────────────┘  bg #0D1B2A
```

---

## Tokens de DS aplicados

Todos los colores y tipografía respetan `DESIGN_SYSTEM.md`. Sin gradientes decorativos ni sombras pesadas.

| Elemento | Token / Valor |
|----------|--------------|
| Body fondo | `#0D1B2A` (`C_BODY` actual — sin cambio) |
| Header fondo | `#0B1526` (`--navy-dark`) |
| Header border-bottom | `3px solid #1C2E48` |
| Logo badge bg | `#00A878` (`--logo-green`) · 32×32px · r-8px |
| Logo texto | "CFO" blanco 11px bold |
| Acento / arco activo | `#4FD1B2` (`--green-a`) |
| Track del anillo | `#162235` (`C_TRACK`) |
| Título | `#FFFFFF` 14px bold Segoe UI |
| Step text | `#566C87` (`C_MUTED`) 9px Segoe UI |
| % burbuja texto | `#4FD1B2` 10px bold |
| % burbuja fondo | `#162235` · border `#1C2E48` |
| Segmento completado | `#00A878` |
| Segmento activo | `#4FD1B2` opacity 0.55 |
| Segmento pendiente | `#162235` |
| Error | `#FC8181` (`C_ERROR`) |
| Tipografía | `'Segoe UI'` en todos los labels |

---

## Componente: anillo de progreso

- **Canvas tkinter:** 112×112px (r=42px, margen 14px)
- **Arco track:** `#162235`, width=5, extent=359°
- **Arco activo:** `#4FD1B2`, width=5, `start=self._angle`, extent=270°, gira -9° por frame cada 25ms
- **Badge CFO interno:** `tk.Frame` 44×44px, `#00A878`, r-12px aproximado (tkinter no soporta border-radius nativo — usar canvas oval o frame cuadrado con esquinas via canvas)
- **Texto CFO:** `tk.Label` 11px bold blanco, centrado en el badge
- **Burbuja porcentaje:** `tk.Label` posicionada con `.place()` en esquina top-right del canvas, bg `#162235`, fg `#4FD1B2`, 10px bold, actualizada por `_set_progress()`

### Estado de error

- Detener animación del arco
- Dibujar círculo `outline=#FC8181` + líneas × en rojo (igual que hoy)
- Mantener badge CFO, no mostrarlo como ✕ (el badge es parte del branding)

---

## Componente: segmentos de etapa

Cuatro etapas fijas en orden:

| Índice | Label | Activa en `_set_progress()` |
|--------|-------|---------------------------|
| 0 | Puertos | pct ≥ 25 |
| 1 | Caché | pct ≥ 50 |
| 2 | Gateway | pct ≥ 75 |
| 3 | Portal | pct = 100 |

Implementación: `tk.Canvas` de 280×4px con 4 rectángulos redondeados separados por 6px de gap. Labels `tk.Label` de 8px debajo de cada segmento en un `tk.Frame` con pack horizontal.

Colores por estado:
- completado (`pct` supera umbral): `#00A878`
- activo (umbral actual): `#4FD1B2` con opacidad simulada mezclando hacia `#0D1B2A`
- pendiente: `#162235`

---

## Header

Sin cambios funcionales respecto al actual. Ajustes:

- Ancho de ventana pasa a 340px → reposicionar botón ✕ a `x = 340 - 28`
- Logo badge: 32×32px (era 28×28) para cumplir DS exacto
- Texto "CFOTech" 13px bold / "IT Tools" `#4FD1B2` 11px bold (idem DS)
- "Portal de Acceso" 7px `#566C87` (sin cambio)

---

## Cambios en constantes de clase

```python
W, H     = 340, 300     # antes: 300, 248
HDR_H    = 46           # sin cambio
SPIN_R   = 42           # antes: 28 (radio del arco)
SPIN_MS  = 25           # sin cambio
SPIN_STEP = 9           # sin cambio
BAR_W    = 280          # antes: 230 (segmentos)
# BAR_H  eliminado — segmentos son 4px fijos
# BAR_R  eliminado
```

---

## Secuencia de arranque — sin cambios

Los pasos, porcentajes y lógica de `_startup_sequence()` no cambian. Solo cambia la presentación visual de los mismos valores.

```python
_set_progress(10)  # → segmento 0 activo
_set_progress(25)  # → segmento 0 completo
_set_progress(50)  # → segmento 1 completo
_set_progress(75)  # → segmento 2 completo
_set_progress(100) # → segmento 3 completo
```

---

## Lo que NO cambia

- Lógica de `_startup_sequence()`, `_ping()`, `_kill_port()`, `_run_proc()`
- Comportamiento drag (arrastrar ventana)
- Botón ✕ cierra la ventana (servicios siguen en background)
- Estado de error: `_show_error()` funciona igual, muestra texto rojo
- `overrideredirect(True)` — ventana sin decoración nativa
- DPI awareness en Windows

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `portal-launcher/launcher_ui.py` | Único archivo — refactoring de `_build_body()`, `_draw_bar()` → `_draw_segments()`, ajuste de constantes W/H/SPIN_R/BAR_W |

No se agregan dependencias externas. Todo en tkinter estándar.
