"""Tests de los modelos de datos y sus factories."""

import math
from pathlib import Path
from unittest.mock import MagicMock

from sound_catch.models import Segment, Transcript


def test_segment_from_whisper_confidence():
    """Segment.from_whisper convierte avg_logprob a [0,1] via exp()."""
    mock_seg = MagicMock()
    mock_seg.start = 0.0
    mock_seg.end = 2.0
    mock_seg.text = "  hola  "
    mock_seg.avg_logprob = 0.0          # exp(0) = 1.0 → confianza perfecta

    seg = Segment.from_whisper(mock_seg)
    assert seg.text == "hola"
    assert seg.confidence == 1.0
    assert seg.start == 0.0
    assert seg.end == 2.0


def test_segment_from_whisper_low_confidence():
    mock_seg = MagicMock()
    mock_seg.start = 0.0
    mock_seg.end = 1.0
    mock_seg.text = "ruido"
    mock_seg.avg_logprob = -4.0         # exp(-4) ≈ 0.018 → confianza muy baja

    seg = Segment.from_whisper(mock_seg)
    assert seg.confidence == round(math.exp(-4.0), 4)
    assert seg.confidence < 0.02


def test_transcript_properties():
    t = Transcript(
        text="uno dos tres",
        segments=[
            Segment(0, 1, "uno", confidence=1.0),
            Segment(1, 2, "dos tres", confidence=0.5),
        ],
        language="es",
        language_probability=0.98,
        duration=2.0,
        source_path=Path("audio.wav"),
    )
    assert t.word_count == 3
    assert t.avg_confidence == round((1.0 + 0.5) / 2, 4)
