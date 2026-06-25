"""Despacha el Transcript al formatter correcto y escribe el archivo de salida."""

import json
from pathlib import Path

from sound_catch.models import Transcript

_FORMATS = ("txt", "srt", "vtt", "json")


def write_output(
    transcript: Transcript,
    output_dir: Path,
    fmt: str = "txt",
    stem: str | None = None,
) -> Path:
    """Escribe el transcript en el formato indicado dentro de output_dir.

    Args:
        transcript: resultado de la transcripción.
        output_dir: carpeta de destino (se crea si no existe).
        fmt: "txt", "srt", "vtt" o "json".
        stem: nombre base del archivo sin extensión; si es None se usa el
              nombre del archivo fuente.

    Returns:
        Path al archivo escrito.
    """
    if fmt not in _FORMATS:
        raise ValueError(f"Formato de salida inválido: '{fmt}'. Válidos: {_FORMATS}")

    output_dir.mkdir(parents=True, exist_ok=True)
    name = stem or transcript.source_path.stem
    out_path = output_dir / f"{name}.{fmt}"

    content = _format(transcript, fmt)
    out_path.write_text(content, encoding="utf-8")
    return out_path


def _format(transcript: Transcript, fmt: str) -> str:
    if fmt == "txt":
        return transcript.text

    if fmt == "srt":
        return _to_srt(transcript)

    if fmt == "vtt":
        return _to_vtt(transcript)

    if fmt == "json":
        return _to_json(transcript)

    raise ValueError(fmt)  # unreachable


# ── Formateadores ─────────────────────────────────────────────────────────────

def _to_srt(transcript: Transcript) -> str:
    lines: list[str] = []
    for i, seg in enumerate(transcript.segments, start=1):
        lines.append(str(i))
        lines.append(f"{_srt_time(seg.start)} --> {_srt_time(seg.end)}")
        lines.append(seg.text)
        lines.append("")
    return "\n".join(lines)


def _to_vtt(transcript: Transcript) -> str:
    """WebVTT — estándar web para subtítulos (usa '.' como separador de ms)."""
    lines: list[str] = ["WEBVTT", ""]
    for i, seg in enumerate(transcript.segments, start=1):
        lines.append(str(i))
        lines.append(f"{_vtt_time(seg.start)} --> {_vtt_time(seg.end)}")
        lines.append(seg.text)
        lines.append("")
    return "\n".join(lines)


def _to_json(transcript: Transcript) -> str:
    data = {
        "language": transcript.language,
        "language_probability": transcript.language_probability,
        "duration": round(transcript.duration, 2),
        "word_count": transcript.word_count,
        "avg_confidence": transcript.avg_confidence,
        "text": transcript.text,
        "segments": [
            {
                "start": round(s.start, 2),
                "end": round(s.end, 2),
                "text": s.text,
                "confidence": s.confidence,
            }
            for s in transcript.segments
        ],
    }
    return json.dumps(data, ensure_ascii=False, indent=2)


# ── Helpers de tiempo ─────────────────────────────────────────────────────────

def _srt_time(seconds: float) -> str:
    h, m, s, ms = _split_time(seconds)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def _vtt_time(seconds: float) -> str:
    h, m, s, ms = _split_time(seconds)
    return f"{h:02}:{m:02}:{s:02}.{ms:03}"


def _split_time(seconds: float) -> tuple[int, int, int, int]:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds % 1) * 1000))
    return h, m, s, ms
