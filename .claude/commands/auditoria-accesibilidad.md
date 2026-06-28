# /auditoria-accesibilidad — Auditoría de Accesibilidad Financiera

Lanza el agente de auditoría de accesibilidad para evaluar un recurso digital
(sitio web, app móvil, repositorio) según WCAG 2.2, ONTI y BCRA A7517.

---

## Uso

```
/auditoria-accesibilidad [url o descripción del recurso]
```

### Ejemplos

```
/auditoria-accesibilidad https://www.bancogalicia.com.ar
/auditoria-accesibilidad https://www.mercadopago.com.ar
/auditoria-accesibilidad app móvil de Brubank
```

---

## Qué hace

1. Activa el agente definido en `.claude/agents/auditoria-accesibilidad.md`
2. Analiza el recurso en tres capas normativas:
   - **WCAG 2.2** — accesibilidad técnica internacional
   - **ONTI** — Ley 26.653 + Disposición 6/2019 (Argentina)
   - **BCRA A7517** — requisitos para bancos y billeteras digitales
3. Genera un informe con:
   - Checklist integral (`✔️` / `❌` / `N/A`)
   - Brechas detectadas y su severidad
   - Plan de acción priorizado
4. Entrega el resultado en dos formatos: **Markdown** y **JSON**

---

## Output de referencia

Ver ejemplos completos en:
- `Workflow Agente de Auditoría/auditoria-accesibilidad.md`
- `Workflow Agente de Auditoría/auditoria-accesibilidad.json`

---

## Normativas evaluadas

| Normativa | Documento oficial |
|-----------|------------------|
| WCAG 2.2 | https://www.w3.org/TR/WCAG22/ |
| ONTI / Ley 26.653 | https://www.argentina.gob.ar/normativa/nacional/ley-26653-175977 |
| BCRA A7517 | https://www.bcra.gob.ar/Pdfs/comytexord/A7517.pdf |
