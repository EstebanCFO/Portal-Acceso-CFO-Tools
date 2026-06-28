# 📊 Informe de Accesibilidad — Web Institucional SWF-CFO (Auditoría Completa)
**Fecha:** 2026-06-28 | **Versión:** v2 — cobertura total del sitio
**Auditor:** Agente CFOTech | **Metodología:** Análisis estático en memoria (sin descarga a disco)
**Normativas:** WCAG 2.2 (nivel AA) · ONTI Ley 26.653 / Disposición 6/2019

---

## 1. Recurso auditado

| Campo | Valor |
|-------|-------|
| Fuente | Azure DevOps — Organización: SWF-CFO |
| Repositorio | Web Institucional |
| Rama | master |
| Método | Análisis estático en memoria (sin descarga a disco) |
| Versión anterior | v1 — 4 páginas analizadas (2026-06-28) |

---

## 2. Inventario auditado

| # | Archivo | Tipo | Prioridad | Estado |
|---|---------|------|-----------|--------|
| 1 | `/modulo/header.html` | Módulo compartido | 🔴 Alta | ✅ Analizado |
| 2 | `/modulo/footer.html` | Módulo compartido | 🔴 Alta | ✅ Analizado |
| 3 | `/index.html` | Home | 🔴 Alta | ✅ Analizado |
| 4 | `/deja_tu_cv.html` | Página de reclutamiento | 🔴 Alta | ✅ Analizado |
| 5 | `/Innovation_hub.html` | Contenido (v1) | 🟠 Media | ✅ Analizado |
| 6 | `/busqueda_y_seleccion.html` | Contenido (v1) | 🟠 Media | ✅ Analizado |
| 7 | `/contacto.html` | Formulario (v1) | 🟠 Media | ✅ Analizado |
| 8 | `/aviso-legal.html` | Legal (v1) | 🟡 Baja | ✅ Analizado |
| 9 | `/delivery_center.html` | Contenido | 🟠 Media | ✅ Analizado |
| 10 | `/outsourcing.html` | Contenido | 🟠 Media | ✅ Analizado |
| 11 | `/historia.html` | Contenido | 🟠 Media | ✅ Analizado |
| 12 | `/programas_accion.html` | Contenido | 🟠 Media | ✅ Analizado |
| 13 | `/uxui.html` | Contenido | 🟠 Media | ✅ Analizado |
| 14 | `/politica_calidad.html` | Legal | 🟡 Baja | ✅ Analizado |
| 15 | `/politica_cookies.html` | Legal | 🟡 Baja | ✅ Analizado |
| 16 | `/politica_privacidad.html` | Legal | 🟡 Baja | ✅ Analizado |
| — | `/css/style_generals.css` | CSS global | — | ✅ Analizado |
| — | `plantilla.html` | Template vacío | ⛔ Excluido | — |
| — | `Otros/liveserver.html` | Dev tool | ⛔ Excluido | — |

**Total auditado:** 16 páginas HTML + 1 CSS global

---

## 3. Checklist integral

### 3.1 WCAG 1.1.1 — Texto alternativo

| Criterio | Páginas afectadas | Estado | Hallazgo |
|----------|-------------------|--------|----------|
| Alt genérico en carruseles | Innovation_hub, busqueda_y_seleccion, delivery_center, outsourcing | ❌ | `alt="Imagen 1"`, `alt="Imagen 3"` repetido — no describe el contenido visual |
| Alt genérico en íconos de servicio | delivery_center | ❌ | `alt="Icon"` en 7 tarjetas de servicios distintos |
| Alt en `aria-label` de `<img>` | index.html | ❌ | `<img aria-label="Instagram">` — el `aria-label` debe estar en el `<a>`, no en el `<img>` |
| Emojis en uxui.html sin `aria-hidden` | uxui.html | ⚠️ | 🔍🧠🧩💡✏️✅🔧🚀 anunciados por lectores como "lupa", "cerebro", etc. |
| Emojis en politica_privacidad.html | politica_privacidad.html | ⚠️ | 📧 📍 sin `aria-hidden` — lectores anuncian "sobre" y "alfiler" |
| Alt descriptivos en equipo | historia.html | ✅ | `alt="Gustavo Deluca"`, `alt="Mariano Deluca"`, etc. — correcto |
| Alt en logo CFOTech | header.html | ✅ | `alt="CFOTech Logo"` — correcto |
| Alt en redes sociales del footer | footer.html | ✅ | `alt="Instagram"`, `alt="YouTube"`, `alt="LinkedIn"` — correcto |
| Alt en imagen ISO | index.html | ✅ | `alt="Certificado ISO 9001:2015"` — bien descriptivo |
| Alt AWS y Azure | index.html | ✅ | `alt="AWS Logo"`, `alt="Azure Logo"` — correcto |

### 3.2 WCAG 1.2.x — Contenido multimedia

| Criterio | Páginas afectadas | Estado | Hallazgo |
|----------|-------------------|--------|----------|
| Videos sin subtítulos | index.html | ❌ | 4 videos hero con `muted loop` sin `<track>` ni subtítulos. Si son decorativos, agregar `aria-hidden="true"` |

### 3.3 WCAG 1.3.1 — Información y relaciones semánticas

| Criterio | Páginas afectadas | Estado | Hallazgo |
|----------|-------------------|--------|----------|
| Landmark `<main>` ausente | **Todas (16 páginas)** | ❌ | Ninguna página tiene `<main>`. El módulo `header.html` no lo inyecta y cada página tampoco |
| Header dinámico por JS | **Todas (16 páginas)** | ⚠️ | `<div id="header"></div>` cargado por `menu.js`. Si JS falla → no hay navegación |
| Footer dinámico por JS | **Todas (16 páginas)** | ⚠️ | `<div id="footer"></div>` cargado por `footer.js` |
| Link vacío en footer | footer.html | ❌ | `<a href="../politica_calidad.html" onclick="toggleMenu()"></a>` — link sin texto ni `aria-label` |
| HTML inválido — `</head>` faltante | uxui.html | ❌ | El `</head>` no existe; el `<body>` está dentro del bloque `<head>`. HTML inválido que puede romper lectores de pantalla |
| Gráfico de barras sin descripción | historia.html | ❌ | El gráfico de crecimiento de colaboradores no tiene alternativa textual ni `aria-label` en las barras |
| Múltiples `<h1>` | index.html | ❌ | 5+ elementos `<h1>` en el mismo documento (carrusel hero + secciones) |

### 3.4 WCAG 1.4.3 — Contraste de color (CSS analizado)

| Criterio | Elemento CSS | Estado | Ratio estimado |
|----------|-------------|--------|----------------|
| Texto de nav sobre fondo blanco | `color: black` sobre `white` | ✅ | 21:1 — pasa |
| Texto footer sobre fondo oscuro | `color: #ddd` sobre `#1c1c1c` | ✅ | ~11.5:1 — pasa |
| Botón `.btn` en portal | `color: #fff` sobre `#007bff` | ❌ | ~4.48:1 — falla (mínimo 4.5:1) |
| Hover de nav links | `color: white` sobre `#58A332` (verde) | ❌ | ~3.3:1 — falla para texto normal |
| Texto párrafos `.content p` | `color: #555` sobre `white` | ✅ | ~7.4:1 — pasa |
| Texto hero `.text-overlay` | `color: #1d1d1d` sobre imagen | ⚠️ | Depende de la imagen — verificar en prod |
| Texto cards `.card-paragraph` | `color: #555` sobre `white` | ✅ | ~7.4:1 — pasa |

### 3.5 WCAG 2.1.1 — Teclado

| Criterio | Páginas afectadas | Estado | Hallazgo |
|----------|-------------------|--------|----------|
| Hamburger menu inaccesible | header.html | ❌ | `<img src="img/menu.svg" onclick="toggleMenu()">` — elemento `<img>` con click handler, sin `role="button"` ni `tabindex="0"` |
| Copy icon sin acceso teclado | contacto.html | ❌ | `<span onclick="copyToClipboard()">` sin `role="button"` ni `tabindex` |
| `<div onclick>` sin role | uxui.html | ❌ | `<div id="unique-arrow" onclick="scrollDown()">⬇️</div>` — inaccessible por teclado |
| Botón "VER TODAS LAS VACANTES" | deja_tu_cv.html | ⚠️ | `<button id="jobButton">` — es un `<button>` correcto, pero sin `onclick` visible en HTML; la acción depende de JS externo |

### 3.6 WCAG 2.2.2 — Pausa, stop, ocultar

| Criterio | Páginas afectadas | Estado | Hallazgo |
|----------|-------------------|--------|----------|
| Carrusel de imágenes auto-rotativo sin pausa | Innovation_hub, busqueda_y_seleccion, delivery_center, outsourcing | ❌ | `setInterval(showSlide, 3000)` en JS — sin botón de pausa/stop |
| Carrusel de video auto-rotativo sin pausa | index.html | ❌ | 4 videos rotan automáticamente con JS — sin control de pausa |
| Carrusel de historia con control manual | historia.html | ✅ | Tiene botones `◂` y `▸` para navegación; aunque también tiene `setInterval` con auto-scroll |

### 3.7 WCAG 2.4.1 — Evitar bloques

| Criterio | Páginas afectadas | Estado | Hallazgo |
|----------|-------------------|--------|----------|
| Skip links ausentes | **Todas (16 páginas)** | ❌ | El módulo `header.html` no incluye `<a href="#main" class="skip-link">`. No existe en ninguna página |

### 3.8 WCAG 2.4.2 — Título de página

| Criterio | Estado | Detalle |
|----------|--------|---------|
| Títulos presentes y descriptivos | ✅ | Todas las páginas tienen `<title>` descriptivo y único |
| Excepción | ⚠️ | `historia.html` → `<title>Quienes somos</title>` (sin tilde y no coincide con el h1 "Nuestra Historia") |

### 3.9 WCAG 2.4.4 — Propósito del enlace

| Criterio | Páginas afectadas | Estado | Hallazgo |
|----------|-------------------|--------|----------|
| Link con URL cruda como texto | aviso-legal.html, politica_cookies.html | ❌ | `<a href="...">https://www.cfotechlatam.com/</a>` — el lector lee la URL completa |
| Link vacío (sin texto ni aria) | footer.html | ❌ | `<a href="../politica_calidad.html"></a>` — completamente inaccesible |
| Placeholder sin reemplazar | politica_privacidad.html | ❌ | `[correo de contacto de CFOTECH]` y `[correo@cfotechlatam.com]` — contenido incompleto mostrado a usuarios |

### 3.10 WCAG 3.1.1 — Idioma de la página

| Estado | Detalle |
|--------|---------|
| ✅ | `<html lang="es">` en todas las páginas analizadas |

### 3.11 WCAG 4.1.1 — Procesamiento (HTML válido)

| Criterio | Páginas afectadas | Estado | Hallazgo |
|----------|-------------------|--------|----------|
| HTML inválido — `</head>` faltante | uxui.html | ❌ | El elemento `<body>` abre dentro del bloque `<head>`. El DOM resultante es impredecible para AT |
| Scripts duplicados | historia.html | ⚠️ | `menu.js` y `footer.js` incluidos dos veces al final del `<body>` |

### 3.12 WCAG 4.1.2 — Nombre, función, valor

| Criterio | Páginas afectadas | Estado | Hallazgo |
|----------|-------------------|--------|----------|
| Snackbar sin `aria-live` | contacto.html | ❌ | `#snackbar-container` sin `role="alert"` — usuarios ciegos no reciben feedback del formulario |
| iframes Google Maps sin `title` | contacto.html | ❌ | Dos `<iframe>` sin atributo `title` |
| Doble `<h1>` | contacto.html | ❌ | "Contacto" y "CFOTech IT Global Services" — solo debe haber un `<h1>` por página |
| Spinner sin `aria-hidden` | contacto.html | ❌ | `.sbbtn-spinner` visible sin `aria-hidden="true"` durante envío |
| `alert()` en JS | uxui.html | ❌ | Al hacer click en cards: `alert('Etapa seleccionada: ...')` — los `alert()` nativos bloquean lectores de pantalla y no son accesibles |
| Botones idioma sin `aria-pressed` | header.html | ⚠️ | `<button data-language="es">ES</button>` — falta estado seleccionado con `aria-pressed` |
| Campos sin `autocomplete` | contacto.html | ❌ | name, email, tel, company sin atributo `autocomplete` |
| Emojis sin `aria-hidden` | uxui.html, politica_privacidad.html | ⚠️ | Emojis funcionales (📧📍🔍🧠) sin `aria-hidden` ni `aria-label` en contexto |

### 3.13 ONTI — Ley 26.653 / Disposición 6/2019

| Criterio | Estado | Hallazgo |
|----------|--------|----------|
| Lenguaje claro | ❌ | aviso-legal.html: "declina expresamente", "absteniéndose de realizar". politica_privacidad.html: "Disposición DNPDP N° 10/08", "artículo 14, inciso 3 de la Ley Nº 25.326" |
| Documentos accesibles | N/A | No se detectaron PDFs vinculados |
| Charset y lang declarados | ✅ | UTF-8 y `lang="es"` en todas las páginas |
| Google Analytics sin consentimiento | ❌ | `gtag.js` cargado **en todas las páginas** sin banner de consentimiento previo — contradice la propia `politica_cookies.html` que dice que el usuario debe consentir primero |
| Maze Analytics sin consentimiento | ❌ | Snippet de Maze cargado en index.html, delivery_center, outsourcing, historia — sin consentimiento |
| Información de contacto incompleta | ❌ | politica_privacidad.html contiene `[correo de contacto de CFOTECH]` y `[correo@cfotechlatam.com]` como placeholders sin completar |
| Política de cookies activa | ⚠️ | La `politica_cookies.html` describe un sistema de consentimiento que no está implementado en el sitio |

---

## 4. Brechas detectadas

### 🔴 Alta prioridad (impacto crítico)

1. **Landmark `<main>` ausente en las 16 páginas** (WCAG 1.3.1) — usuarios de lectores de pantalla no pueden saltar al contenido principal. Fix global: envolver contenido en `<main id="main">` en cada página o en el módulo
2. **Skip links ausentes en las 16 páginas** (WCAG 2.4.1) — usuarios de teclado tabulan toda la navegación en cada carga de página
3. **Carrusel auto-rotativo sin pausa en 5 páginas** (WCAG 2.2.2) — Innovation_hub, busqueda_y_seleccion, delivery_center, outsourcing, historia — afecta epilepsia fotosensible, TDAH, dislexia
4. **Google Analytics + Maze cargados sin consentimiento en todas las páginas** (ONTI) — la propia política de cookies del sitio lo prohíbe
5. **HTML inválido en uxui.html — `</head>` faltante** (WCAG 4.1.1) — el DOM resultante es impredecible; puede romper el parsing en lectores de pantalla
6. **Snackbar sin `aria-live` en contacto.html** (WCAG 4.1.2) — usuarios ciegos no saben si el formulario se envió
7. **iframes Google Maps sin `title` en contacto.html** (WCAG 4.1.2) — no distinguibles por lectores de pantalla
8. **Hamburger menu: `<img onclick>` sin `role="button"`** (WCAG 2.1.1) — la navegación mobile es inaccesible por teclado para el **100% de los usuarios** en mobile

### 🟠 Prioridad media

9. **Videos hero sin subtítulos ni `aria-hidden`** en index.html (WCAG 1.2.2/1.1.1) — si son decorativos, deben tener `aria-hidden="true"`; si son informativos, necesitan subtítulos
10. **Alt texto genérico** `alt="Imagen 1/2/3"` en 4 páginas (WCAG 1.1.1)
11. **Alt texto genérico** `alt="Icon"` en 7 tarjetas de delivery_center.html (WCAG 1.1.1)
12. **Múltiples `<h1>` en index.html** — 5+ elementos h1 en el mismo documento (WCAG 4.1.2)
13. **Doble `<h1>` en contacto.html** — "Contacto" + "CFOTech IT Global Services" (WCAG 4.1.2)
14. **Link vacío en footer** — `<a></a>` sin texto ni aria-label (WCAG 4.1.2)
15. **`<div onclick>` sin `role="button"` en uxui.html** (WCAG 2.1.1)
16. **`alert()` en uxui.html** — bloquea lectores de pantalla; reemplazar con modales accesibles (WCAG 4.1.2)
17. **Contraste hover nav** `#58A332` sobre blanco → ratio 3.3:1 (WCAG 1.4.3) — falla
18. **Contraste botón `.btn`** `#007bff` sobre blanco → ratio 4.48:1 (WCAG 1.4.3) — falla por 0.02 (límite: 4.5:1)
19. **Gráfico de barras sin alternativa textual** en historia.html (WCAG 1.3.1)
20. **Placeholder `[correo de contacto]` sin completar** en politica_privacidad.html (ONTI + contenido)

### 🟡 Prioridad baja

21. **URL cruda como texto de link** en aviso-legal.html y politica_cookies.html (WCAG 2.4.4)
22. **Spinner sin `aria-hidden`** en contacto.html (WCAG 4.1.2)
23. **Copy icon inaccesible por teclado** en contacto.html (WCAG 2.1.1)
24. **Campos sin `autocomplete`** en contacto.html (WCAG 1.3.5)
25. **Emojis funcionales sin `aria-hidden`** en uxui.html, politica_privacidad.html (WCAG 4.1.2)
26. **Botones de idioma sin `aria-pressed`** en header.html (WCAG 4.1.2)
27. **Scripts duplicados** en historia.html (calidad de código)
28. **Lenguaje legal complejo** en aviso-legal.html, politica_privacidad.html (ONTI)
29. **`<title>Quienes somos</title>` en historia.html** — no coincide con el h1 "Nuestra Historia" (WCAG 2.4.2 parcial)
30. **`aria-label` en `<img>` en lugar de en `<a>`** para redes sociales en index.html (WCAG 1.1.1)

---

## 5. Plan de acción priorizado

### Sprint 1 — Críticos globales (2–3 días)

> Estos fixes afectan todas las páginas y son los de mayor impacto:

1. **Agregar `<main id="main">` en todas las páginas** — envolver el contenido entre el `<div id="header">` y el `<div id="footer">`:
   ```html
   <main id="main">
     <!-- contenido de la página -->
   </main>
   ```
2. **Agregar skip link en `header.html`** — primer elemento del módulo:
   ```html
   <a href="#main" class="skip-link">Saltar al contenido</a>
   ```
3. **Corregir hamburger menu en `header.html`** — reemplazar `<img onclick>` por `<button>`:
   ```html
   <button onclick="toggleMenu()" class="hamburger-menu" aria-label="Abrir menú de navegación" aria-expanded="false">
     <img src="img/menu.svg" alt="">
   </button>
   ```
4. **Implementar banner de consentimiento de cookies** antes de cargar `gtag.js` y Maze — la propia política del sitio lo exige
5. **Corregir HTML inválido en `uxui.html`** — agregar `</head>` después del último `<link>` y antes de `<body>`
6. **Agregar `role="alert"` al snackbar en `contacto.html`**:
   ```html
   <div id="snackbar-container" role="alert" aria-live="assertive"></div>
   ```
7. **Agregar `title` a los iframes de Google Maps en `contacto.html`**:
   ```html
   <iframe title="Mapa sede Buenos Aires" ...></iframe>
   <iframe title="Mapa sede Santiago de Chile" ...></iframe>
   ```

### Sprint 2 — Contenido y multimedia (2–3 días)

8. **Agregar botón de pausa a los carruseles de imágenes** (5 páginas):
   ```html
   <button class="carousel-pause" aria-label="Pausar carrusel" aria-pressed="false">⏸</button>
   ```
9. **Videos hero en index.html** — si son decorativos: `<video aria-hidden="true" ...>`; si son informativos: agregar `<track kind="captions">`
10. **Reemplazar `alt="Imagen 1/2/3"`** con descripciones reales del contenido fotográfico
11. **Reemplazar `alt="Icon"`** con descripciones de cada servicio: `alt="Ícono de diseño de arquitectura de software"`
12. **Corregir múltiples `<h1>` en index.html** — solo el primer slide puede tener `<h1>`; los demás usar `<h2>`
13. **Convertir segundo `<h1>` de contacto.html** en `<h2>`
14. **Corregir link vacío en footer.html** — agregar texto visible o `aria-label`:
    ```html
    <a href="../politica_calidad.html" aria-label="Política de calidad">Política de calidad</a>
    ```
15. **Completar placeholders en politica_privacidad.html** — reemplazar `[correo de contacto de CFOTECH]` con el email real

### Sprint 3 — ARIA y mejoras (1–2 días)

16. **Reemplazar `<div onclick>` en uxui.html** por `<button>`:
    ```html
    <button onclick="scrollDown()" aria-label="Ver contenido">⬇️</button>
    ```
17. **Reemplazar `alert()` en uxui.html** con un modal o toast accesible con `role="dialog"` o `aria-live`
18. **Agregar `aria-hidden="true"` a emojis decorativos** en uxui.html y politica_privacidad.html
19. **Agregar `aria-pressed="true/false"` a botones de idioma** en header.html
20. **Corregir contraste hover nav** — cambiar `#58A332` por un verde más oscuro como `#3d7a25` (ratio ≈ 4.6:1)
21. **Corregir contraste botón `.btn`** — cambiar `#007bff` por `#0062d1` (ratio ≈ 5.1:1)
22. **Agregar alternativa textual al gráfico** en historia.html:
    ```html
    <figure aria-label="Gráfico de crecimiento de colaboradores">
      <!-- gráfico -->
      <figcaption>2015: inicio · 2021: 200 colaboradores · 2024: +530 colaboradores</figcaption>
    </figure>
    ```
23. **Mover `aria-label` de `<img>` a `<a>`** en íconos de redes sociales (index.html):
    ```html
    <a href="..." aria-label="Seguinos en Instagram"><img src="img/ig_red.svg" alt=""></a>
    ```
24. **Agregar `autocomplete` a campos de contacto.html**
25. **Corregir `<title>` de historia.html** → `<title>Quiénes somos — CFOTech</title>`
26. **Eliminar scripts duplicados en historia.html**
27. **Reemplazar URL cruda en aviso-legal.html y politica_cookies.html** por texto descriptivo: `"Visitar cfotechlatam.com"`
28. **Revisar lenguaje legal** con criterios de lectura fácil
29. **Convertir `<span onclick>` del copy icon** en `<button>` con `aria-label="Copiar email"`
30. **`aria-hidden="true"` al spinner + `aria-busy="true"` en botón durante envío** (contacto.html)

---

## 6. Comparación v1 → v2

| Métrica | v1 (4 páginas) | v2 (16 páginas) |
|---------|----------------|-----------------|
| Páginas analizadas | 4 | 16 |
| Criterios evaluados | 21 | 30 |
| Brechas detectadas | 13 | **30** |
| Alta prioridad | 5 | **8** |
| Media prioridad | 4 | **12** |
| Baja prioridad | 4 | **10** |
| Hallazgos nuevos vs v1 | — | 17 nuevos |
| Páginas con `<main>` | 0/4 | 0/16 — sistémico |
| Páginas con carrusel sin pausa | 2/4 | 5/16 |
| Páginas con trackers sin consentimiento | 1/4 | **14/16** — casi todo el sitio |

---

## ✅ Resultado de la auditoría

Auditoría completa del sitio institucional de CFOTech IT Global Services.

Se detectaron **30 brechas** distribuidas en:
- **8 de alta prioridad** — 3 son sistémicas (afectan las 16 páginas): ausencia de `<main>`, ausencia de skip links, carga de trackers sin consentimiento
- **12 de prioridad media**
- **10 de prioridad baja**

El sitio cumple los básicos de idioma, charset y títulos descriptivos, pero presenta déficits significativos en accesibilidad de navegación (landmarks, skip links), contenido dinámico (carruseles, snackbars) y cumplimiento legal de privacidad (ONTI — trackers sin consentimiento).

**Hallazgo crítico nuevo respecto a v1:** Google Analytics y Maze Analytics se cargan **sin consentimiento previo en 14 de las 16 páginas**, contradiciendo la propia `politica_cookies.html` del sitio.

**Estimación de remediación:**
- Sprint 1 (críticos globales): **2–3 días front-end**
- Sprint 2 (contenido y multimedia): **2–3 días front-end**
- Sprint 3 (ARIA y mejoras): **1–2 días front-end**
- **Total estimado: 5–8 días de desarrollo front-end**
