# AGENTE_AUDITORIA_CLOUD/api/tests/test_storage.py
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from blob_storage import save_report, list_reports, _build_blob_name

class TestBuildBlobName:
    def test_primera_auditoria_sin_version(self):
        name = _build_blob_name('bancogalicia', '2026-06-28', 1)
        assert name == 'INFORME-bancogalicia-2026-06-28.md'

    def test_segunda_auditoria_con_v2(self):
        name = _build_blob_name('bancogalicia', '2026-06-28', 2)
        assert name == 'INFORME-bancogalicia-2026-06-28-v2.md'

    def test_tercera_auditoria_con_v3(self):
        name = _build_blob_name('bancogalicia', '2026-06-28', 3)
        assert name == 'INFORME-bancogalicia-2026-06-28-v3.md'

class TestSaveReport:
    @pytest.mark.asyncio
    async def test_guarda_md_y_json_en_blob(self):
        mock_container = MagicMock()
        mock_blob_client = MagicMock()
        mock_blob_client.url = 'https://storage.azure.com/audit-reports/test.md'
        mock_blob_client.upload_blob = MagicMock()
        mock_container.get_blob_client.return_value = mock_blob_client
        mock_container.list_blobs.return_value = iter([])  # sin blobs existentes

        with patch('blob_storage.ContainerClient.from_connection_string', return_value=mock_container):
            result = await save_report('bancogalicia', '2026-06-28', '# Informe', '{}')

        assert 'blob_url_md' in result
        assert 'blob_url_json' in result
        assert mock_blob_client.upload_blob.call_count == 2  # MD + JSON

class TestListReports:
    @pytest.mark.asyncio
    async def test_retorna_lista_de_informes(self):
        mock_blob1 = MagicMock()
        mock_blob1.name = 'bancogalicia/INFORME-bancogalicia-2026-06-28.md'
        mock_blob2 = MagicMock()
        mock_blob2.name = 'uala/INFORME-uala-2026-06-27.md'
        # Ignorar .json en el listado
        mock_blob3 = MagicMock()
        mock_blob3.name = 'bancogalicia/INFORME-bancogalicia-2026-06-28.json'

        mock_container = MagicMock()
        mock_container.list_blobs.return_value = iter([mock_blob1, mock_blob2, mock_blob3])
        mock_container.get_blob_client.return_value.url = 'https://storage.azure.com/test'

        with patch('blob_storage.ContainerClient.from_connection_string', return_value=mock_container):
            result = await list_reports()

        # Solo MD (no JSON)
        assert len(result) == 2
        assert result[0]['nombre_app'] in ('bancogalicia', 'uala')
