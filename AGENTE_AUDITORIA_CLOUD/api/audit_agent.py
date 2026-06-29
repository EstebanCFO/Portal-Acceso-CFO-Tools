# AGENTE_AUDITORIA_CLOUD/api/audit_agent.py
import anthropic
import os
import json
import re
from datetime import date
from fetchers import fetch_repo, fetch_url, fetch_local

CLAUDE_MODEL = os.environ.get('CLAUDE_MODEL', 'claude-sonnet-4-6')

AUDIT_SYSTEM_PROMPT = """Sos un auditor especializado en accesibilidad digital para el sector financiero argentino.
Evaluás recursos digitales según tres normativas:

1. WCAG 2.2 nivel AA — Estándar internacional (contraste, navegación por teclado, foco visible, ARIA, landmarks, skip links, alt text, autocomplete, idioma declarado, iframes con title, aria-live en notificaciones dinámicas)
2. ONTI / Ley 26.653 / Disposición 6/2019 — Marco legal argentino (PDF accesibles, lenguaje claro, charset, consentimiento de trackers)
3. BCRA A7517 — Sector financiero (texto-a-voz en home banking y app móvil, alt text en publicidad, capacitación en LSA)

Para cada archivo recibido, ejecutá estas validaciones y producí un informe con este formato exacto:

# Informe de Compliance de Accesibilidad

## Recurso auditado
- Nombre: {nombre}
- Fecha: {fecha}
- Archivos analizados: {N}

## Checklist por archivo

| Archivo | Criterio | Estado | Observación |
|---------|----------|--------|-------------|
| index.html | WCAG 1.4.3 Contraste | ✔ / ❌ / ⚠️ / N/A | ... |

## Brechas detectadas

| # | Brecha | Normativa | Severidad | Archivo | Descripción | Recomendación |
|---|--------|-----------|-----------|---------|-------------|---------------|
| 1 | ... | WCAG 2.2 | Alta | ... | ... | ... |

Severidades: Alta (bloquea uso), Media (dificulta uso), Baja (mejora recomendada).

## Plan de acción

### Sprint 1 — Crítico (semana 1)
- [ ] ...

### Sprint 2 — Importante (semanas 2-3)
- [ ] ...

### Sprint 3 — Mejoras (mes siguiente)
- [ ] ...

## Resultado general
CUMPLE / NO CUMPLE / CUMPLIMIENTO PARCIAL

Notas:
- Nunca inventar resultados. Si no podés verificar un criterio, marcarlo N/A con nota.
- El PAT y credenciales no deben aparecer nunca en el output.
- Priorizar brechas BCRA A7517 (implicancias regulatorias directas).
"""


def _extract_domain(url: str) -> str:
    """Extrae dominio limpio de una URL para usar como nombre de app."""
    # Remover protocolo
    domain = re.sub(r'^https?://', '', url)
    # Remover www.
    domain = re.sub(r'^www\.', '', domain)
    # Tomar solo el primer segmento (antes de / o .)
    domain = domain.split('/')[0]  # quitar path
    domain = domain.split('.')[0]  # quitar TLD
    return domain


def _parse_brechas(md_text: str) -> dict:
    """Cuenta brechas por severidad desde la columna Severidad de las tablas markdown.

    Recorre las filas de tabla (contienen `|`) y cuenta las celdas cuyo contenido,
    una vez quitado el emphasis markdown (`*`, `_`) y los espacios, es exactamente
    'Alta' / 'Media' / 'Baja'. Así se ignoran menciones en prosa y se toleran
    severidades en negrita (`| **Alta** |`), que es como las formatea el modelo.
    """
    counts = {'alta': 0, 'media': 0, 'baja': 0}
    for line in md_text.splitlines():
        if '|' not in line:
            continue
        for cell in line.split('|'):
            token = cell.strip().strip('*_ ').strip().lower()
            if token in counts:
                counts[token] += 1
    return counts


def _redact_pat(text: str, pat: str | None) -> str:
    """Reemplaza el PAT en el texto con [PAT_REDACTED]."""
    if not pat or len(pat) < 4:
        return text
    return text.replace(pat, '[PAT_REDACTED]')


async def run_audit_agent(request: dict) -> dict:
    tipo       = request['type']
    normativas = request.get('normativas', ['wcag22', 'onti', 'bcra'])
    pat        = None

    # 1. Obtener archivos según tipo
    if tipo == 'repo':
        repo_data  = request['repo']
        pat        = repo_data.get('pat')
        archivos   = await fetch_repo(repo_data)
        nombre_app = repo_data['repo']
    elif tipo == 'url':
        url_data   = request['url']
        archivos   = await fetch_url(url_data['url'], url_data.get('depth', 1))
        nombre_app = _extract_domain(url_data['url'])
    else:  # local
        archivos   = request.get('files', {})
        nombre_app = request.get('nombre', 'auditoria-local')

    # 2. Construir prompt con contenido de archivos (máx 5000 chars por archivo)
    archivos_texto = '\n\n'.join([
        f"### {fname}\n```\n{content[:5000]}\n```"
        for fname, content in archivos.items()
    ])

    normativas_str = ', '.join(normativas).upper().replace('WCAG22', 'WCAG 2.2')
    hoy            = date.today().isoformat()

    user_message = (
        f"Auditá los siguientes {len(archivos)} archivo(s) según: {normativas_str}.\n"
        f"Nombre del recurso: {nombre_app}\n"
        f"Fecha: {hoy}\n\n"
        f"{archivos_texto}"
    )

    # 3. Llamar Claude API
    client  = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])
    message = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=8000,
        system=AUDIT_SYSTEM_PROMPT,
        messages=[{'role': 'user', 'content': user_message}],
    )

    informe_md = message.content[0].text

    # 4. Redactar PAT del output (seguridad)
    informe_md = _redact_pat(informe_md, pat)

    # 5. Construir JSON estructurado
    brechas      = _parse_brechas(informe_md)
    informe_json = json.dumps({
        'input':    {'recurso': nombre_app, 'tipo': tipo, 'fecha_auditoria': hoy, 'normativas': normativas},
        'informe_md': informe_md,
        'brechas_resumen': brechas,
    }, ensure_ascii=False, indent=2)

    return {
        'informe_md':      informe_md,
        'informe_json':    informe_json,
        'brechas_resumen': brechas,
        'nombre_app':      nombre_app,
        'fecha':           hoy,
        # blob_url_md y blob_url_json son agregados por blob_storage.py después
        'blob_url_md':  '',
        'blob_url_json': '',
    }
