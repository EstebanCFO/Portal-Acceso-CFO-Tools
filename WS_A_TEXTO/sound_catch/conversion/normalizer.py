"""Normalización de audio a WAV 16 kHz mono usando pydub + FFmpeg."""

import tempfile
from pathlib import Path

from pydub import AudioSegment

from sound_catch.models import AudioFile

_TARGET_SAMPLE_RATE = 16_000
_TARGET_CHANNELS = 1


def normalize(audio: AudioFile, sample_rate: int = _TARGET_SAMPLE_RATE) -> Path:
    """Convierte cualquier AudioFile a WAV 16 kHz mono.

    Si el archivo ya es WAV con los parámetros correctos lo devuelve tal cual
    para no hacer una conversión innecesaria.

    Returns:
        Path al archivo WAV normalizado (puede ser temporal).
    """
    if _already_normalized(audio):
        return audio.path

    sound = AudioSegment.from_file(str(audio.path))
    sound = sound.set_frame_rate(sample_rate).set_channels(_TARGET_CHANNELS)

    tmp = tempfile.NamedTemporaryFile(
        suffix=".wav", delete=False, prefix="sc_"
    )
    tmp_path = Path(tmp.name)
    tmp.close()

    sound.export(str(tmp_path), format="wav")
    return tmp_path


def _already_normalized(audio: AudioFile) -> bool:
    if audio.original_format != ".wav":
        return False
    try:
        sound = AudioSegment.from_file(str(audio.path))
        return (
            sound.frame_rate == _TARGET_SAMPLE_RATE
            and sound.channels == _TARGET_CHANNELS
        )
    except Exception:
        return False
