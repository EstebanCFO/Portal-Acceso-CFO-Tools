"""Adaptador de ingesta para exportaciones de chat de WhatsApp.

Soporta:
- Archivo ZIP (exportación directa desde WhatsApp).
- Carpeta con archivos ya extraídos.

En ambos casos intenta parsear `_chat.txt` para enriquecer los AudioFile con
el nombre del remitente y el timestamp del mensaje.
"""

import re
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

from sound_catch.ingestion.filesystem import SUPPORTED_FORMATS
from sound_catch.models import AudioFile

# Formatos de línea de mensaje de WhatsApp (varios locales y versiones)
# Ejemplos:
#   [16/6/26, 17:28:56] Nombre: <archivo adjunto: audio.ogg>
#   16/06/2026, 17:28 - Nombre: <attached: audio.ogg>
#   [16/06/2026, 5:28:56 PM] Nombre: <attached: audio.ogg>
_MSG_RE = re.compile(
    r"^\[?(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?"
    r"\s*(?:[-–]\s*)?([^:]+):\s*(.*)",  # guión opcional (formato Android vs iOS)
    re.MULTILINE,
)

# Nombres de adjuntos de audio en distintos idiomas
_ATTACH_RE = re.compile(
    r"<(?:archivo adjunto|attached|file attached|adjunto):\s*(.+?)>",
    re.IGNORECASE,
)


def ingest_whatsapp_zip(zip_path: Path) -> list[AudioFile]:
    """Extrae el ZIP a un directorio temporal y procesa como carpeta."""
    if not zipfile.is_zipfile(zip_path):
        raise ValueError(f"El archivo no es un ZIP válido: {zip_path}")

    tmp_dir = Path(tempfile.mkdtemp(prefix="sc_wa_"))
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(tmp_dir)

    audio_files = ingest_whatsapp_folder(tmp_dir)

    # Los archivos extraídos del ZIP son efímeros
    for af in audio_files:
        af.is_ephemeral = True

    return audio_files


def ingest_whatsapp_folder(folder: Path) -> list[AudioFile]:
    """Procesa una carpeta de exportación de WhatsApp.

    Busca todos los archivos de audio y enriquece con metadatos del _chat.txt.
    """
    if not folder.is_dir():
        raise ValueError(f"No es una carpeta válida: {folder}")

    # Metadatos del chat (sender + timestamp por nombre de archivo)
    chat_meta = _parse_chat_txt(folder)

    # Recolectar archivos de audio (solo PTT y audio — excluir video)
    audio_files: list[AudioFile] = []
    for f in sorted(folder.iterdir()):
        if f.is_file() and f.suffix.lower() in SUPPORTED_FORMATS:
            meta = {"source": "whatsapp", "filename": f.name}
            if f.name in chat_meta:
                meta.update(chat_meta[f.name])
            audio_files.append(AudioFile(
                path=f.resolve(),
                original_format=f.suffix.lower(),
                size_bytes=f.stat().st_size,
                metadata=meta,
            ))

    if not audio_files:
        raise ValueError(
            f"No se encontraron archivos de audio en la carpeta de WhatsApp: {folder}"
        )

    return audio_files


# ── Parser de _chat.txt ───────────────────────────────────────────────────────

def _parse_chat_txt(folder: Path) -> dict[str, dict]:
    """Devuelve un dict {filename: {sender, timestamp}} parseando _chat.txt."""
    chat_file = _find_chat_txt(folder)
    if not chat_file:
        return {}

    try:
        text = chat_file.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return {}

    meta: dict[str, dict] = {}
    for match in _MSG_RE.finditer(text):
        raw_ts, sender, body = match.group(1), match.group(2).strip(), match.group(3).strip()
        attach_match = _ATTACH_RE.search(body)
        if not attach_match:
            continue
        filename = attach_match.group(1).strip()
        meta[filename] = {
            "sender": sender,
            "timestamp": _normalize_timestamp(raw_ts),
        }

    return meta


def _find_chat_txt(folder: Path) -> Path | None:
    """Busca el archivo de chat en la carpeta (varios nombres posibles)."""
    candidates = ["_chat.txt", "WhatsApp Chat.txt"]
    for name in candidates:
        if (folder / name).exists():
            return folder / name
    # Buscar cualquier .txt que empiece con "WhatsApp"
    for f in folder.iterdir():
        if f.suffix == ".txt" and f.name.startswith("WhatsApp"):
            return f
    # Cualquier .txt en la raíz
    txts = [f for f in folder.iterdir() if f.suffix == ".txt"]
    return txts[0] if len(txts) == 1 else None


def _normalize_timestamp(raw: str) -> str:
    """Intenta parsear el timestamp a formato ISO; devuelve el original si falla."""
    raw = raw.strip().rstrip(",")
    formats = [
        "%d/%m/%y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%m/%d/%y %I:%M:%S %p",
        "%m/%d/%Y %I:%M:%S %p",
        "%d/%m/%y %H:%M",
        "%d/%m/%Y %H:%M",
        "%d-%m-%Y %H:%M:%S",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).isoformat(sep=" ")
        except ValueError:
            continue
    return raw
