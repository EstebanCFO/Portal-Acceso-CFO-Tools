# 📊 Informe de Accesibilidad — Web Institucional SWF-CFO
**Fecha:** 2026-06-28 | **Auditor:** Agente CFOTech | **Metodología:** Análisis estático de código fuente
**Normativas:** WCAG 2.2 (nivel AA) · ONTI Ley 26.653 / Disposición 6/2019

---

## 1. Recurso auditado

| Campo | Valor |
|-------|-------|
| Fuente | Azure DevOps — Organización: SWF-CFO |
| Repositorio | Web Institucional |
| Rama | master |
| Método | Análisis estático en memoria (sin descarga a disco) |
| Páginas analizadas | Innovation_hub.html · aviso-legal.html · busqueda_y_seleccion.html · contacto.html |

---

## 2. Checklist Integral

| # | Categoría | Criterio | Páginas | Estado | Hallazgo |
|---|-----------|----------|---------|--------|----------|
| 1 | WCAG 1.1.1 | Texto alternativo — carruseles | Innovation, B&S | ❌ | `alt="Imagen 1"`, `alt="Imagen 2"` genéricos. No describen el contenido |
| 2 | WCAG 1.1.1 | Alt en íconos CDN | Innovation | ⚠️ | `alt="Flecha"`, `alt="Buscar"` funcionales pero mejorables |
| 3 | WCAG 1.3.1 | Landmark `<main>` ausente | Todas | ❌ | Ninguna página tiene `<main>`. Lectores de pantalla no pueden saltar al contenido |
| 4 | WCAG 1.3.1 | Header dinámico | Todas | ⚠️ | `<div id="header"></div>` cargado por JS. Si el script falla, no hay navegación |
| 5 | WCAG 1.3.5 | Autocomplete en formulario | contacto | ❌ | Campos `name`, `email`, `tel`, `company` sin `autocomplete` |
| 6 | WCAG 2.1.1 | Copy icon sin teclado | contacto | ❌ | `<span onclick="copyToClipboard()">` sin `role="button"` ni `tabindex="0"` |
| 7 | WCAG 2.2.2 | Carrusel sin pausa | Innovation, B&S | ❌ | Auto-rotativo cada 3s sin control de pausa. Viola WCAG 2.2.2 directamente |
| 8 | WCAG 2.4.1 | Skip links ausentes | Todas | ❌ | Sin enlace "Saltar al contenido". Usuarios de teclado tabulan toda la nav |
| 9 | WCAG 2.4.2 | Título de página | Todas | ✅ | Títulos presentes y descriptivos en todas las páginas |
| 10 | WCAG 2.4.4 | Link texto = URL cruda | aviso-legal | ❌ | `<a href="...">https://www.cfotechlatam.com/</a>` — texto no descriptivo |
| 11 | WCAG 3.1.1 | Idioma declarado | Todas | ✅ | `<html lang="es">` en todas las páginas |
| 12 | WCAG 4.1.2 | Doble `<h1>` | contacto | ❌ | Dos `<h1>` en la misma página. Solo debe haber uno por documento |
| 13 | WCAG 4.1.2 | iframes sin `title` | contacto | ❌ | Dos `<iframe>` de Google Maps sin `title`. Anunciados como "frame" sin contexto |
| 14 | WCAG 4.1.2 | Snackbar sin `aria-live` | contacto | ❌ | Notificaciones de éxito/error sin `role="alert"`. No anunciadas a lectores de pantalla |
| 15 | WCAG 4.1.2 | Spinner sin `aria-hidden` | contacto | ❌ | `<span class="sbbtn-spinner">` sin ocultarse semánticamente al activarse |
| 16 | WCAG 1.4.1 | Charset UTF-8 | Todas | ✅ | `charset="UTF-8"` declarado |
| 17 | WCAG 1.4.3 | Contraste de color | Todas | ⚠️ | No evaluable sin CSS en producción. Requiere herramienta de contraste |
| 18 | ONTI | Lenguaje claro | aviso-legal | ❌ | Lenguaje técnico-legal: "declina expresamente", "absteniéndose de realizar" |
| 19 | ONTI | Documentos accesibles | Todas | N/A | No se detectaron PDFs en las páginas analizadas |
| 20 | ONTI | Charset + lang declarados | Todas | ✅ | UTF-8 + `lang="es"` en todas las páginas |
| 21 | ONTI | Tracker de terceros | B&S | ⚠️ | Script Maze Analytics sin consentimiento explícito visible |

---

## 3. Brechas detectadas

### 🔴 Alta prioridad
- Carruseles auto-rotativos sin botón de pausa (WCAG 2.2.2) — afecta usuarios con epilepsia fotosensible y TDAH
- Snackbars sin `aria-live` (WCAG 4.1.2) — usuarios ciegos no saben si el formulario se envió
- iframes Google Maps sin `title` (WCAG 4.1.2) — no distinguibles por lectores de pantalla
- Falta `<main>` landmark en todas las páginas (WCAG 1.3.1) — navegación ineficiente con lector
- Alt text genérico en carruseles (WCAG 1.1.1) — "Imagen 1" no aporta contexto

### 🟠 Prioridad media
- Sin skip links (WCAG 2.4.1) — usuarios de teclado tabulan nav completa en cada carga
- Doble `<h1>` en contacto.html (WCAG 4.1.2) — estructura semántica confusa
- Copy icon inaccesible por teclado (WCAG 2.1.1)
- Campos sin `autocomplete` (WCAG 1.3.5)

### 🟡 Prioridad baja
- Texto del link = URL cruda en aviso-legal (WCAG 2.4.4)
- Spinner sin `aria-hidden` al enviar (WCAG 4.1.2)
- Lenguaje legal complejo (ONTI)
- Tracker Maze sin consentimiento (ONTI / privacidad)

---

## 4. Plan de acción priorizado

### Sprint 1 — Críticos (1–2 días)
1. Agregar `role="alert"` al contenedor `#snackbar-container` en contacto.html
2. Agregar `title="Mapa sede Buenos Aires"` y `title="Mapa sede Santiago de Chile"` a los iframes
3. Envolver contenido principal con `<main id="main">` en todas las páginas
4. Agregar botón `<button aria-label="Pausar carrusel">⏸</button>` a los carruseles

### Sprint 2 — Importantes (2–3 días)
5. Reemplazar `alt="Imagen 1/2/3"` por descripciones reales (ej: "Equipo de Innovation Hub en taller")
6. Agregar `<a href="#main" class="skip-link">Saltar al contenido</a>` como primer elemento del `<body>`
7. Convertir segundo `<h1>` de contacto.html en `<h2>`
8. Agregar `autocomplete="name"`, `autocomplete="email"`, `autocomplete="tel"`, `autocomplete="organization"`

### Sprint 3 — Mejoras (1 día)
9. `aria-hidden="true"` al spinner + `aria-busy="true"` en botón durante envío
10. Convertir `<span onclick>` del copy icon a `<button type="button" aria-label="Copiar email">`
11. Reemplazar link URL cruda por texto descriptivo: `"Visitar cfotechlatam.com"`
12. Revisar lenguaje del aviso legal con criterios de lectura fácil
13. Agregar banner de consentimiento antes de cargar Maze Analytics

---

## ✅ Resultado del agente

Auditoría completada. Se detectaron **13 brechas** (5 de alta prioridad, 4 media, 4 baja) en 4 páginas del sitio institucional de CFOTech.

El sitio cumple los requisitos básicos de idioma, charset y estructura de encabezados en la mayoría de las páginas, pero presenta déficits significativos en accesibilidad dinámica (carruseles, notificaciones, iframes) y en landmarks semánticos.

**Estimación de remediación:** 4–6 días de desarrollo front-end.
