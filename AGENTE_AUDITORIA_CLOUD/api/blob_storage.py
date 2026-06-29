# AGENTE_AUDITORIA_CLOUD/api/blob_storage.py
import os
import re
from azure.storage.blob import ContainerClient

CONTAINER_NAME = os.environ.get('BLOB_CONTAINER_NAME', 'audit-reports')
CONN_STRING    = os.environ.get('AZURE_STORAGE_CONNECTION_STRING', '')


def _get_container() -> ContainerClient:
    return ContainerClient.from_connection_string(CONN_STRING, CONTAINER_NAME)


def _build_blob_name(nombre_app: str, fecha: str, version: int, ext: str = '.md') -> str:
    """Construye el nombre del blob con versionado."""
    base = f'INFORME-{nombre_app}-{fecha}'
    suffix = '' if version == 1 else f'-v{version}'
    return f'{base}{suffix}{ext}'


def _parse_blob_name(blob_name: str) -> dict | None:
    """Extrae metadata de un nombre de blob."""
    pattern = r'^(.+)/INFORME-(.+)-(\d{4}-\d{2}-\d{2})(-v\d+)?\.md$'
    match = re.match(pattern, blob_name)
    if not match:
        return None
    nombre_app = match.group(2)
    fecha      = match.group(3)
    version    = (match.group(4) or '').lstrip('-') or ''
    return {'nombre_app': nombre_app, 'fecha': fecha, 'version': version}


async def save_report(nombre_app: str, fecha: str, md: str, json_str: str) -> dict:
    """Guarda MD + JSON en Blob Storage. Detecta versión automáticamente."""
    container = _get_container()

    # Encontrar la versión disponible (sin pisar archivos existentes)
    prefix    = f'{nombre_app}/INFORME-{nombre_app}-{fecha}'
    existing  = {b.name for b in container.list_blobs(name_starts_with=prefix)}
    version   = 1
    while f'{nombre_app}/{_build_blob_name(nombre_app, fecha, version)}' in existing:
        version += 1

    md_blob_name   = f'{nombre_app}/{_build_blob_name(nombre_app, fecha, version, ".md")}'
    json_blob_name = f'{nombre_app}/{_build_blob_name(nombre_app, fecha, version, ".json")}'

    # Subir MD
    md_client = container.get_blob_client(md_blob_name)
    md_client.upload_blob(md.encode('utf-8'), overwrite=False, content_settings=_ct('text/markdown'))

    # Subir JSON
    json_client = container.get_blob_client(json_blob_name)
    json_client.upload_blob(json_str.encode('utf-8'), overwrite=False, content_settings=_ct('application/json'))

    return {
        'blob_url_md':   md_client.url,
        'blob_url_json': json_client.url,
    }


async def list_reports() -> list[dict]:
    """Lista todos los informes (solo MD) del Blob Storage, ordenados por fecha desc."""
    container = _get_container()
    reports   = []

    for blob in container.list_blobs():
        if not blob.name.endswith('.md'):
            continue
        meta = _parse_blob_name(blob.name)
        if not meta:
            continue
        blob_client  = container.get_blob_client(blob.name)
        json_name    = blob.name[:-3] + '.json'
        json_client  = container.get_blob_client(json_name)
        reports.append({
            'nombre_app': meta['nombre_app'],
            'fecha':      meta['fecha'],
            'version':    meta['version'],
            'url_md':     blob_client.url,
            'url_json':   json_client.url,
            'brechas':    {'alta': 0, 'media': 0, 'baja': 0},  # sin parsear para performance
        })

    reports.sort(key=lambda r: (r['fecha'], r['version']), reverse=True)
    return reports


def _ct(mime: str):
    from azure.storage.blob import ContentSettings
    return ContentSettings(content_type=mime)
