"""Adaptador de ingesta desde el sistema de archivos (archivo único o directorio)."""

from pathlib import Path

from sound_catch.models import AudioFile

SUPPORTED_FORMATS = {
    ".wav", ".ogg", ".mp3", ".m4a", ".mp4",
    ".flac", ".opus", ".webm", ".aac", ".wma",
}


def ingest(source: str | Path) -> list[AudioFile]:
    """Recibe un path (archivo o carpeta) y devuelve una lista de AudioFile.

    Raises:
        FileNotFoundError: si el path no existe.
        ValueError: si el archivo no tiene un formato soportado.
    """
    path = Path(source)

    if not path.exists():
        raise FileNotFoundError(f"No se encontró: {path}")

    if path.is_dir():
        files = sorted(
            f for f in path.rglob("*")
            if f.is_file() and f.suffix.lower() in SUPPORTED_FORMATS
        )
        if not files:
            raise ValueError(f"No se encontraron audios en: {path}")
        return [_to_audio_file(f) for f in files]

    if path.suffix.lower() not in SUPPORTED_FORMATS:
        raise ValueError(
            f"Formato no soportado: '{path.suffix}'. "
            f"Formatos válidos: {', '.join(sorted(SUPPORTED_FORMATS))}"
        )

    return [_to_audio_file(path)]


def _to_audio_file(path: Path) -> AudioFile:
    return AudioFile(
        path=path.resolve(),
        original_format=path.suffix.lower(),
        size_bytes=path.stat().st_size,
    )
