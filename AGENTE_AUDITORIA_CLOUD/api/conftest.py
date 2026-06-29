# AGENTE_AUDITORIA_CLOUD/api/conftest.py
# Variables de entorno dummy para que los tests no fallen al leer os.environ.
# Las llamadas reales a Claude / Blob están mockeadas en cada test.
import os

os.environ.setdefault('ANTHROPIC_API_KEY', 'sk-ant-test-dummy')
# Connection string dev de Azurite (con AccountName/AccountKey) para que la
# generación de SAS tenga material con qué trabajar en los tests.
os.environ.setdefault(
    'AZURE_STORAGE_CONNECTION_STRING',
    'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;'
    'AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;'
    'BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;'
)
os.environ.setdefault('BLOB_CONTAINER_NAME', 'audit-reports')
