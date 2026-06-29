# AGENTE_AUDITORIA_CLOUD/api/tests/test_pdf_report.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pdf_report import build_pdf, _parse_blocks


SAMPLE_MD = """# Informe de Compliance de Accesibilidad

## Recurso auditado
- Nombre: Web Institucional
- Fecha: 2026-06-29

## Brechas detectadas

| # | Brecha | Normativa | Severidad | Archivo |
|---|--------|-----------|-----------|---------|
| 1 | Skip link ausente | WCAG 2.4.1 | **Alta** | index.html |
| 2 | Contraste bajo | WCAG 1.4.3 | **Media** | style.css |

## Plan de acción
- [ ] Agregar skip link
"""


class TestParseBlocks:
    def test_detecta_titulos(self):
        blocks = _parse_blocks("# Titulo\n## Subtitulo\n")
        kinds = [b[0] for b in blocks]
        assert 'h1' in kinds
        assert 'h2' in kinds

    def test_detecta_tabla_y_omite_separador(self):
        blocks = _parse_blocks(SAMPLE_MD)
        tables = [b for b in blocks if b[0] == 'table']
        assert len(tables) == 1
        rows = tables[0][1]
        # header + 2 filas de datos (la fila |---| se descarta)
        assert len(rows) == 3
        assert rows[0][0] == '#'
        assert rows[1][1] == 'Skip link ausente'

    def test_detecta_bullets(self):
        blocks = _parse_blocks("- item uno\n- [ ] tarea dos\n")
        bullets = [b for b in blocks if b[0] == 'bullet']
        assert len(bullets) == 2


class TestBuildPdf:
    def test_genera_pdf_valido(self):
        brechas = {'alta': 1, 'media': 1, 'baja': 0}
        pdf = build_pdf('Web Institucional', '2026-06-29', brechas, SAMPLE_MD)
        assert isinstance(pdf, (bytes, bytearray))
        assert pdf[:4] == b'%PDF'
        assert len(pdf) > 1000  # no es un PDF vacío

    def test_no_falla_con_markdown_minimo(self):
        pdf = build_pdf('app', '2026-06-29', {'alta': 0, 'media': 0, 'baja': 0}, '# Solo titulo')
        assert pdf[:4] == b'%PDF'
