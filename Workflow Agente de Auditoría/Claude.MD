# 🤖 Claude Agent Context – Auditoría de Accesibilidad Financiera

## Propósito
Auditar recursos digitales y presenciales de bancos y billeteras digitales según WCAG 2.2, ONTI y BCRA A7517.

---

## Flujo de interacción

### FASE 0 — Inventario (SIEMPRE PRIMERO, sin excepciones)

Antes de cualquier validación, el agente DEBE:

1. **Enumerar todos los archivos** del recurso a auditar:
   - Repositorio → listar árbol completo vía API
   - URL / sitio → rastrear páginas enlazadas (máx. 2 niveles)
   - APK → listar Activities y layouts

2. **Presentar tabla de inventario** con tipo, tamaño y prioridad:
   ```
   | # | Archivo | Tipo | Prioridad | Observación |
   | 1 | /modulo/header.html | Módulo compartido | 🔴 Alta | Afecta todas las páginas |
   | 2 | /index.html | Home | 🔴 Alta | Página raíz |
   ...
   ```

3. **Clasificar por prioridad:**
   - 🔴 Alta → módulos compartidos, formularios, home
   - 🟠 Media → páginas de contenido
   - 🟡 Baja → páginas legales (similares entre sí)
   - ⛔ Excluir → dev tools, plantillas vacías, archivos auxiliares

4. **Esperar confirmación del usuario** antes de avanzar a la Fase 1.

---

### FASE 1 — Input
Preguntar qué recurso auditar si no fue indicado (URL, APK, sitio, repo).

### FASE 2 — Análisis
Ejecutar validaciones WCAG 2.2, ONTI y BCRA A7517 sobre cada archivo del inventario aprobado.

---

### FASE 3 — Output y guardado con historial

#### 📁 Estructura de carpetas (SIEMPRE esta ruta, sin excepciones)

```
C:\Esteban CFOTech\Portal de Acceso\Workflow Agente de Auditoría\
└── {nombre-app}\
    ├── INFORME-{nombre-app}-YYYY-MM-DD.md       ← primera auditoría del día
    ├── INFORME-{nombre-app}-YYYY-MM-DD.json
    ├── INFORME-{nombre-app}-YYYY-MM-DD-v2.md    ← segunda auditoría del mismo día
    ├── INFORME-{nombre-app}-YYYY-MM-DD-v2.json
    └── ...                                        ← historial, nunca se pisa
```

#### Reglas de nombrado

| Campo | Regla |
|-------|-------|
| `{nombre-app}` | Del nombre del repo / dominio de URL / nombre del APK, en kebab-case |
| Fecha | `YYYY-MM-DD` en formato ISO |
| Versión | Si el archivo del día ya existe → agregar `-v2`, `-v3`, etc. |
| Nunca pisar | Verificar existencia antes de escribir, siempre |

#### Derivar `{nombre-app}`

- Repositorio "Web Institucional" → `Web-Institucional`
- URL `bancogalicia.com.ar` → `bancogalicia`
- URL `mercadopago.com.ar` → `mercadopago`
- APK "BBVA Argentina" → `BBVA-Argentina`

#### Al finalizar

Confirmar al usuario la ruta exacta:
```
✅ Informe guardado en:
   Workflow Agente de Auditoría\{nombre-app}\INFORME-{nombre-app}-YYYY-MM-DD.md
   Workflow Agente de Auditoría\{nombre-app}\INFORME-{nombre-app}-YYYY-MM-DD.json
```

---

## Ejemplo de salida

```markdown
# Informe de Compliance de Accesibilidad

## Inventario
- 16 archivos HTML auditables · 16 CSS · 0 PDF
- Excluidos: plantilla.html (vacía), Otros/liveserver.html (dev tool)

## WCAG 2.2
- [✔] Contraste mínimo · [❌] Autenticación accesible · [❌] Landmark main ausente

## ONTI
- [✔] Documentos accesibles · [❌] Redacción clara

## BCRA A7517
- [❌] Texto-a-voz en home banking · [✔] Texto alternativo en publicidad
```

---

## Reglas irrompibles

1. **Sin inventario aprobado → sin auditoría.** La Fase 0 no es opcional.
2. **Informes siempre en `Workflow Agente de Auditoría\{nombre-app}\`** — nunca en otra ruta.
3. **Nunca pisar un informe existente** — agregar `-v2`, `-v3`, etc.
4. **Nunca incluir PATs ni credenciales** en el output — redactarlos como `[PAT_REDACTED]`.
