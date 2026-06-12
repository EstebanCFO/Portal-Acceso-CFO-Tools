# CFOTech IT Tools — Design System

Fuente de verdad de diseño para todas las apps de CFOTech.
Leer este archivo antes de crear cualquier componente, pantalla o artefacto visual.

---

## Identidad

**Nombre del producto:** CFOTech IT Tools  
**Tipografía:** `'Segoe UI', system-ui, sans-serif`  
**Tono visual:** Corporativo, limpio, profesional. Sin gradientes decorativos, sin sombras pesadas.

---

## Paleta de colores

```css
:root {
  /* Marca */
  --navy-dark: #0B1526;   /* Fondo header — más oscuro, máximo contraste */
  --navy:      #0A1F44;   /* Botón principal, títulos, acciones primarias */
  --navy2:     #0D2B5E;   /* Hover de navy */
  --blue:      #4472C4;   /* Acciones secundarias, links */
  --green:     #00875A;   /* Éxito, badges positivos */
  --green-l:   #E3F5EE;   /* Fondo de badges verdes */
  --green-a:   #4FD1B2;   /* Acento en header: "CFOTech" y "IT Tools" */
  --logo-green: #00A878;  /* Fondo del logo CFO — uso exclusivo del logo */

  /* Semánticos */
  --red:     #C0392B;     /* Error, alerta crítica */
  --orange:  #C96A00;     /* Advertencia */

  /* Grises */
  --gray1:   #F4F6F9;     /* Fondo general, inputs, KPI boxes */
  --gray2:   #E8ECF2;     /* Bordes suaves, barras de progreso vacías */
  --gray3:   #C5CDD8;     /* Texto deshabilitado */

  /* Texto */
  --text:    #0D1B2A;     /* Texto principal */
  --text2:   #4A5568;     /* Texto secundario, labels, subtítulos */

  /* Borde */
  --border:  #D1D9E6;     /* Bordes de cards, inputs, separadores */
}
```

### Semáforo de valoraciones (escala 1–5)

| Valor | Color fill | Color texto | Uso |
|-------|-----------|-------------|-----|
| ≥ 4.0 | `#00875A` (green) | `#085041` | Óptimo |
| 3.0 – 3.9 | `#C96A00` (orange) | `#7D4700` | Atención |
| < 3.0 | `#C0392B` (red) | `#7A1C10` | Crítico |
| Sin datos | `#C5CDD8` (gray3) | `#4A5568` | N/D |

---

## Header

Presente en todas las apps. Altura fija **48px**. Siempre sticky top. Sin sombra — separador inferior oscuro en su lugar.

```css
.header {
  background: #0B1526;          /* --navy-dark */
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  border-bottom: 3px solid #1C2E48;
  /* Sin box-shadow — flat design */
}
```

### Logo

Sólido, sin gradiente.

```css
.logo {
  width: 32px;
  height: 32px;
  background: #00A878;          /* --logo-green — uso exclusivo del logo */
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  margin-right: 12px;
}
.logo-text {
  color: white;
  font-family: "Segoe UI", sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: -0.3px;
}
```

### Título de marca + nombre de la app

El nombre de la app va **inline** al título de marca, separado por un pipe `|` en color tenue.

```css
.hdr-brand      { display: flex; align-items: center; white-space: nowrap; }
.hdr-cfotech    { font-size: 15px; font-weight: 700; color: white; }
.hdr-it-tools   { font-size: 15px; font-weight: 700; color: #4FD1B2; margin-left: 4px; }
.hdr-separator  { font-size: 13px; color: rgba(255,255,255,.25); margin: 0 10px; }
.hdr-app-name   { font-size: 13px; color: rgba(255,255,255,.55); font-weight: 400; }
```

```html
<div class="hdr-brand">
  <span class="hdr-cfotech">CFOTech</span>
  <span class="hdr-it-tools">IT Tools</span>
  <span class="hdr-separator">|</span>
  <span class="hdr-app-name">[Nombre de la App]</span>
</div>
```

### Zona derecha del header

Contiene el indicador de backend y el botón Salir.

```html
<!-- Indicador dinámico de conexión al backend -->
<div class="hdr-status">
  <div class="hdr-dot online"></div>   <!-- o class="offline" / "checking" -->
  <span class="hdr-status-text">Backend activo</span>
</div>

<!-- Botón Salir — pill redondeado -->
<button class="btn-salir">Salir</button>
```

```css
.hdr-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
}
.hdr-dot.online   { background: #4FD1B2; box-shadow: 0 0 6px #4FD1B2; }
.hdr-dot.offline  { background: #C0392B; }
.hdr-dot.checking { background: #C5CDD8; }

.hdr-status-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.60);
  white-space: nowrap;
}

/* Pill redondeado — más amigable que el borde recto */
.btn-salir {
  font-size: 12px; color: white; font-weight: 500;
  border: 1px solid rgba(255,255,255,.30);
  border-radius: 20px;
  padding: 4px 14px;
  background: transparent; cursor: pointer;
  font-family: inherit;
  transition: border-color .15s, background .15s;
}
.btn-salir:hover {
  border-color: rgba(255,255,255,.70);
  background: rgba(255,255,255,.06);
}
```

### CSS completo de referencia

```css
.header {
  background: #0B1526;
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  border-bottom: 3px solid #1C2E48;
}
.logo {
  width: 32px; height: 32px;
  background: #00A878;
  border-radius: 8px;
  display: flex; justify-content: center; align-items: center;
  flex-shrink: 0; margin-right: 12px;
}
.logo-text { color: white; font-size: 11px; font-weight: 700; letter-spacing: -.3px; }
.hdr-brand { display: flex; align-items: center; white-space: nowrap; }
.hdr-cfotech  { font-size: 15px; font-weight: 700; color: white; }
.hdr-it-tools { font-size: 15px; font-weight: 700; color: #4FD1B2; margin-left: 4px; }
.hdr-separator { font-size: 13px; color: rgba(255,255,255,.25); margin: 0 10px; }
.hdr-app-name  { font-size: 13px; color: rgba(255,255,255,.55); }
```

---

## Cards

Contenedor base para cualquier sección de contenido.

```css
.card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 14px;
  box-shadow: 0 1px 4px rgba(10,31,68,.05);
}
.card-head {
  padding: 13px 18px 11px;
  border-bottom: 1px solid var(--gray2);
}
.card-body { padding: 16px 18px; }
.ch-t { font-size: 13px; font-weight: 700; color: var(--navy); }
.ch-s { font-size: 11px; color: var(--text2); margin-top: 2px; }
```

---

## Formularios

```css
.field { display: flex; flex-direction: column; gap: 5px; }

.field label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: .5px;
}

.field select,
.field input {
  font-family: inherit;
  font-size: 13px;
  color: var(--text);
  background: var(--gray1);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 8px 11px;
  outline: none;
  width: 100%;
}

.field select:focus,
.field input:focus {
  border-color: var(--navy);
  background: white;
}
```

### Grilla de campos recomendada

```css
/* 4 columnas: año estrecho + 3 iguales */
.form-grid {
  display: grid;
  grid-template-columns: 100px 1fr 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
```

---

## Botones

```css
/* Principal — navy sólido */
.btn-navy {
  background: var(--navy); color: white;
  border: none; border-radius: 8px;
  padding: 11px 20px;
  font-family: inherit; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: opacity .2s;
}
.btn-navy:hover { opacity: .88; }

/* Secundario — azul */
.btn-blue {
  background: var(--blue); color: white;
  border: none; border-radius: 8px;
  padding: 10px 20px;
  font-family: inherit; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: opacity .2s;
}
.btn-blue:hover { opacity: .9; }

/* Verde — acción positiva */
.btn-green {
  background: var(--green); color: white;
  border: none; border-radius: 8px;
  padding: 10px 20px;
  font-family: inherit; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: opacity .2s;
}

/* Ghost — acción secundaria */
.btn-ghost {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px; padding: 9px 16px;
  font-family: inherit; font-size: 12px; font-weight: 500;
  color: var(--text2); cursor: pointer;
}
.btn-ghost:hover { border-color: var(--navy); color: var(--navy); }

/* Tamaño pequeño (modificador) */
.btn-sm { padding: 5px 12px; font-size: 11px; border-radius: 6px; }
```

---

## Badges / Pills

```css
.badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 600;
}
.badge-green  { background: var(--green-l); color: #085041; }
.badge-blue   { background: #EEF4FF;        color: #0C447C; }
.badge-orange { background: #FFF3E0;        color: var(--orange); }
.badge-red    { background: #FDECEA;        color: var(--red); }
.badge-gray   { background: var(--gray2);   color: var(--text2); }
```

---

## KPI Boxes

```css
.kpi-box {
  background: var(--gray1);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}
.kpi-n { font-size: 22px; font-weight: 700; color: var(--navy); }
.kpi-l {
  font-size: 10px; color: var(--text2);
  margin-top: 2px;
  text-transform: uppercase; letter-spacing: .4px;
}

/* Grid sugerido */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}
```

---

## Barras de progreso / score

```css
.bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
.bar-lbl  { font-size: 12px; color: var(--text2); min-width: 90px; }
.bar-track { flex: 1; height: 5px; background: var(--gray2); border-radius: 3px; overflow: hidden; }
.bar-fill  { height: 100%; border-radius: 3px; transition: width .5s ease; }
.bar-val   { font-size: 12px; font-weight: 700; min-width: 36px; text-align: right; }
```

---

## Step bar (progreso de pasos)

```css
.step-bar {
  background: white; border: 1px solid var(--border);
  border-radius: 12px; padding: 14px 20px;
  margin-bottom: 14px;
  display: flex; align-items: center;
}
.sd { width: 28px; height: 28px; border-radius: 50%; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.sd.done  { background: var(--green); color: white; }
.sd.act   { background: var(--navy);  color: white; }
.sd.pend  { background: var(--gray2); color: var(--text2); }
.sl { flex: 1; height: 2px; margin: 0 8px; border-radius: 2px; }
.sl.done  { background: var(--green); }
.sl.pend  { background: var(--gray2); }
.sd-lbl   { font-size: 11px; font-weight: 500; white-space: nowrap; }
.sd-lbl.pend { color: #a0aec0; }
.sd-lbl.act  { color: var(--navy); font-weight: 600; }
.sd-lbl.done { color: var(--green); }
```

---

## Loading / Spinner

```css
.spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--gray2);
  border-top-color: var(--navy);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.prog-step {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 6px;
  font-size: 12px; color: var(--text2);
  background: var(--gray1); margin-bottom: 4px;
}
.prog-step.run  { background: #EEF2F8; color: var(--navy); font-weight: 600; }
.prog-step.done { background: var(--green-l); color: var(--green); font-weight: 600; }
```

---

## Error bar

```css
.err-bar {
  padding: 10px 14px;
  background: #FDECEA;
  border-left: 4px solid var(--red);
  border-radius: 0 8px 8px 0;
  font-size: 12px; color: var(--red);
  display: flex; align-items: center; gap: 8px;
}
```

---

## Layout general

```css
body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: var(--gray1);
  color: var(--text);
  font-size: 14px;
}

.screen {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 20px;
}
```

---

## Template HTML base

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CFOTech IT Tools — [NOMBRE APP]</title>
  <style>
    /* Pegar aquí todas las variables y clases de este Design System */
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div class="logo"><span class="logo-text">CFO</span></div>
    <div class="hdr-brand">
      <span class="hdr-cfotech">CFOTech</span>
      <span class="hdr-it-tools">IT Tools</span>
      <span class="hdr-separator">|</span>
      <span class="hdr-app-name">[NOMBRE APP]</span>
    </div>
    <div style="flex:1"></div>
    <div style="display:flex;align-items:center;gap:6px;margin-right:16px">
      <div class="hdr-dot online"></div>
      <span class="hdr-status-text">Backend activo</span>
    </div>
    <button class="btn-salir">Salir</button>
  </div>

  <!-- CONTENIDO -->
  <div class="screen">
    <!-- tus cards y contenido aquí -->
  </div>

</body>
</html>
```

---

## Adaptación React + MUI

Cuando el proyecto usa MUI, mapear los tokens del Design System al theme así:

```js
// src/theme.js
import { createTheme } from '@mui/material/styles'

const DS = {
  navyDark: '#0B1526',   // fondo del header
  navy:     '#0A1F44',   // botón principal, títulos
  navy2:    '#0D2B5E',   // hover de navy
  blue:     '#4472C4',
  green:    '#00875A',
  greenL:   '#E3F5EE',
  greenA:   '#4FD1B2',   // acento header
  logoGreen:'#00A878',   // logo CFO exclusivo
  red:      '#C0392B',
  orange:   '#C96A00',
  gray1:    '#F4F6F9',
  gray2:    '#E8ECF2',
  gray3:    '#C5CDD8',
  text:     '#0D1B2A',
  text2:    '#4A5568',
  border:   '#D1D9E6',
}

const theme = createTheme({
  palette: {
    primary:    { main: DS.navy,   dark: DS.navy2, contrastText: '#fff' },
    secondary:  { main: DS.blue,   contrastText: '#fff' },
    success:    { main: DS.green,  light: DS.greenL },
    warning:    { main: DS.orange },
    error:      { main: DS.red },
    background: { default: DS.gray1, paper: '#ffffff' },
    text:       { primary: DS.text, secondary: DS.text2, disabled: DS.gray3 },
    divider:    DS.border,
  },
  typography: {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    fontSize: 13,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: `1px solid ${DS.border}`,
          boxShadow: '0 1px 4px rgba(10,31,68,.05)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: { fontSize: 13 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: DS.navyDark,             // header oscuro DS
          boxShadow: 'none',
          borderBottom: '3px solid #1C2E48',   // separador oscuro
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600, fontSize: 11 } },
    },
  },
})

export default theme
```

### Semáforo en React
```jsx
export function semaforo(valor) {
  if (valor == null) return { bg: '#E8ECF2', color: '#4A5568', label: 'N/D' }
  if (valor >= 4.0)  return { bg: '#00875A', color: '#085041', label: String(valor) }
  if (valor >= 3.0)  return { bg: '#FFF3E0', color: '#C96A00', label: String(valor) }
  return               { bg: '#FDECEA',  color: '#C0392B', label: String(valor) }
}
```

---

## Checklist antes de entregar una pantalla

- [ ] Header 48px: logo CFO 32×32px `#00A878` r-8px · "CFOTech" blanco 15px · "IT Tools" `#4FD1B2` 15px · nombre app inline con `|`
- [ ] Header `border-bottom: 3px solid #1C2E48` — sin box-shadow
- [ ] Header derecho: indicador backend (dot + texto) + botón Salir pill (`border-radius: 20px`)
- [ ] Fondo general `--gray1` (`#F4F6F9`)
- [ ] Cards con `border-radius: 12px` y sombra `0 1px 4px rgba(10,31,68,.05)` — sin hover shadow
- [ ] Tipografía `Segoe UI` o `system-ui`
- [ ] Labels de campos en UPPERCASE 10px `letter-spacing: .4px`
- [ ] Botón principal en `--navy` (`#0A1F44`)
- [ ] Semáforo verde/naranja/rojo para valores numéricos
- [ ] Sin gradientes en ningún elemento (logo incluido — usa sólido `#00A878`)
- [ ] Sin sombras pesadas (`box-shadow` solo suave en cards)
