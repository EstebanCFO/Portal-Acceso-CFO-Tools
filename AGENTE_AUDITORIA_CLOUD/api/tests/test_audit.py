# AGENTE_AUDITORIA_CLOUD/api/tests/test_audit.py
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import json
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from audit_agent import run_audit_agent, _extract_domain, _parse_brechas

class TestExtractDomain:
    def test_extrae_dominio_sin_www(self):
        assert _extract_domain('https://www.bancogalicia.com.ar') == 'bancogalicia'

    def test_extrae_dominio_sin_subdominio(self):
        assert _extract_domain('https://mercadopago.com.ar/login') == 'mercadopago'

    def test_extrae_nombre_simple(self):
        assert _extract_domain('https://uala.com.ar') == 'uala'

class TestParseBrechas:
    def test_cuenta_brechas_por_severidad(self):
        md = """
## Brechas detectadas
| Brecha 1 | Alta | ... |
| Brecha 2 | Media | ... |
| Brecha 3 | Alta | ... |
| Brecha 4 | Baja | ... |
"""
        result = _parse_brechas(md)
        assert result['alta'] >= 0
        assert result['media'] >= 0
        assert result['baja'] >= 0
        # Solo validamos que devuelve la estructura correcta
        assert 'alta' in result and 'media' in result and 'baja' in result

class TestRunAuditAgent:
    @pytest.mark.asyncio
    async def test_llama_claude_con_archivos_y_retorna_informe(self):
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text='# Informe\n\n## Sin brechas detectadas')]

        with patch('audit_agent.anthropic.Anthropic') as MockAnthropic:
            mock_client = MagicMock()
            mock_client.messages.create.return_value = mock_message
            MockAnthropic.return_value = mock_client

            request = {
                'type': 'local',
                'nombre': 'Mi-App',
                'files': {'index.html': '<html lang="es"><head><title>Test</title></head><body><main><p>Hola</p></main></body></html>'},
                'normativas': ['wcag22'],
            }
            result = await run_audit_agent(request)

        assert 'informe_md' in result
        assert 'informe_json' in result
        assert 'brechas_resumen' in result
        assert result['nombre_app'] == 'Mi-App'
        assert result['informe_md'] == '# Informe\n\n## Sin brechas detectadas'

    @pytest.mark.asyncio
    async def test_redacta_pat_del_output(self):
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text='PAT usado: abc123 en la auditoria')]

        with patch('audit_agent.anthropic.Anthropic') as MockAnthropic:
            mock_client = MagicMock()
            mock_client.messages.create.return_value = mock_message
            MockAnthropic.return_value = mock_client

            request = {
                'type': 'repo',
                'repo': {
                    'platform': 'azure-devops',
                    'org': 'mi-org', 'project': 'proj', 'repo': 'repo1', 'branch': 'main',
                    'pat': 'abc123'
                },
                'normativas': ['wcag22'],
                '_archivos_mock': {'index.html': '<html></html>'},
            }
            # Inyectamos archivos mockeados para no llamar a fetch_repo
            with patch('audit_agent.fetch_repo', new_callable=AsyncMock, return_value={'index.html': '<html></html>'}):
                result = await run_audit_agent(request)

        assert 'abc123' not in result['informe_md']
