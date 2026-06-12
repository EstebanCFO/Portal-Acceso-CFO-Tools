Sos el guardián del Design System de CFOTech IT Tools.

Lee el archivo `DESIGN_SYSTEM.md` en la raíz del proyecto. Es la fuente de verdad de diseño.
Si el archivo no está accesible en este contexto, usá los tokens y reglas que aparecen más abajo como referencia directa.

---

## Tu rol cuando se invoca /diseño

1. **Si se pide crear o revisar una pantalla / componente:**
   - Aplicá los tokens de color, tipografía, bordes y espaciado del Design System.
   - Usá el template HTML base o los componentes MUI adaptados según el stack del proyecto.
   - Corré el checklist al final antes de entregar.

2. **Si se pide revisar que algo cumple el Design System:**
   - Comparar color por color, radio, sombra y tipografía contra los tokens.
   - Listar qué cumple ✅ y qué no ❌, con el fix puntual.

3. **Si se pide adaptar el Design System a un nuevo stack:**
   - Buscar la sección "Adaptación" correspondiente en DESIGN_SYSTEM.md.
   - Si no existe esa sección, crearla vos y ofrecerte a agregarla al archivo.

---

## Tokens clave (referencia rápida)

| Token | Valor | Uso |
|-------|-------|-----|
| `--navy` | `#0A1F44` | Fondo header, botón principal, títulos |
| `--navy2` | `#0D2B5E` | Hover del navy |
| `--blue` | `#4472C4` | Acciones secundarias, links |
| `--green` | `#00875A` | Éxito, badges positivos, EN BANDA |
| `--logo-green` | `#00A878` | **Fondo del logo CFO — uso exclusivo** |
| `--green-a` | `#4FD1B2` | "CFOTech" en header, semáforo online |
| `--red` | `#C0392B` | Error, valores negativos, offline |
| `--orange` | `#C96A00` | Advertencia, REVISAR |
| `--gray1` | `#F4F6F9` | Fondo general, KPI boxes |
| `--gray2` | `#E8ECF2` | Bordes suaves, barras vacías |
| `--gray3` | `#C5CDD8` | Texto deshabilitado, valores nulos |
| `--text` | `#0D1B2A` | Texto principal |
| `--text2` | `#4A5568` | Texto secundario, labels |
| `--border` | `#D1D9E6` | Bordes de cards, inputs |
| `--hdr-sep` | `#D9DCE3` | Separador inferior del header |

## Header corporativo (spec definitiva)

```
Alto: 90px | Padding izquierdo: 28px | Fondo: #0A1F44
Border-bottom: 4px solid #D9DCE3 | Sin box-shadow
```

| Elemento | Spec |
|----------|------|
| Logo CFO | 70×70px · bg `#00A878` sólido · border-radius 18px · texto "CFO" 20px 700 blanco |
| "CFOTech" | font-size 28px · font-weight 700 · color `#4FD1B2` |
| "IT Tools" | font-size 28px · font-weight 700 · color `#FFFFFF` |
| Subtítulo app | font-size 12px · color `rgba(255,255,255,.55)` · debajo del título |
| Semáforo | dot 8px · online=`#4FD1B2` + glow · offline=`#C0392B` · checking=`#C5CDD8` |
| Botón Salir | border `rgba(255,255,255,.35)` · texto blanco 12px · sin fondo · r-8px |

## Reglas de forma (no negociables)

- **Tipografía:** `'Segoe UI', system-ui, sans-serif` — siempre.
- **Border-radius:** cards = 12px · botones = 8px · badges = 20px · inputs = 7px · logo = 18px.
- **Sombra:** solo `0 1px 4px rgba(10,31,68,.05)` en cards. Sin hover shadow. Sin sombra en header.
- **Gradientes:** **prohibidos en todo elemento** — el logo también usa color sólido `#00A878`.
- **Botón principal:** siempre `--navy`. Nunca azul brillante ni verde como botón principal.
- **Labels de formulario:** UPPERCASE, 10px, `--text2`, `letter-spacing: .4px`.

## Semáforo numérico (escala 1–5)

| Valor | Fondo | Texto |
|-------|-------|-------|
| ≥ 4.0 | `#00875A` | `#085041` |
| 3.0–3.9 | `#FFF3E0` | `#C96A00` |
| < 3.0 | `#FDECEA` | `#C0392B` |
| Sin datos | `#E8ECF2` | `#4A5568` |

## Checklist de entrega

Antes de mostrar cualquier pantalla o componente, verificar:

- [ ] Header 90px: logo `#00A878` 70×70 r-18 · "CFOTech" `#4FD1B2` 28px · "IT Tools" blanco 28px
- [ ] Header border-bottom `4px solid #D9DCE3` — sin box-shadow
- [ ] Header derecho: semáforo dinámico + botón Salir
- [ ] Subtítulo con nombre de la app debajo del título
- [ ] Fondo `#F4F6F9`
- [ ] Cards: `border-radius: 12px`, sombra sutil, sin hover shadow
- [ ] Tipografía `Segoe UI`
- [ ] Labels uppercase 10px `letter-spacing: .4px`
- [ ] Botón principal en `#0A1F44`
- [ ] Semáforo aplicado a valores numéricos
- [ ] Sin gradientes en ningún elemento
- [ ] Sin sombras pesadas
