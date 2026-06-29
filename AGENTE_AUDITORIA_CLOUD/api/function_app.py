# AGENTE_AUDITORIA_CLOUD/api/function_app.py
# Usar el almacén de certificados del SO (Windows/Linux) en vez del bundle de certifi.
# Necesario detrás de proxies de inspección SSL corporativos (Zscaler, etc.):
# el root CA corporativo está en el almacén del SO, no en certifi. Inocuo en Azure.
import truststore
truststore.inject_into_ssl()

import azure.functions as func
import json
import logging
import os
from audit_agent import run_audit_agent
from blob_storage import save_report, list_reports
from shutdown import perform_shutdown, is_azure

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5020').split(',')


def _cors_headers(req: func.HttpRequest) -> dict:
    origin = req.headers.get('Origin', '')
    allowed = origin if origin in ALLOWED_ORIGINS else ALLOWED_ORIGINS[0]
    return {
        'Access-Control-Allow-Origin':  allowed,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }


@app.route(route="audit", methods=["GET", "POST", "OPTIONS"])
async def audit_endpoint(req: func.HttpRequest) -> func.HttpResponse:
    headers = _cors_headers(req)

    # Preflight CORS
    if req.method == 'OPTIONS':
        return func.HttpResponse(status_code=200, headers=headers)

    try:
        content_type = req.headers.get('Content-Type', '')

        if 'multipart/form-data' in content_type:
            # App local — archivos subidos
            form = req.form
            nombre     = form.get('name', 'auditoria-local')
            normativas = json.loads(form.get('normativas', '["wcag22","onti","bcra"]'))
            files_dict = {}
            for key in req.files:
                f = req.files[key]
                files_dict[f.filename] = f.read().decode('utf-8', errors='replace')
            request_data = {
                'type':       'local',
                'nombre':     nombre,
                'files':      files_dict,
                'normativas': normativas,
            }
        else:
            request_data = req.get_json()

        # Ejecutar auditoría
        result = await run_audit_agent(request_data)

        # Guardar en Blob Storage
        urls = await save_report(
            nombre_app=result['nombre_app'],
            fecha=result['fecha'],
            md=result['informe_md'],
            json_str=result['informe_json'],
        )
        result.update(urls)

        return func.HttpResponse(
            body=json.dumps(result, ensure_ascii=False),
            status_code=200,
            mimetype='application/json',
            headers=headers,
        )

    except Exception as exc:
        logging.exception('Error en /api/audit')
        return func.HttpResponse(
            body=json.dumps({'error': str(exc)}, ensure_ascii=False),
            status_code=500,
            mimetype='application/json',
            headers=headers,
        )


@app.route(route="shutdown", methods=["POST", "OPTIONS"])
async def shutdown_endpoint(req: func.HttpRequest) -> func.HttpResponse:
    """Baja el stack local (Vite + Azurite + backend). Solo dev — 403 en Azure."""
    headers = _cors_headers(req)
    if req.method == 'OPTIONS':
        return func.HttpResponse(status_code=200, headers=headers)
    if is_azure():
        return func.HttpResponse(
            body=json.dumps({'error': 'shutdown deshabilitado en producción'}),
            status_code=403, mimetype='application/json', headers=headers,
        )
    try:
        result = perform_shutdown()
        return func.HttpResponse(
            body=json.dumps(result, ensure_ascii=False),
            status_code=200, mimetype='application/json', headers=headers,
        )
    except Exception as exc:
        logging.exception('Error en /api/shutdown')
        return func.HttpResponse(
            body=json.dumps({'error': str(exc)}, ensure_ascii=False),
            status_code=500, mimetype='application/json', headers=headers,
        )


@app.route(route="history", methods=["GET", "OPTIONS"])
async def history_endpoint(req: func.HttpRequest) -> func.HttpResponse:
    headers = _cors_headers(req)
    if req.method == 'OPTIONS':
        return func.HttpResponse(status_code=200, headers=headers)
    try:
        reports = await list_reports()
        return func.HttpResponse(
            body=json.dumps(reports, ensure_ascii=False),
            status_code=200,
            mimetype='application/json',
            headers=headers,
        )
    except Exception as exc:
        return func.HttpResponse(
            body=json.dumps({'error': str(exc)}),
            status_code=500,
            headers=headers,
        )
