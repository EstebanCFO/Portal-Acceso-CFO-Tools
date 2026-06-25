"""Router de ingesta: detecta el tipo de fuente y delega al adaptador correcto."""

from pathlib import Path

from sound_catch.models import AudioFile


def ingest(source: str | Path) -> list[AudioFile]:
    """Punto de entrada único para todos los orígenes de audio.

    Enrutamiento automático por tipo de fuente:
      - URL (http/https)          → adaptador URL (descarga directa o yt-dlp)
      - Archivo .zip              → adaptador WhatsApp ZIP
      - Carpeta con _chat.txt     → adaptador WhatsApp folder
      - Archivo o carpeta regular → adaptador filesystem
    """
    source_str = str(source)

    # ── URL ───────────────────────────────────────────────────────────────────
    if source_str.startswith(("http://", "https://")):
        from sound_catch.ingestion.url import ingest_url
        return ingest_url(source_str)

    path = Path(source)

    # ── ZIP de WhatsApp ───────────────────────────────────────────────────────
    if path.suffix.lower() == ".zip":
        from sound_catch.ingestion.whatsapp import ingest_whatsapp_zip
        return ingest_whatsapp_zip(path)

    # ── Carpeta de exportación de WhatsApp ────────────────────────────────────
    if path.is_dir() and _looks_like_whatsapp_export(path):
        from sound_catch.ingestion.whatsapp import ingest_whatsapp_folder
        return ingest_whatsapp_folder(path)

    # ── Filesystem (archivo único o carpeta genérica) ─────────────────────────
    from sound_catch.ingestion.filesystem import ingest as fs_ingest
    return fs_ingest(path)


def _looks_like_whatsapp_export(folder: Path) -> bool:
    """Heurística: carpeta con _chat.txt o archivos nombrados como WhatsApp PTT."""
    if (folder / "_chat.txt").exists():
        return True
    for f in folder.iterdir():
        if f.name.startswith("WhatsApp") and f.suffix in {".txt"}:
            return True
        if f.name.startswith("WhatsApp Ptt"):
            return True
    return False


__all__ = ["ingest"]
