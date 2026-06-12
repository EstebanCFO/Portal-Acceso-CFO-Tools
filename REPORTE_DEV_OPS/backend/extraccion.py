"""
extraccion.py
Extrae proyectos, work items e iteraciones de todas las orgs de Azure DevOps.
Escribe datos_raw.json en el directorio de trabajo.
"""

import os
import json
import logging
import requests
from base64 import b64encode
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

PAT = os.getenv('AZURE_DEVOPS_PAT')
HDR = {
    'Authorization': 'Basic ' + b64encode(f':{PAT}'.encode()).decode(),
    'Content-Type': 'application/json',
}


def get_logger():
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    ts   = datetime.now().strftime('Trace_%d_%m_%Y_%H_%M_%S')
    path = os.path.join(log_dir, f'{ts}.log')
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%d/%m/%Y %H:%M:%S',
        handlers=[
            logging.FileHandler(path, encoding='utf-8'),
            logging.StreamHandler(),
        ],
    )
    return logging.getLogger('extraccion'), path


logger, log_path = get_logger()


def get_orgs():
    orgs_env = os.getenv('AZURE_DEVOPS_ORGS', '')
    if orgs_env:
        orgs = [f'https://dev.azure.com/{o.strip()}' for o in orgs_env.split(',') if o.strip()]
        logger.info(f'Organizaciones configuradas: {len(orgs)}')
        return orgs
    org = os.getenv('AZURE_DEVOPS_ORG', '')
    return [org] if org else []


def get_projects(org_url):
    logger.info(f'GET proyectos: {org_url}')
    try:
        r = requests.get(
            f'{org_url}/_apis/projects?api-version=7.1&$top=200',
            headers=HDR, timeout=30,
        )
        if r.status_code != 200:
            logger.warning(f'  -> HTTP {r.status_code}')
            return []
        proyectos = r.json().get('value', [])
        logger.info(f'  -> {len(proyectos)} proyectos')
        return proyectos
    except Exception as e:
        logger.error(f'  -> ERROR: {e}', exc_info=True)
        return []


def get_work_items(org_url, project):
    try:
        wiql = {
            'query': (
                f"SELECT [System.Id],[System.State],[System.WorkItemType],"
                f"[Microsoft.VSTS.Scheduling.StoryPoints],"
                f"[Microsoft.VSTS.Scheduling.CompletedWork],"
                f"[Microsoft.VSTS.Scheduling.RemainingWork] "
                f"FROM WorkItems WHERE [System.TeamProject]='{project}'"
            )
        }
        r = requests.post(
            f'{org_url}/{project}/_apis/wit/wiql?api-version=7.1',
            json=wiql, headers=HDR, timeout=30,
        )
        if r.status_code != 200:
            return []
        ids = [i['id'] for i in r.json().get('workItems', [])][:200]
        if not ids:
            return []
        fields = (
            'System.Id,System.State,System.WorkItemType,System.AssignedTo,'
            'System.IterationPath,Microsoft.VSTS.Scheduling.StoryPoints,'
            'Microsoft.VSTS.Scheduling.CompletedWork,Microsoft.VSTS.Scheduling.RemainingWork'
        )
        r2 = requests.get(
            f'{org_url}/{project}/_apis/wit/workitems'
            f'?ids={",".join(map(str, ids))}&fields={fields}&api-version=7.1',
            headers=HDR, timeout=30,
        )
        items = r2.json().get('value', []) if r2.status_code == 200 else []
        logger.debug(f'  {project}: {len(items)} items')
        return items
    except Exception as e:
        logger.error(f'  ERROR work_items {project}: {e}', exc_info=True)
        return []


def get_iterations(org_url, project):
    try:
        r = requests.get(
            f'{org_url}/{project}/_apis/work/teamsettings/iterations?api-version=7.1',
            headers=HDR, timeout=30,
        )
        iters = r.json().get('value', []) if r.status_code == 200 else []
        logger.debug(f'  {project}: {len(iters)} iteraciones')
        return iters
    except Exception as e:
        logger.error(f'  ERROR iterations {project}: {e}', exc_info=True)
        return []


if __name__ == '__main__':
    logger.info('=' * 60)
    logger.info('INICIO extraccion.py')
    orgs  = get_orgs()
    datos = []
    for org_url in orgs:
        org_name = org_url.rstrip('/').split('/')[-1]
        logger.info(f'--- Org: {org_name} ---')
        for p in get_projects(org_url):
            nombre = p['name']
            logger.info(f'  Proyecto: {nombre}')
            datos.append({
                'proyecto':     nombre,
                'organizacion': org_name,
                'id':           p['id'],
                'estado':       p.get('state', ''),
                'work_items':   get_work_items(org_url, nombre),
                'iterations':   get_iterations(org_url, nombre),
            })
    with open('datos_raw.json', 'w', encoding='utf-8') as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)
    logger.info(f'FIN: {len(datos)} proyectos -> datos_raw.json')
