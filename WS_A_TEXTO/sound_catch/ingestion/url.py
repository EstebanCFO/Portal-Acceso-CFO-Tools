"""Adaptador de ingesta desde URLs: descarga directa y YouTube vía yt-dlp."""

import re
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from sound_catch.models import AudioFile

# Extensiones de audio válidas para descarga directa
_AUDIO_EXTENSIONS = {
    ".mp3", ".wav", ".ogg", ".opus", ".m4a", ".aac",
    ".flac", ".wma", ".webm",
}

# Dominios que se tratan como YouTube (vía yt-dlp)
_YOUTUBE_DOMAINS = {
    "youtube.com", "www.youtube.com", "youtu.be",
    "m.youtube.com", "music.youtube.com",
}


def ingest_url(url: str) -> list[AudioFile]:
    """Descarga audio desde una URL y devuelve una lista con un AudioFile.

    - URLs directas de audio → descarga con requests.
    - URLs de YouTube / yt-dlp compatible → descarga con yt-dlp.

    El archivo descargado es marcado como `is_ephemeral=True`; el pipeline
    lo elimina después de transcribir.
    """
    domain = urlparse(url).netloc.lower()
    if domain in _YOUTUBE_DOMAINS or _looks_like_yt_dlp_url(url):
        return _ingest_yt_dlp(url)
    return _ingest_direct(url)


# ── Descarga directa ──────────────────────────────────────────────────────────

def _ingest_direct(url: str) -> list[AudioFile]:
    import requests

    parsed = urlparse(url)
    suffix = Path(parsed.path).suffix.lower() or ".mp3"

    tmp = tempfile.NamedTemporaryFile(
        suffix=suffix, delete=False, prefix="sc_url_"
    )
    tmp_path = Path(tmp.name)
    tmp.close()

    try:
        response = requests.get(url, stream=True, timeout=60)
        response.raise_for_status()
        with open(tmp_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
    except requests.RequestException as exc:
        tmp_path.unlink(missing_ok=True)
        raise RuntimeError(f"No se pudo descargar '{url}': {exc}") from exc

    if suffix not in _AUDIO_EXTENSIONS:
        # Intentar igual; el convertidor detectará si el formato es válido
        pass

    return [AudioFile(
        path=tmp_path,
        original_format=suffix,
        size_bytes=tmp_path.stat().st_size,
        metadata={"source": "url", "original_url": url},
        is_ephemeral=True,
    )]


# ── yt-dlp (YouTube y similares) ──────────────────────────────────────────────

def _ingest_yt_dlp(url: str) -> list[AudioFile]:
    try:
        import yt_dlp
    except ImportError as exc:
        raise RuntimeError(
            "yt-dlp no está instalado. Ejecutá: pip install yt-dlp"
        ) from exc

    tmp_dir = Path(tempfile.mkdtemp(prefix="sc_yt_"))
    outtmpl = str(tmp_dir / "%(title).60s.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "quiet": True,
        "no_warnings": True,
        "noplaylist": False,         # soporta playlists
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except Exception as exc:
        raise RuntimeError(f"yt-dlp no pudo descargar '{url}': {exc}") from exc

    # yt-dlp puede descargar una playlist → varios archivos
    entries = info.get("entries") or [info]
    audio_files: list[AudioFile] = []

    for entry in entries:
        if not entry:
            continue
        filename = ydl_opts["outtmpl"] % entry if False else _find_downloaded(tmp_dir, entry)
        if not filename or not filename.exists():
            continue
        audio_files.append(AudioFile(
            path=filename,
            original_format=filename.suffix.lower(),
            size_bytes=filename.stat().st_size,
            metadata={
                "source": "youtube",
                "title": entry.get("title", ""),
                "uploader": entry.get("uploader", ""),
                "duration": entry.get("duration"),
                "original_url": entry.get("webpage_url", url),
            },
            is_ephemeral=True,
        ))

    if not audio_files:
        raise RuntimeError(f"yt-dlp descargó archivos pero no se encontraron en: {tmp_dir}")

    return audio_files


def _find_downloaded(tmp_dir: Path, entry: dict) -> Path | None:
    """Busca el archivo descargado por yt-dlp en tmp_dir para una entrada."""
    # yt-dlp puede cambiar la extensión si transcoda; buscamos por título
    title_clean = re.sub(r'[<>:"/\\|?*]', "_", entry.get("title", ""))[:60]
    for f in tmp_dir.iterdir():
        if f.stem.startswith(title_clean[:20]):
            return f
    # Fallback: primer archivo encontrado
    files = list(tmp_dir.iterdir())
    return files[0] if files else None


def _looks_like_yt_dlp_url(url: str) -> bool:
    """Heurística: URLs con patrones típicos de video hosting."""
    patterns = ["vimeo.com", "dailymotion.com", "twitch.tv", "soundcloud.com"]
    return any(p in url for p in patterns)
