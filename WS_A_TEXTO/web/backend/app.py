"""Sound Catch — Backend Web standalone (FastAPI :5008).

Modo de uso:
  · Standalone (directo): python app.py  →  escucha en :5008
  · Integrado (gateway):  portal_server.py importa router.py directamente

En modo standalone este archivo es el punto de entrada.
En modo gateway, las rutas viven en router.py y se montan en portal_server.py.
"""

import os
import sys
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Importabilidad del paquete sound_catch ────────────────────────────────────
_ROOT = Path(__file__).parent.parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

# override=True: siempre gana el .env propio, ignora herencias del proceso padre
load_dotenv(Path(__file__).parent / ".env", override=True)

# ── Config standalone ─────────────────────────────────────────────────────────
PORT            = int(os.getenv("PORT", 5008))
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5009,http://localhost:5174",
).split(",")

# ── FastAPI + router ──────────────────────────────────────────────────────────
from router import router  # noqa: E402 (after sys.path setup)

app = FastAPI(title="Sound Catch API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar el router bajo /api — mismo prefijo que esperan el Vite proxy y el cliente
app.include_router(router, prefix="/api")

# ── Punto de entrada ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=False)
