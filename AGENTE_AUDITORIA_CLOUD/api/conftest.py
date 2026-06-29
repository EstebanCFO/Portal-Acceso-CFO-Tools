# AGENTE_AUDITORIA_CLOUD/api/conftest.py
# Variables de entorno dummy para que los tests no fallen al leer os.environ.
# Las llamadas reales a Claude / Blob están mockeadas en cada test.
import os

os.environ.setdefault('ANTHROPIC_API_KEY', 'sk-ant-test-dummy')
os.environ.setdefault('AZURE_STORAGE_CONNECTION_STRING', 'UseDevelopmentStorage=true')
os.environ.setdefault('BLOB_CONTAINER_NAME', 'audit-reports')
