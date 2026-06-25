"""app.py — Backend Proyectos Activos standalone (FastAPI :5010).
Para producción el router se monta inline en portal_server.py.
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import PORT, CORS_ORIGINS
from router import router

app = FastAPI(
    title       = 'Proyectos Activos API',
    description = 'Semáforo general y ejercicio económico por proyecto — CFOTech',
    version     = '1.0.0',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = CORS_ORIGINS,
    allow_credentials = True,
    allow_methods     = ['*'],
    allow_headers     = ['*'],
)

app.include_router(router)

if __name__ == '__main__':
    print(f'Proyectos Activos API → http://localhost:{PORT}')
    print(f'Docs → http://localhost:{PORT}/docs')
    uvicorn.run('app:app', host='0.0.0.0', port=PORT, reload=True)
