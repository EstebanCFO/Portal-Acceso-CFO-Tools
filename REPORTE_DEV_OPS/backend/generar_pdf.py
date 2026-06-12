"""
generar_pdf.py
Genera el informe PDF a partir de datos_procesados.json.
Usa la paleta CFOTech IT Tools Design System.
"""

import os
import json
import datetime
from dotenv import load_dotenv
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

load_dotenv()

OUT = os.getenv('OUTPUT_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output'))
os.makedirs(OUT, exist_ok=True)

# ── DS CFOTech IT Tools ─────────────────────────────────────
NAVY      = colors.HexColor('#0A1F44')   # --navy (era #004578 Microsoft)
NAVY_DARK = colors.HexColor('#0B1526')   # --navy-dark (header)
GREEN     = colors.HexColor('#00875A')   # --green
GREEN_L   = colors.HexColor('#E3F5EE')   # --green-l
ORANGE    = colors.HexColor('#C96A00')   # --orange
RED       = colors.HexColor('#C0392B')   # --red
GRAY1     = colors.HexColor('#F4F6F9')   # --gray1 (fondo general)
GRAY2     = colors.HexColor('#E8ECF2')   # --gray2
BORDER    = colors.HexColor('#D1D9E6')   # --border
TEXT      = colors.HexColor('#0D1B2A')   # --text
TEXT2     = colors.HexColor('#4A5568')   # --text2
WHITE     = colors.white

# ── Estilos de párrafo ──────────────────────────────────────
H1 = ParagraphStyle(
    'h1', fontName='Helvetica-Bold', fontSize=13,
    textColor=NAVY, spaceBefore=12, spaceAfter=4,
)
H2 = ParagraphStyle(
    'h2', fontName='Helvetica-Bold', fontSize=10,
    textColor=NAVY, spaceBefore=8, spaceAfter=3,
)
BD = ParagraphStyle(
    'bd', fontName='Helvetica', fontSize=9.5,
    textColor=TEXT, leading=14, spaceAfter=3,
)
BD2 = ParagraphStyle(
    'bd2', fontName='Helvetica', fontSize=8.5,
    textColor=TEXT2, leading=12,
)
TH = ParagraphStyle(
    'th', fontName='Helvetica-Bold', fontSize=8.5,
    textColor=WHITE, alignment=TA_CENTER,
)
TD = ParagraphStyle(
    'td', fontName='Helvetica', fontSize=8.5,
    textColor=TEXT, leading=12,
)
TD_C = ParagraphStyle(
    'td_c', fontName='Helvetica', fontSize=8.5,
    textColor=TEXT, leading=12, alignment=TA_CENTER,
)


def mk_table(hdr, rows, col_widths, center_cols=None):
    """Construye una tabla con encabezado navy y filas alternas gray1/white."""
    center_cols = center_cols or []
    data = [[Paragraph(h, TH) for h in hdr]]
    for row in rows:
        data.append([
            Paragraph(str(c), TD_C if i in center_cols else TD)
            for i, c in enumerate(row)
        ])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, 0),  NAVY),
        ('ROWBACKGROUNDS',(0, 1), (-1, -1), [WHITE, GRAY1]),
        ('GRID',          (0, 0), (-1, -1), 0.25, BORDER),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',    (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING',   (0, 0), (-1, -1), 7),
    ]))
    return t


def badge_alerta(alerta):
    """Devuelve texto con color según alerta de desvío."""
    if alerta == 'RIESGO':
        return Paragraph('<font color="#C0392B"><b>RIESGO</b></font>', TD_C)
    if alerta == 'DESVIO':
        return Paragraph('<font color="#C96A00"><b>DESVÍO</b></font>', TD_C)
    return Paragraph('<font color="#00875A"><b>OK</b></font>', TD_C)


def on_page(canvas, doc):
    """Header y footer en todas las páginas."""
    canvas.saveState()
    # Header navy-dark
    canvas.setFillColor(NAVY_DARK)
    canvas.rect(0, 29.7 * cm - 1.2 * cm, 21 * cm, 1.2 * cm, stroke=0, fill=1)
    # Título en header
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.drawString(1.8 * cm, 29.7 * cm - 0.78 * cm, 'CFOTech IT Tools  |  Reporte Azure DevOps — Delivery Center')
    canvas.setFont('Helvetica', 7.5)
    canvas.drawRightString(19.2 * cm, 29.7 * cm - 0.78 * cm, datetime.date.today().strftime('%d/%m/%Y'))
    # Footer paginado
    canvas.setFillColor(TEXT2)
    canvas.setFont('Helvetica', 7.5)
    canvas.drawRightString(19.2 * cm, 0.65 * cm, f'Pág. {doc.page}')
    canvas.restoreState()


if __name__ == '__main__':
    with open('datos_procesados.json', 'r', encoding='utf-8') as f:
        datos = json.load(f)

    fecha = datetime.date.today().strftime('%Y%m%d')
    fn    = os.path.join(OUT, f'informe_devops_{fecha}.pdf')
    doc   = SimpleDocTemplate(
        fn, pagesize=A4,
        leftMargin=1.8 * cm, rightMargin=1.8 * cm,
        topMargin=1.8 * cm,  bottomMargin=1.4 * cm,
    )

    story = []

    # ── Portada / resumen ejecutivo ──────────────────────────
    total_p   = len(datos)
    total_wi  = sum(d['metricas']['total'] for d in datos)
    avance_a  = round(sum(d['metricas']['avance_pct'] for d in datos) / total_p, 1) if total_p else 0
    en_riesgo = sum(1 for d in datos if any(x['desvio_dias'] > 7 for x in d['desvios']))
    orgs      = len(set(d.get('organizacion', '') for d in datos if d.get('organizacion')))

    story.append(Paragraph(
        'Informe General Azure DevOps — Delivery Center',
        ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=18, textColor=NAVY, spaceAfter=6),
    ))
    story.append(Paragraph(
        f'Generado: {datetime.date.today().strftime("%d/%m/%Y")}  ·  Organizaciones: {orgs}',
        BD2,
    ))
    story.append(Spacer(1, 0.3 * cm))

    # Tabla resumen ejecutivo
    story.append(mk_table(
        ['Organizaciones', 'Proyectos', 'Work Items', 'Avance Prom.', 'En Riesgo'],
        [[orgs, total_p, total_wi, f'{avance_a}%', en_riesgo]],
        [3.5 * cm, 3 * cm, 3 * cm, 3 * cm, 3 * cm],
        center_cols=[0, 1, 2, 3, 4],
    ))
    story.append(Spacer(1, 0.4 * cm))

    # ── Detalle por proyecto ─────────────────────────────────
    story.append(Paragraph('Detalle por proyecto', H1))
    rows_det = [
        [
            d.get('organizacion', ''),
            d['proyecto'],
            d['metricas']['total'],
            d['metricas'].get('epicas', '-'),
            d['metricas'].get('user_stories', '-'),
            d['metricas']['items_done'],
            f'{d["metricas"]["avance_pct"]}%',
            'RIESGO' if any(x['desvio_dias'] > 7 for x in d['desvios']) else 'OK',
        ]
        for d in datos
    ]
    story.append(mk_table(
        ['Org', 'Proyecto', 'Items', 'Épicas', 'US', 'Done', 'Avance', 'Estado'],
        rows_det,
        [3 * cm, 4 * cm, 1.5 * cm, 1.5 * cm, 1.5 * cm, 1.5 * cm, 1.8 * cm, 2 * cm],
        center_cols=[2, 3, 4, 5, 6, 7],
    ))
    story.append(PageBreak())

    # ── Desvíos de sprint ────────────────────────────────────
    story.append(Paragraph('Desvíos de sprint', H1))
    for d in datos:
        if not d['desvios']:
            continue
        story.append(Paragraph(
            f'{d.get("organizacion", "")}  /  {d["proyecto"]}',
            H2,
        ))
        rows_dev = [
            [x['nombre'], x['inicio'], x['fin_planeado'], x['estado'], x['desvio_dias']]
            for x in d['desvios']
        ]
        story.append(mk_table(
            ['Sprint', 'Inicio', 'Fin Plan', 'Estado', 'Desvío (días)'],
            rows_dev,
            [5 * cm, 2.5 * cm, 2.5 * cm, 2.5 * cm, 3 * cm],
            center_cols=[1, 2, 3, 4],
        ))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f'PDF generado: {fn}')
