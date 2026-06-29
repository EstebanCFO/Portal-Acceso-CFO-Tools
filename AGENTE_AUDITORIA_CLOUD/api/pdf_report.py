# AGENTE_AUDITORIA_CLOUD/api/pdf_report.py
"""Genera el informe de auditoría en PDF con el diseño de reportes del portal CFOTech.

Mismo lenguaje visual que REPORTE_DEV_OPS/backend/generar_pdf.py:
banner navy-dark con logo CFO, tablas con header navy y filas alternas,
severidades coloreadas (Alta=rojo, Media=naranja, Baja=verde) y footer paginado.

Parsea el markdown que produce el agente (títulos, tablas pipe, bullets, párrafos)
y lo renderiza con reportlab.
"""
import io
import re
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, ListFlowable, ListItem,
)
from reportlab.lib.styles import ParagraphStyle

# ── Paleta DS CFOTech ──────────────────────────────────────
NAVY      = colors.HexColor('#0A1F44')
NAVY_DARK = colors.HexColor('#0B1526')
GREEN     = colors.HexColor('#00875A')
LOGO_GRN  = colors.HexColor('#00A878')
ACCENT    = colors.HexColor('#4FD1B2')
ORANGE    = colors.HexColor('#C96A00')
RED       = colors.HexColor('#C0392B')
GRAY1     = colors.HexColor('#F4F6F9')
GRAY2     = colors.HexColor('#E8ECF2')
BORDER    = colors.HexColor('#D1D9E6')
TEXT      = colors.HexColor('#0D1B2A')
TEXT2     = colors.HexColor('#4A5568')
WHITE     = colors.white

# ── Estilos de párrafo ─────────────────────────────────────
H1 = ParagraphStyle('h1', fontName='Helvetica-Bold', fontSize=14, textColor=NAVY, spaceBefore=10, spaceAfter=6)
H2 = ParagraphStyle('h2', fontName='Helvetica-Bold', fontSize=11, textColor=NAVY, spaceBefore=10, spaceAfter=4)
H3 = ParagraphStyle('h3', fontName='Helvetica-Bold', fontSize=9.5, textColor=TEXT2, spaceBefore=8, spaceAfter=3)
BD = ParagraphStyle('bd', fontName='Helvetica', fontSize=9, textColor=TEXT, leading=13, spaceAfter=3)
TH = ParagraphStyle('th', fontName='Helvetica-Bold', fontSize=8, textColor=WHITE, leading=10)
TD = ParagraphStyle('td', fontName='Helvetica', fontSize=8, textColor=TEXT, leading=10.5)

_SEV_COLOR = {'alta': RED, 'media': ORANGE, 'baja': GREEN}


def _md_inline(text: str) -> str:
    """Convierte emphasis markdown a markup de reportlab y escapa lo riesgoso."""
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<i>\1</i>', text)
    return text


def _is_table_sep(cells: list[str]) -> bool:
    """True si la fila es el separador markdown |---|---|."""
    return all(re.fullmatch(r':?-{2,}:?', c.strip() or '-') or set(c.strip()) <= {'-', ':'} for c in cells) \
        and any('-' in c for c in cells)


def _split_row(line: str) -> list[str]:
    s = line.strip()
    if s.startswith('|'):
        s = s[1:]
    if s.endswith('|'):
        s = s[:-1]
    return [c.strip() for c in s.split('|')]


def _parse_blocks(md: str):
    """Convierte markdown en una lista de bloques tipados.

    Bloques: ('h1'|'h2'|'h3', texto) · ('table', [filas]) · ('bullet', texto) · ('p', texto)
    La fila separadora |---| de las tablas se descarta.
    """
    blocks: list[tuple] = []
    lines = md.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        # Tabla: línea con | y la siguiente es separador
        if '|' in stripped and i + 1 < len(lines) and _is_table_sep(_split_row(lines[i + 1])):
            rows = [_split_row(line)]
            i += 2  # saltar header + separador
            while i < len(lines) and '|' in lines[i] and lines[i].strip():
                cells = _split_row(lines[i])
                if not _is_table_sep(cells):
                    rows.append(cells)
                i += 1
            blocks.append(('table', rows))
            continue

        if stripped.startswith('### '):
            blocks.append(('h3', stripped[4:].strip()))
        elif stripped.startswith('## '):
            blocks.append(('h2', stripped[3:].strip()))
        elif stripped.startswith('# '):
            blocks.append(('h1', stripped[2:].strip()))
        elif re.match(r'^[-*]\s', stripped):
            item = re.sub(r'^[-*]\s+', '', stripped)
            item = re.sub(r'^\[[ xX]\]\s*', '', item)  # checkbox markdown
            blocks.append(('bullet', item))
        else:
            blocks.append(('p', stripped))
        i += 1

    return blocks


def _build_table(rows: list[list[str]]):
    """Tabla estilo CFOTech: header navy, filas alternas, severidades coloreadas."""
    header = [Paragraph(_md_inline(c), TH) for c in rows[0]]
    body = []
    sev_cells = []  # (fila, col) a colorear
    for r, row in enumerate(rows[1:], start=1):
        cells = []
        for c, cell in enumerate(row):
            token = cell.strip().strip('*_ ').strip().lower()
            if token in _SEV_COLOR:
                color = _SEV_COLOR[token].hexval()[2:]  # 0xRRGGBB -> RRGGBB
                cells.append(Paragraph(f'<b><font color="#{color}">{token.capitalize()}</font></b>', TD))
            else:
                cells.append(Paragraph(_md_inline(cell), TD))
        body.append(cells)
    # normalizar nº de columnas
    ncols = len(rows[0])
    usable = landscape(A4)[0] - 3.6 * cm
    col_w = [usable / ncols] * ncols
    data = [header] + body
    t = Table(data, colWidths=col_w, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND',     (0, 0), (-1, 0),  NAVY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, GRAY1]),
        ('GRID',           (0, 0), (-1, -1), 0.25, GRAY2),
        ('VALIGN',         (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING',    (0, 0), (-1, -1), 4),
        ('RIGHTPADDING',   (0, 0), (-1, -1), 4),
        ('TOPPADDING',     (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING',  (0, 0), (-1, -1), 4),
    ]))
    del sev_cells
    return t


def _on_page(canvas, doc, nombre_app: str, fecha: str):
    """Header (banner navy + logo CFO) y footer paginado en cada página."""
    w, h = landscape(A4)
    canvas.saveState()

    # Banner navy-dark
    canvas.setFillColor(NAVY_DARK)
    canvas.rect(0, h - 1.5 * cm, w, 1.5 * cm, stroke=0, fill=1)

    # Logo CFO (cuadrado verde redondeado)
    canvas.setFillColor(LOGO_GRN)
    canvas.roundRect(1.2 * cm, h - 1.18 * cm, 0.85 * cm, 0.85 * cm, 3, stroke=0, fill=1)
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica-Bold', 6.5)
    canvas.drawCentredString(1.2 * cm + 0.425 * cm, h - 0.82 * cm, 'CFO')

    # Marca
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica-Bold', 11)
    canvas.drawString(2.35 * cm, h - 0.72 * cm, 'CFOTech')
    canvas.setFillColor(ACCENT)
    canvas.setFont('Helvetica-Bold', 9)
    canvas.drawString(2.35 * cm, h - 1.12 * cm, 'Auditoría de Accesibilidad')

    # Meta a la derecha
    canvas.setFillColor(colors.HexColor('#B4BECD'))
    canvas.setFont('Helvetica', 8)
    canvas.drawRightString(w - 1.2 * cm, h - 0.72 * cm, nombre_app)
    canvas.drawRightString(w - 1.2 * cm, h - 1.12 * cm, fecha)

    # Footer
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.4)
    canvas.line(1.2 * cm, 0.95 * cm, w - 1.2 * cm, 0.95 * cm)
    canvas.setFillColor(TEXT2)
    canvas.setFont('Helvetica', 7)
    canvas.drawString(1.2 * cm, 0.6 * cm, 'CFOTech Latam · Delivery Center · Informe confidencial')
    canvas.drawRightString(w - 1.2 * cm, 0.6 * cm, f'Página {doc.page}')

    canvas.restoreState()


def build_pdf(nombre_app: str, fecha: str, brechas: dict, informe_md: str) -> bytes:
    """Construye el PDF del informe y devuelve los bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=landscape(A4),
        leftMargin=1.2 * cm, rightMargin=1.2 * cm,
        topMargin=1.9 * cm, bottomMargin=1.3 * cm,
        title=f'Informe de Accesibilidad — {nombre_app}',
    )

    story = []

    # Resumen de brechas (badges)
    resumen = (
        f'<b>Resumen de brechas:</b>  '
        f'<font color="#C0392B"><b>{brechas.get("alta", 0)} Altas</b></font>  ·  '
        f'<font color="#C96A00"><b>{brechas.get("media", 0)} Medias</b></font>  ·  '
        f'<font color="#00875A"><b>{brechas.get("baja", 0)} Bajas</b></font>'
    )
    story.append(Paragraph(resumen, BD))
    story.append(Spacer(1, 0.3 * cm))

    for kind, payload in _parse_blocks(informe_md):
        if kind == 'h1':
            story.append(Paragraph(_md_inline(payload), H1))
        elif kind == 'h2':
            story.append(Paragraph(_md_inline(payload), H2))
        elif kind == 'h3':
            story.append(Paragraph(_md_inline(payload), H3))
        elif kind == 'table':
            story.append(Spacer(1, 0.15 * cm))
            story.append(_build_table(payload))
            story.append(Spacer(1, 0.2 * cm))
        elif kind == 'bullet':
            story.append(ListFlowable(
                [ListItem(Paragraph(_md_inline(payload), BD), leftIndent=10)],
                bulletType='bullet', start='•', leftIndent=12,
            ))
        else:  # p
            story.append(Paragraph(_md_inline(payload), BD))

    def _page(canvas, doc_):
        _on_page(canvas, doc_, nombre_app, fecha)

    doc.build(story, onFirstPage=_page, onLaterPages=_page)
    return buf.getvalue()
