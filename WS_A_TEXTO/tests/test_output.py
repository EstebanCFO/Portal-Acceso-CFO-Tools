"""Tests de la capa de salida."""

import json
from pathlib import Path

import pytest

from sound_catch.models import Segment, Transcript
from sound_catch.output.writer import write_output, _srt_time, _vtt_time, _split_time


def _make_transcript(text="Hola mundo", lang="es", confidence=0.9) -> Transcript:
    return Transcript(
        text=text,
        segments=[Segment(start=0.0, end=1.5, text=text, confidence=confidence)],
        language=lang,
        language_probability=0.99,
        duration=1.5,
        source_path=Path("test.wav"),
    )


# ── TXT ───────────────────────────────────────────────────────────────────────

def test_write_txt(tmp_path):
    t = _make_transcript("Hola mundo")
    out = write_output(t, tmp_path, fmt="txt", stem="prueba")
    assert out.suffix == ".txt"
    assert out.read_text(encoding="utf-8") == "Hola mundo"


# ── JSON ──────────────────────────────────────────────────────────────────────

def test_write_json(tmp_path):
    t = _make_transcript("Texto de prueba")
    out = write_output(t, tmp_path, fmt="json", stem="prueba")
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["language"] == "es"
    assert data["language_probability"] == 0.99
    assert data["text"] == "Texto de prueba"
    assert data["word_count"] == 3
    assert "avg_confidence" in data
    assert len(data["segments"]) == 1
    assert "confidence" in data["segments"][0]


# ── SRT ───────────────────────────────────────────────────────────────────────

def test_write_srt(tmp_path):
    t = _make_transcript("Subtitulo uno")
    out = write_output(t, tmp_path, fmt="srt", stem="prueba")
    content = out.read_text(encoding="utf-8")
    assert "00:00:00,000 --> 00:00:01,500" in content
    assert "Subtitulo uno" in content


# ── VTT ───────────────────────────────────────────────────────────────────────

def test_write_vtt(tmp_path):
    t = _make_transcript("Subtitulo web")
    out = write_output(t, tmp_path, fmt="vtt", stem="prueba")
    content = out.read_text(encoding="utf-8")
    assert content.startswith("WEBVTT")
    # VTT usa punto como separador de milisegundos (no coma como SRT)
    assert "00:00:00.000 --> 00:00:01.500" in content
    assert "Subtitulo web" in content


def test_vtt_different_from_srt(tmp_path):
    t = _make_transcript("Test")
    srt = write_output(t, tmp_path, fmt="srt", stem="srt_test")
    vtt = write_output(t, tmp_path, fmt="vtt", stem="vtt_test")
    srt_content = srt.read_text(encoding="utf-8")
    vtt_content = vtt.read_text(encoding="utf-8")
    # Diferencia principal: coma vs punto en timestamp
    assert "," in srt_content
    assert "WEBVTT" in vtt_content
    assert "WEBVTT" not in srt_content


# ── Formato inválido ──────────────────────────────────────────────────────────

def test_invalid_format(tmp_path):
    with pytest.raises(ValueError):
        write_output(_make_transcript(), tmp_path, fmt="pdf")


# ── Helpers de tiempo ─────────────────────────────────────────────────────────

def test_srt_time_conversion():
    assert _srt_time(0.0) == "00:00:00,000"
    assert _srt_time(90.5) == "00:01:30,500"
    assert _srt_time(3661.25) == "01:01:01,250"


def test_vtt_time_conversion():
    assert _vtt_time(0.0) == "00:00:00.000"
    assert _vtt_time(90.5) == "00:01:30.500"
    assert _vtt_time(3661.25) == "01:01:01.250"


def test_split_time_boundaries():
    assert _split_time(0.0) == (0, 0, 0, 0)
    assert _split_time(3599.999) == (0, 59, 59, 999)
    assert _split_time(7322.1) == (2, 2, 2, 100)


# ── Propiedades del modelo ────────────────────────────────────────────────────

def test_transcript_word_count():
    t = _make_transcript("uno dos tres cuatro")
    assert t.word_count == 4


def test_transcript_avg_confidence():
    t = Transcript(
        text="a b",
        segments=[
            Segment(0, 1, "a", confidence=0.8),
            Segment(1, 2, "b", confidence=0.6),
        ],
        language="es",
        language_probability=1.0,
        duration=2.0,
        source_path=Path("x.wav"),
    )
    assert t.avg_confidence == 0.7


def test_transcript_empty_text():
    t = Transcript(
        text="",
        segments=[],
        language="es",
        language_probability=1.0,
        duration=0.0,
        source_path=Path("x.wav"),
    )
    assert t.word_count == 0
    assert t.avg_confidence == 0.0
