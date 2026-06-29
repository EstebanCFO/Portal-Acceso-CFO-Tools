# AGENTE_AUDITORIA_CLOUD/api/fetchers.py
import aiohttp
import base64
import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

AUDIT_EXTENSIONS = {'.html', '.htm', '.css'}
MAX_FILES        = 40  # límite para no exceder tokens de contexto


def _azdo_headers(pat: str) -> dict:
    """Genera headers Basic Auth para Azure DevOps."""
    encoded = base64.b64encode(f':{pat}'.encode()).decode()
    return {
        'Authorization': f'Basic {encoded}',
        'Accept': 'application/json',
    }


async def fetch_repo(repo_data: dict) -> dict[str, str]:
    """Obtiene archivos auditables desde Azure DevOps REST API."""
    org     = repo_data['org']
    project = repo_data['project']
    repo    = repo_data['repo']
    branch  = repo_data.get('branch', 'main')
    pat     = repo_data['pat']
    headers = _azdo_headers(pat)

    base_url = f'https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo}'
    items_url = f'{base_url}/items?recursionLevel=Full&versionDescriptor.version={branch}&versionDescriptor.versionType=branch&api-version=7.0'

    archivos: dict[str, str] = {}

    async with aiohttp.ClientSession() as session:
        # 1. Listar todos los archivos del repo
        async with session.get(items_url, headers=headers) as resp:
            if resp.status != 200:
                raise RuntimeError(f'Azure DevOps API error {resp.status} al listar archivos')
            data  = await resp.json()
            items = data.get('value', [])

        # 2. Filtrar solo archivos auditables (HTML y CSS)
        auditables = [
            item for item in items
            if not item.get('isFolder', False)
            and any(item['path'].lower().endswith(ext) for ext in AUDIT_EXTENSIONS)
        ][:MAX_FILES]

        # 3. Descargar contenido de cada archivo
        for item in auditables:
            content_url = f"{base_url}/items?path={item['path']}&versionDescriptor.version={branch}&versionDescriptor.versionType=branch&api-version=7.0"
            async with session.get(content_url, headers={**headers, 'Accept': 'text/plain'}) as resp:
                if resp.status == 200:
                    content = await resp.text(encoding='utf-8', errors='replace')
                    archivos[item['path']] = content

    return archivos


async def fetch_url(url: str, depth: int = 1) -> dict[str, str]:
    """Descarga HTML de una URL y, si depth=2, de los links internos."""
    archivos: dict[str, str] = {}
    visitados: set[str]       = set()
    pendientes: list[str]     = [url]
    nivel_actual              = 0

    headers = {
        'User-Agent': 'CFOTech-Accessibility-Auditor/1.0 (accessibility audit bot)',
        'Accept': 'text/html,application/xhtml+xml',
    }

    async with aiohttp.ClientSession() as session:
        while pendientes and len(archivos) < MAX_FILES:
            current_batch  = pendientes[:]
            pendientes     = []
            nivel_actual  += 1

            for page_url in current_batch:
                if page_url in visitados:
                    continue
                visitados.add(page_url)

                try:
                    async with session.get(page_url, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                        if resp.status != 200:
                            continue
                        html = await resp.text(encoding='utf-8', errors='replace')
                        archivos[page_url] = html

                        # Si depth=2, extraer links internos para el siguiente nivel
                        if depth >= 2 and nivel_actual < depth:
                            soup  = BeautifulSoup(html, 'html.parser')
                            base  = f"{urlparse(page_url).scheme}://{urlparse(page_url).netloc}"
                            links = [
                                urljoin(base, a.get('href', ''))
                                for a in soup.find_all('a', href=True)
                                if _is_same_domain(a.get('href', ''), base)
                                and not a.get('href', '').startswith('#')
                            ]
                            pendientes.extend(
                                l for l in links
                                if l not in visitados and l not in pendientes
                            )
                except Exception:
                    pass  # Ignorar páginas inaccesibles

    return archivos


async def fetch_local(files: dict[str, str]) -> dict[str, str]:
    """Passthrough — los archivos locales ya vienen como dict filename→content."""
    return files


def _is_same_domain(href: str, base: str) -> bool:
    """Verifica que un link es del mismo dominio o relativo."""
    if href.startswith('/') or href.startswith('./') or href.startswith('../'):
        return True
    parsed = urlparse(href)
    parsed_base = urlparse(base)
    return parsed.netloc == parsed_base.netloc or parsed.netloc == ''
