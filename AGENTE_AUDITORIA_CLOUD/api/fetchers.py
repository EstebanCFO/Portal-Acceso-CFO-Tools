# AGENTE_AUDITORIA_CLOUD/api/fetchers.py  ← STUB — se reemplaza en Task 6
async def fetch_repo(repo_data: dict) -> dict[str, str]:
    raise NotImplementedError

async def fetch_url(url: str, depth: int = 1) -> dict[str, str]:
    raise NotImplementedError

async def fetch_local(files: dict) -> dict[str, str]:
    return files

def _azdo_headers(pat: str) -> dict:
    return {}
