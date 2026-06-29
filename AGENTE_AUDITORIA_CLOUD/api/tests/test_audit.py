# AGENTE_AUDITORIA_CLOUD/api/tests/test_audit.py
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import json
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from audit_agent import run_audit_agent, _extract_domain, _parse_brechas, _parse_repo_url

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
        assert result == {'alta': 2, 'media': 1, 'baja': 1}

    def test_cuenta_severidades_en_negrita_markdown(self):
        # El modelo suele formatear la severidad en negrita: | **Alta** |
        md = """
| # | Brecha | Normativa | Severidad | Archivo |
|---|--------|-----------|-----------|---------|
| 1 | Skip link ausente | WCAG 2.4.1 | **Alta** | index.html |
| 2 | Menú sin teclado | WCAG 2.1.1 | **Alta** | header.html |
| 3 | Contraste bajo | WCAG 1.4.3 | **Media** | style.css |
| 4 | Sin landmark | WCAG 4.1.2 | **Baja** | footer.html |
"""
        result = _parse_brechas(md)
        assert result == {'alta': 2, 'media': 1, 'baja': 1}

    def test_no_cuenta_severidad_mencionada_en_prosa(self):
        # "Alta" dentro de una descripción no debe contar como brecha
        md = "El riesgo es de prioridad Alta segun el equipo, pero no hay tabla."
        result = _parse_brechas(md)
        assert result == {'alta': 0, 'media': 0, 'baja': 0}

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
    async def test_repo_por_url_usa_pat_server_y_redacta(self):
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text='PAT usado: serverpat99 en la auditoria')]

        with patch('audit_agent.anthropic.Anthropic') as MockAnthropic, \
             patch.dict(os.environ, {'AZURE_DEVOPS_PAT': 'serverpat99'}):
            mock_client = MagicMock()
            mock_client.messages.create.return_value = mock_message
            MockAnthropic.return_value = mock_client

            # El frontend ahora solo manda la URL del repo; sin org/project/pat.
            request = {
                'type': 'repo',
                'repo': {'url': 'https://dev.azure.com/SWF-CFO/Web%20Institucional/_git/Web%20Institucional'},
                'normativas': ['wcag22'],
            }
            with patch('audit_agent.fetch_repo', new_callable=AsyncMock, return_value={'index.html': '<html></html>'}) as mock_fetch:
                result = await run_audit_agent(request)

        # El PAT server-side no debe filtrarse al output
        assert 'serverpat99' not in result['informe_md']
        # nombre_app derivado del repo parseado
        assert result['nombre_app'] == 'Web Institucional'
        # fetch_repo recibió org/project/repo parseados + el PAT del entorno
        repo_data = mock_fetch.call_args.args[0]
        assert repo_data['org'] == 'SWF-CFO'
        assert repo_data['project'] == 'Web Institucional'
        assert repo_data['repo'] == 'Web Institucional'
        assert repo_data['pat'] == 'serverpat99'


class TestParseRepoUrl:
    def test_dev_azure_com_con_espacios_encodeados(self):
        r = _parse_repo_url('https://dev.azure.com/SWF-CFO/Web%20Institucional/_git/Web%20Institucional')
        assert r == {'org': 'SWF-CFO', 'project': 'Web Institucional', 'repo': 'Web Institucional'}

    def test_dev_azure_com_simple(self):
        r = _parse_repo_url('https://dev.azure.com/mi-org/proj/_git/repo1')
        assert r == {'org': 'mi-org', 'project': 'proj', 'repo': 'repo1'}

    def test_visualstudio_legacy(self):
        r = _parse_repo_url('https://miorg.visualstudio.com/proj/_git/repo1')
        assert r == {'org': 'miorg', 'project': 'proj', 'repo': 'repo1'}

    def test_url_invalida_lanza(self):
        with pytest.raises(ValueError):
            _parse_repo_url('https://github.com/user/repo')
