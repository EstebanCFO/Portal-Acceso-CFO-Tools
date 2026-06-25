"""Tests de la capa de ingesta."""

import pytest
from pathlib import Path

from sound_catch.ingestion.filesystem import ingest, SUPPORTED_FORMATS


def test_ingest_single_file(tmp_path):
    audio = tmp_path / "test.ogg"
    audio.write_bytes(b"\x00" * 100)
    result = ingest(audio)
    assert len(result) == 1
    assert result[0].original_format == ".ogg"
    assert result[0].size_bytes == 100


def test_ingest_directory(tmp_path):
    (tmp_path / "a.wav").write_bytes(b"\x00" * 10)
    (tmp_path / "b.mp3").write_bytes(b"\x00" * 20)
    (tmp_path / "notas.txt").write_bytes(b"ignorame")
    result = ingest(tmp_path)
    assert len(result) == 2
    formats = {r.original_format for r in result}
    assert formats == {".wav", ".mp3"}


def test_ingest_file_not_found():
    with pytest.raises(FileNotFoundError):
        ingest("/ruta/que/no/existe.ogg")


def test_ingest_unsupported_format(tmp_path):
    f = tmp_path / "archivo.xyz"
    f.write_bytes(b"\x00")
    with pytest.raises(ValueError, match="Formato no soportado"):
        ingest(f)


def test_ingest_empty_directory(tmp_path):
    (tmp_path / "notas.txt").write_bytes(b"texto")
    with pytest.raises(ValueError, match="No se encontraron audios"):
        ingest(tmp_path)
