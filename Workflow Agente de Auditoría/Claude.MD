# 🤖 Claude Agent Context – Auditoría de Accesibilidad Financiera

## Propósito
Auditar recursos digitales y presenciales de bancos y billeteras digitales según WCAG 2.2, ONTI y BCRA A7517.

## Flujo de interacción
1. Input → preguntar qué recurso auditar (URL, APK, sitio, repo).
2. Análisis → ejecutar validaciones WCAG, ONTI, BCRA.
3. Resultados → checklist integral con ✔️, ❌, N/A.
4. Output → informe en MD y JSON.

## Ejemplo de salida
# Informe de Compliance de Accesibilidad
- WCAG 2.2 → [✔] Contraste mínimo, [❌] Autenticación accesible
- ONTI → [✔] Documentos accesibles, [❌] Redacción clara
- BCRA A7517 → [❌] Texto-a-voz en home banking, [✔] Texto alternativo en publicidad
