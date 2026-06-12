# CFOTech IT Tools — Design System · Portal de Acceso

> Derivado de `CFOTech IT Tools — Design System` (fuente canónica: `C:\Esteban CFOTech\Bandas Salariales\DESIGN_SYSTEM.md`).  
> Este archivo extiende ese sistema con los tokens y componentes específicos del Portal: sidebar, app-cards, toolbar de visor, estados de iframe.  
> **Regla:** ante conflicto con la fuente canónica, la fuente canónica gana.

---

## Identidad

**Producto:** CFOTech IT Tools — Portal de Acceso  
**Tipografía:** `'Segoe UI', system-ui, sans-serif`  
**Tono visual:** Corporativo, limpio, profesional. Sin gradientes, sin sombras pesadas.

---

## Paleta de colores (heredada del DS canónico)

```css
:root {
  /* Marca */
  --navy-dark:   #0B1526;   /* Header — fondo */
  --navy:        #0A1F44;   /* Botón principal, títulos, active state */
  --navy2:       #0D2B5E;   /* Hover de navy */
  --blue:        #4472C4;   /* Acciones secundarias, links */
  --green:       #00875A;   /* Éxito, badges activos */
  --green-l:     #E3F5EE;   /* Fondo badge verde */
  --green-a:     #4FD1B2;   /* Acento header + dot online */
  --logo-green:  #00A878;   /* Fondo logo CFO — uso exclusivo del logo */

  /* Semánticos */
  --red:    #C0392B;
  --orange: #C96A00;

  /* Grises */
  --gray1:  #F4F6F9;   /* Fondo general */
  --gray2:  #E8ECF2;   /* Bordes suaves, dividers */
  --gray3:  #C5CDD8;   /* Texto deshabilitado */

  /* Texto */
  --text:   #0D1B2A;   /* Principal */
  --text2:  #4A5568;   /* Secundario, labels */

  /* Borde */
  --border: #D1D9E6;
}
```

---

## Layout del Portal

El portal tiene **2 zonas** (sin sidebar — la navegación está en el header como pills).

```
┌──────────────────────────────────────────────────────────────┐  ← .portal-root (100vh, flex-col)
│  HEADER  48px                                                  │  ← flex-shrink: 0
│  [CFO | CFOTech / IT Tools] | [pill1] [pill2] ... [Salir]     │
├──────────────────────────────────────────────────────────────┤
│  PORTAL-BODY  (flex: 1, overflow: hidden, position: relative) │
│                                                               │
│  activeApp === null  → Dashboard (height:100%, overflow-y:auto) │
│  activeApp !== null  → AppFrame (position:absolute, inset:0)  │
└──────────────────────────────────────────────────────────────┘
```

```css
html, body, #root { height: 100%; margin: 0; overflow: hidden; }

.portal-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: var(--font);
  background: var(--navy-dark);  /* fondo visible detrás del header */
}

.portal-body {
  flex: 1;
  overflow: hidden;
  background: var(--gray1);
  position: relative;            /* necesario para AppFrame absolute */
}
```

---

## Header (heredado del DS canónico — sin cambios)

Altura fija **48px**. `flex-shrink: 0` en el layout flex.

```css
.header {
  background: var(--navy-dark);   /* #0B1526 */
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  border-bottom: 3px solid #1C2E48;
  flex-shrink: 0;
  /* Sin box-shadow — flat design */
}
```

### Logo
```css
.logo {
  width: 32px; height: 32px;
  background: var(--logo-green);   /* #00A878 — USO EXCLUSIVO del logo */
  border-radius: 8px;
  display: flex; justify-content: center; align-items: center;
  flex-shrink: 0; margin-right: 12px;
}
.logo-text { color: white; font-size: 11px; font-weight: 700; letter-spacing: -.3px; }
```

### Marca (2 líneas)
```css
.header-brand-main { font-size: 13px; font-weight: 700; color: #fff; }
.header-brand-sub  { font-size: 11px; font-weight: 700; color: var(--green-a); }
```

### Nav pills (novedad v0.2 — reemplaza al sidebar)

```css
--nav-active: #1B3F8A;   /* nuevo token — pill activa */

.header-nav {
  display: flex; gap: 4px;
  flex: 1; overflow-x: auto;
  scrollbar-width: none;
}

.nav-pill {
  height: 32px; padding: 0 14px;
  border-radius: 20px; border: none;
  font-size: 13px; font-weight: 500;
  cursor: pointer; white-space: nowrap;
  color: rgba(255,255,255,.52);
  background: rgba(255,255,255,.07);
  transition: background .15s, color .15s;
}
.nav-pill:hover:not(.active):not(.disabled) {
  background: rgba(255,255,255,.12);
  color: rgba(255,255,255,.82);
}
.nav-pill.active {
  background: var(--nav-active);   /* #1B3F8A */
  color: #fff; font-weight: 600;
  box-shadow: 0 0 0 1px rgba(255,255,255,.15) inset;
}
.nav-pill.disabled { opacity: .42; cursor: not-allowed; }

/* Badge "Próximo" sobre la pill */
.nav-pill-badge {
  position: absolute; top: -5px; right: -2px;
  font-size: 9px; font-weight: 700;
  background: var(--orange); color: #fff;
  padding: 1px 5px; border-radius: 10px;
  text-transform: uppercase;
}
```

### Botón Salir
```css
.btn-exit {
  height: 30px; padding: 0 14px;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,.22);
  background: transparent;
  color: rgba(255,255,255,.62);
  font-size: 12px; font-weight: 500;
  cursor: pointer;
  transition: background .15s, color .15s;
}
.btn-exit:hover { background: rgba(255,255,255,.08); color: #fff; }
```

---

## ~~Sidebar de navegación~~ (reemplazado por nav pills en header)

> El sidebar fue eliminado en v0.2. La navegación se realiza mediante las nav pills en el header.
> Si en el futuro se necesita un sidebar (por cantidad de apps), restaurar `.nav-item` del DS canónico.

---

## App Cards (dashboard)

```css
.app-card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(10,31,68,.05);
  display: flex; flex-direction: column;
  transition: box-shadow .2s;
}
.app-card:hover { box-shadow: 0 4px 12px rgba(10,31,68,.10); }

.app-card-header {
  padding: 16px; display: flex; align-items: flex-start; gap: 12px;
}
.app-icon-box {
  width: 44px; height: 44px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0;
}
.app-card-name { font-size: 14px; font-weight: 700; color: var(--navy); }
.app-card-desc { font-size: 12px; color: var(--text2); margin-top: 3px; line-height: 1.4; }

.app-card-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--gray2);
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
.app-card-tags { display: flex; gap: 6px; flex-wrap: wrap; }
```

### App grid
```css
.app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
```

---

## ~~Toolbar del visor de app~~ (eliminada en v0.2)

> La toolbar "← Dashboard" fue eliminada. La navegación de regreso se hace clickeando el logo.
> Si se necesita en el futuro: 40px blanco con `border-bottom: 1px solid var(--border)`.

---

## Estados del iframe

```css
/* Overlay de carga — cubre el iframe mientras carga */
.frame-loading {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  height: 100%; gap: 12px;
  background: var(--gray1);
}
.frame-loading-text { font-size: 13px; color: var(--text2); }

/* Cuando el iframe no puede cargarse (X-Frame-Options, etc.) */
/* Usar .err-bar del DS base + link "Abrir en nueva pestaña" */
```

---

## Welcome Banner (dashboard home)

```css
.welcome-banner {
  background: var(--navy);
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.welcome-title { font-size: 18px; font-weight: 700; color: white; }
.welcome-sub   { font-size: 12px; color: rgba(255,255,255,.65); margin-top: 4px; }
```

---

## Cards, formularios, botones, badges, KPI boxes, spinner, error bar

> Idénticos al DS canónico. No se replican aquí para evitar divergencia.  
> Ver: `C:\Esteban CFOTech\Bandas Salariales\DESIGN_SYSTEM.md`

---

## Badges de estado de app

| Estado       | Clase CSS       | Texto          |
|-------------|-----------------|----------------|
| `active`    | `.badge-green`  | Activa         |
| `maintenance` | `.badge-orange` | Mantenimiento |
| `coming-soon` | `.badge-gray`  | Próximamente  |

---

## Layout screen (dashboard)

```css
.screen {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 20px;
}

/* Wrapper de scroll del dashboard */
.dashboard-scroll {
  height: 100%;
  overflow-y: auto;
}
```

---

## Checklist antes de entregar una pantalla del portal

- [ ] Header 48px: logo 32×32 `#00A878` r-8px · "CFOTech" blanco 13px / "IT Tools" `#4FD1B2` 11px (2 líneas)
- [ ] `border-bottom: 3px solid #1C2E48` en header — sin box-shadow
- [ ] Nav pills: inactiva `rgba(255,255,255,.07)` / activa `#1B3F8A`
- [ ] Pills `coming-soon` / `maintenance` con clase `.disabled` + badge opcional
- [ ] Fondo general `#F4F6F9`
- [ ] Cards con `border-radius: 12px` y sombra suave
- [ ] App icon box `border-radius: 10px`
- [ ] Tipografía system-ui / Segoe UI
- [ ] Botón principal en `--navy`
- [ ] Sin gradientes · Sin sombras pesadas
- [ ] AppFrame: `position: absolute; inset: 0` — sin borde
- [ ] Iframe sin borde, `width: 100%`, `flex: 1`
- [ ] `.portal-body` con `position: relative` y `overflow: hidden`
