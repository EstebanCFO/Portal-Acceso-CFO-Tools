# 🤖 Claude Agent Context – Auditoría de Accesibilidad Financiera

## Propósito
Auditar recursos digitales y presenciales de bancos y billeteras digitales según WCAG 2.2, ONTI y BCRA A7517.

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

### FASE 3 — Output
Generar checklist integral con ✔️, ❌, ⚠️, N/A → informe en MD y JSON.

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

## Regla clave
**Sin inventario aprobado → sin auditoría.** La Fase 0 no es opcional.
