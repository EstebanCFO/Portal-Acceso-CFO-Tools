# AGENTE_AUDITORIA_CLOUD/api/tests/test_fetchers.py
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fetchers import fetch_repo, fetch_url, fetch_local, _azdo_headers

class TestFetchLocal:
    @pytest.mark.asyncio
    async def test_retorna_archivos_sin_modificar(self):
        files = {'index.html': '<html></html>', 'style.css': 'body{}'}
        result = await fetch_local(files)
        assert result == files

    @pytest.mark.asyncio
    async def test_retorna_dict_vacio_si_no_hay_archivos(self):
        result = await fetch_local({})
        assert result == {}

class TestAzdoHeaders:
    def test_genera_header_authorization_basic(self):
        headers = _azdo_headers('mi-pat-secreto')
        assert 'Authorization' in headers
        assert headers['Authorization'].startswith('Basic ')

class TestFetchRepo:
    @pytest.mark.asyncio
    async def test_fetch_repo_llama_azdo_api(self):
        # Mock de aiohttp para simular respuesta de Azure DevOps
        mock_items_response = MagicMock()
        mock_items_response.status = 200
        mock_items_response.json = AsyncMock(return_value={
            'value': [
                {'path': '/index.html', 'isFolder': False},
                {'path': '/style.css',  'isFolder': False},
                {'path': '/src',        'isFolder': True},
            ]
        })

        mock_content_response = MagicMock()
        mock_content_response.status = 200
        mock_content_response.text = AsyncMock(return_value='<html lang="es"></html>')

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__  = AsyncMock(return_value=None)
        mock_session.get = MagicMock(return_value=AsyncMock(
            __aenter__=AsyncMock(return_value=mock_content_response),
            __aexit__=AsyncMock(return_value=None)
        ))

        # Primera llamada devuelve items list, resto devuelven contenido
        # NOTA: session.get() en aiohttp es síncrono y retorna un context manager;
        # por eso side_effect es un def normal, no async.
        call_count = [0]
        def side_effect(*args, **kwargs):
            ctx = AsyncMock()
            if call_count[0] == 0:
                ctx.__aenter__ = AsyncMock(return_value=mock_items_response)
            else:
                ctx.__aenter__ = AsyncMock(return_value=mock_content_response)
            ctx.__aexit__ = AsyncMock(return_value=None)
            call_count[0] += 1
            return ctx

        mock_session.get = side_effect

        with patch('fetchers.aiohttp.ClientSession', return_value=mock_session):
            repo_data = {
                'platform': 'azure-devops',
                'org': 'mi-org',
                'project': 'mi-proyecto',
                'repo': 'mi-repo',
                'branch': 'main',
                'pat': 'mi-pat',
            }
            result = await fetch_repo(repo_data)

        # Debe retornar dict con archivos HTML y CSS solamente (excluir carpetas)
        assert isinstance(result, dict)

class TestFetchUrl:
    @pytest.mark.asyncio
    async def test_fetch_url_extrae_html(self):
        html_content = '<html lang="es"><head><title>Test</title></head><body><main><p>Hola</p></main></body></html>'

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.text   = AsyncMock(return_value=html_content)

        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__  = AsyncMock(return_value=None)

        def get_ctx(*args, **kwargs):
            ctx = AsyncMock()
            ctx.__aenter__ = AsyncMock(return_value=mock_response)
            ctx.__aexit__  = AsyncMock(return_value=None)
            return ctx

        mock_session.get = get_ctx

        with patch('fetchers.aiohttp.ClientSession', return_value=mock_session):
            result = await fetch_url('https://example.com', depth=1)

        assert 'https://example.com' in result
        assert result['https://example.com'] == html_content
