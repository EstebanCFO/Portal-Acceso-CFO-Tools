"""Tests del adaptador de ingesta WhatsApp (ZIP y carpeta)."""

import zipfile
from pathlib import Path

import pytest

from sound_catch.ingestion.whatsapp import (
    ingest_whatsapp_folder,
    ingest_whatsapp_zip,
    _parse_chat_txt,
    _normalize_timestamp,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_whatsapp_folder(tmp_path: Path, chat_txt: str = "", audio_names: list[str] | None = None) -> Path:
    folder = tmp_path / "WA_Export"
    folder.mkdir()
    if chat_txt:
        (folder / "_chat.txt").write_text(chat_txt, encoding="utf-8")
    for name in (audio_names or []):
        (folder / name).write_bytes(b"\x00" * 100)
    return folder


_CHAT_TXT_ES = """\
[16/6/26, 17:28:56] Esteban: <archivo adjunto: WhatsApp Ptt 2026-06-16 at 17.28.56.ogg>
[16/6/26, 17:29:10] Ana: Perfecto, gracias
[16/6/26, 17:30:00] Ana: <archivo adjunto: WhatsApp Ptt 2026-06-16 at 17.30.00.ogg>
"""

_CHAT_TXT_EN = """\
[6/16/26, 5:28:56 PM] Bob: <attached: WhatsApp Ptt 2026-06-16 at 17.28.56.ogg>
[6/16/26, 5:30:00 PM] Alice: <attached: WhatsApp Ptt 2026-06-16 at 17.30.00.ogg>
"""

_AUDIO_FILES = [
    "WhatsApp Ptt 2026-06-16 at 17.28.56.ogg",
    "WhatsApp Ptt 2026-06-16 at 17.30.00.ogg",
]


# ── Tests de carpeta ──────────────────────────────────────────────────────────

class TestIngestWhatsappFolder:

    def test_finds_audio_files(self, tmp_path):
        folder = _make_whatsapp_folder(tmp_path, audio_names=_AUDIO_FILES)
        results = ingest_whatsapp_folder(folder)
        assert len(results) == 2

    def test_ignores_non_audio_files(self, tmp_path):
        folder = _make_whatsapp_folder(tmp_path, audio_names=_AUDIO_FILES)
        (folder / "foto.jpg").write_bytes(b"\x00")
        (folder / "documento.pdf").write_bytes(b"\x00")
        results = ingest_whatsapp_folder(folder)
        assert len(results) == 2

    def test_metadata_from_spanish_chat(self, tmp_path):
        folder = _make_whatsapp_folder(tmp_path, chat_txt=_CHAT_TXT_ES, audio_names=_AUDIO_FILES)
        results = ingest_whatsapp_folder(folder)
        by_name = {r.path.name: r for r in results}

        r0 = by_name["WhatsApp Ptt 2026-06-16 at 17.28.56.ogg"]
        assert r0.metadata["sender"] == "Esteban"
        assert r0.metadata["source"] == "whatsapp"
        assert "timestamp" in r0.metadata

        r1 = by_name["WhatsApp Ptt 2026-06-16 at 17.30.00.ogg"]
        assert r1.metadata["sender"] == "Ana"

    def test_metadata_from_english_chat(self, tmp_path):
        folder = _make_whatsapp_folder(tmp_path, chat_txt=_CHAT_TXT_EN, audio_names=_AUDIO_FILES)
        results = ingest_whatsapp_folder(folder)
        by_name = {r.path.name: r for r in results}
        assert by_name["WhatsApp Ptt 2026-06-16 at 17.28.56.ogg"].metadata["sender"] == "Bob"

    def test_works_without_chat_txt(self, tmp_path):
        folder = _make_whatsapp_folder(tmp_path, audio_names=_AUDIO_FILES)
        results = ingest_whatsapp_folder(folder)
        assert len(results) == 2
        # Sin _chat.txt no hay sender
        assert "sender" not in results[0].metadata

    def test_raises_on_empty_folder(self, tmp_path):
        folder = _make_whatsapp_folder(tmp_path)
        with pytest.raises(ValueError, match="No se encontraron"):
            ingest_whatsapp_folder(folder)

    def test_raises_on_invalid_path(self, tmp_path):
        with pytest.raises(ValueError, match="No es una carpeta"):
            ingest_whatsapp_folder(tmp_path / "nonexistent")

    def test_audio_files_not_ephemeral_from_folder(self, tmp_path):
        """Archivos locales de carpeta NO son efímeros."""
        folder = _make_whatsapp_folder(tmp_path, audio_names=_AUDIO_FILES)
        results = ingest_whatsapp_folder(folder)
        assert all(not r.is_ephemeral for r in results)


# ── Tests de ZIP ──────────────────────────────────────────────────────────────

class TestIngestWhatsappZip:

    def _make_zip(self, tmp_path: Path, audio_names: list[str], chat_txt: str = "") -> Path:
        zip_path = tmp_path / "export.zip"
        with zipfile.ZipFile(zip_path, "w") as zf:
            if chat_txt:
                zf.writestr("_chat.txt", chat_txt)
            for name in audio_names:
                zf.writestr(name, b"\x00" * 100)
        return zip_path

    def test_ingest_zip_basic(self, tmp_path):
        zip_path = self._make_zip(tmp_path, _AUDIO_FILES, chat_txt=_CHAT_TXT_ES)
        results = ingest_whatsapp_zip(zip_path)
        assert len(results) == 2

    def test_zip_files_are_ephemeral(self, tmp_path):
        """Archivos extraídos de ZIP SÍ son efímeros."""
        zip_path = self._make_zip(tmp_path, _AUDIO_FILES)
        results = ingest_whatsapp_zip(zip_path)
        assert all(r.is_ephemeral for r in results)

    def test_zip_metadata_parsed(self, tmp_path):
        zip_path = self._make_zip(tmp_path, _AUDIO_FILES, chat_txt=_CHAT_TXT_ES)
        results = ingest_whatsapp_zip(zip_path)
        senders = {r.metadata.get("sender") for r in results}
        assert "Esteban" in senders

    def test_invalid_zip_raises(self, tmp_path):
        fake_zip = tmp_path / "fake.zip"
        fake_zip.write_bytes(b"not a zip file")
        with pytest.raises(ValueError, match="ZIP"):
            ingest_whatsapp_zip(fake_zip)


# ── Tests del parser de _chat.txt ─────────────────────────────────────────────

class TestParseChatTxt:

    def test_parses_spanish_format(self, tmp_path):
        folder = _make_whatsapp_folder(tmp_path, chat_txt=_CHAT_TXT_ES, audio_names=_AUDIO_FILES)
        meta = _parse_chat_txt(folder)
        assert "WhatsApp Ptt 2026-06-16 at 17.28.56.ogg" in meta
        assert meta["WhatsApp Ptt 2026-06-16 at 17.28.56.ogg"]["sender"] == "Esteban"

    def test_parses_english_format(self, tmp_path):
        folder = _make_whatsapp_folder(tmp_path, chat_txt=_CHAT_TXT_EN, audio_names=_AUDIO_FILES)
        meta = _parse_chat_txt(folder)
        assert meta["WhatsApp Ptt 2026-06-16 at 17.28.56.ogg"]["sender"] == "Bob"

    def test_returns_empty_without_chat_file(self, tmp_path):
        folder = _make_whatsapp_folder(tmp_path)
        assert _parse_chat_txt(folder) == {}

    def test_skips_non_audio_attachments(self, tmp_path):
        chat = "[16/6/26, 10:00:00] A: <archivo adjunto: foto.jpg>\n"
        folder = _make_whatsapp_folder(tmp_path, chat_txt=chat)
        meta = _parse_chat_txt(folder)
        # foto.jpg no es audio pero sí aparece en el dict (el filtro es en ingestion)
        assert "foto.jpg" in meta


# ── Tests de normalización de timestamp ───────────────────────────────────────

class TestNormalizeTimestamp:

    def test_spanish_format(self):
        result = _normalize_timestamp("16/6/26 17:28:56")
        assert "2026-06-16" in result

    def test_full_year_format(self):
        result = _normalize_timestamp("16/06/2026 17:28:56")
        assert "2026-06-16" in result

    def test_returns_original_on_failure(self):
        weird = "not-a-date"
        assert _normalize_timestamp(weird) == weird
