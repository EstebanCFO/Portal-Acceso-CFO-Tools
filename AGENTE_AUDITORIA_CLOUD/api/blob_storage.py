# AGENTE_AUDITORIA_CLOUD/api/blob_storage.py
import os
import re
from datetime import datetime, timedelta, timezone
from azure.storage.blob import ContainerClient, generate_blob_sas, BlobSasPermissions

CONTAINER_NAME = os.environ.get('BLOB_CONTAINER_NAME', 'audit-reports')
CONN_STRING    = os.environ.get('AZURE_STORAGE_CONNECTION_STRING', '')
SAS_TTL_DAYS   = int(os.environ.get('SAS_TTL_DAYS', '7'))


def _get_container() -> ContainerClient:
    return ContainerClient.from_connection_string(CONN_STRING, CONTAINER_NAME)


def _conn_parts() -> tuple[str | None, str | None]:
    """Extrae AccountName y AccountKey de la connection string."""
    parts = dict(p.split('=', 1) for p in CONN_STRING.split(';') if '=' in p)
    return parts.get('AccountName'), parts.get('AccountKey')


def _with_sas(blob_client, blob_name: str) -> str:
    """Devuelve la URL del blob con un SAS token de solo-lectura y expiración.

    Los blobs son privados; sin SAS el navegador recibe AuthorizationFailure.
    Funciona igual en Azurite (dev) y en Azure (prod). Si no hay AccountKey
    en la connection string, devuelve la URL pelada (mejor que romper).
    """
    account_name, account_key = _conn_parts()
    if not account_key:
        return blob_client.url
    sas = generate_blob_sas(
        account_name=account_name,
        container_name=CONTAINER_NAME,
        blob_name=blob_name,
        account_key=account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.now(timezone.utc) + timedelta(days=SAS_TTL_DAYS),
    )
    return f'{blob_client.url}?{sas}'


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


async def save_report(nombre_app: str, fecha: str, md: str, json_str: str, pdf: bytes) -> dict:
    """Guarda MD + JSON + PDF en Blob Storage. Detecta versión automáticamente."""
    container = _get_container()

    # Encontrar la versión disponible (sin pisar archivos existentes)
    prefix    = f'{nombre_app}/INFORME-{nombre_app}-{fecha}'
    existing  = {b.name for b in container.list_blobs(name_starts_with=prefix)}
    version   = 1
    while f'{nombre_app}/{_build_blob_name(nombre_app, fecha, version)}' in existing:
        version += 1

    md_blob_name   = f'{nombre_app}/{_build_blob_name(nombre_app, fecha, version, ".md")}'
    json_blob_name = f'{nombre_app}/{_build_blob_name(nombre_app, fecha, version, ".json")}'
    pdf_blob_name  = f'{nombre_app}/{_build_blob_name(nombre_app, fecha, version, ".pdf")}'

    # Subir MD
    md_client = container.get_blob_client(md_blob_name)
    md_client.upload_blob(md.encode('utf-8'), overwrite=False, content_settings=_ct('text/markdown'))

    # Subir JSON
    json_client = container.get_blob_client(json_blob_name)
    json_client.upload_blob(json_str.encode('utf-8'), overwrite=False, content_settings=_ct('application/json'))

    # Subir PDF
    pdf_client = container.get_blob_client(pdf_blob_name)
    pdf_client.upload_blob(bytes(pdf), overwrite=False, content_settings=_ct('application/pdf'))

    return {
        'blob_url_md':   _with_sas(md_client, md_blob_name),
        'blob_url_json': _with_sas(json_client, json_blob_name),
        'blob_url_pdf':  _with_sas(pdf_client, pdf_blob_name),
    }


async def delete_report(nombre_app: str, fecha: str, version: str) -> None:
    """Borra los 3 artefactos (md, json, pdf) de un informe del historial.

    `version` viene como '' (primera) o 'v2'/'v3'… tal como lo expone list_reports.
    """
    container = _get_container()
    suffix = f'-{version}' if version else ''
    base = f'{nombre_app}/INFORME-{nombre_app}-{fecha}{suffix}'
    for ext in ('.md', '.json', '.pdf'):
        try:
            container.delete_blob(f'{base}{ext}')
        except Exception:
            pass  # si un artefacto no existe (ej. informes viejos sin PDF), seguir


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
        pdf_name     = blob.name[:-3] + '.pdf'
        pdf_client   = container.get_blob_client(pdf_name)
        reports.append({
            'nombre_app': meta['nombre_app'],
            'fecha':      meta['fecha'],
            'version':    meta['version'],
            'url_md':     _with_sas(blob_client, blob.name),
            'url_json':   _with_sas(json_client, json_name),
            'url_pdf':    _with_sas(pdf_client, pdf_name),
            'brechas':    {'alta': 0, 'media': 0, 'baja': 0},  # sin parsear para performance
        })

    reports.sort(key=lambda r: (r['fecha'], r['version']), reverse=True)
    return reports


def _ct(mime: str):
    from azure.storage.blob import ContentSettings
    return ContentSettings(content_type=mime)
