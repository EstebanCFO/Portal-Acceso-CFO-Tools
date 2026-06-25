"""Tests del adaptador de ingesta por URL (mockeando red y yt-dlp)."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from sound_catch.ingestion.url import ingest_url, _looks_like_yt_dlp_url


# ── Router ────────────────────────────────────────────────────────────────────

class TestIngestRouter:

    def test_url_routes_to_url_adapter(self, tmp_path):
        """ingest() con URL HTTP llama al adaptador URL, no al filesystem."""
        from sound_catch.ingestion import ingest

        with patch("sound_catch.ingestion.url.ingest_url") as mock_url:
            mock_url.return_value = []
            ingest("https://example.com/audio.mp3")
            mock_url.assert_called_once_with("https://example.com/audio.mp3")

    def test_zip_routes_to_whatsapp(self, tmp_path):
        fake_zip = tmp_path / "export.zip"
        import zipfile
        with zipfile.ZipFile(fake_zip, "w") as zf:
            zf.writestr("a.ogg", b"\x00")

        from sound_catch.ingestion import ingest
        with patch("sound_catch.ingestion.whatsapp.ingest_whatsapp_zip") as mock_wa:
            mock_wa.return_value = []
            ingest(str(fake_zip))
            mock_wa.assert_called_once()

    def test_whatsapp_folder_detected(self, tmp_path):
        folder = tmp_path / "chat"
        folder.mkdir()
        (folder / "_chat.txt").write_text("chat", encoding="utf-8")
        (folder / "WhatsApp Ptt 2026-06-16 at 17.28.56.ogg").write_bytes(b"\x00")

        from sound_catch.ingestion import ingest
        with patch("sound_catch.ingestion.whatsapp.ingest_whatsapp_folder") as mock_wa:
            mock_wa.return_value = []
            ingest(str(folder))
            mock_wa.assert_called_once()


# ── Descarga directa ──────────────────────────────────────────────────────────

class TestDirectDownload:

    def _mock_response(self, content: bytes = b"\x00" * 500):
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.iter_content = MagicMock(return_value=[content])
        return mock_resp

    def test_downloads_direct_url(self):
        with patch("requests.get") as mock_get:
            mock_get.return_value = self._mock_response()
            results = ingest_url("https://example.com/audio.mp3")

        assert len(results) == 1
        af = results[0]
        assert af.original_format == ".mp3"
        assert af.is_ephemeral is True
        assert af.metadata["source"] == "url"
        assert af.metadata["original_url"] == "https://example.com/audio.mp3"
        # Limpiar
        af.path.unlink(missing_ok=True)

    def test_network_error_raises(self):
        import requests
        with patch("requests.get") as mock_get:
            mock_get.side_effect = requests.RequestException("timeout")
            with pytest.raises(RuntimeError, match="No se pudo descargar"):
                ingest_url("https://example.com/audio.mp3")

    def test_url_without_extension_defaults_mp3(self):
        with patch("requests.get") as mock_get:
            mock_get.return_value = self._mock_response()
            results = ingest_url("https://example.com/stream")
        af = results[0]
        assert af.original_format == ".mp3"
        af.path.unlink(missing_ok=True)


# ── yt-dlp (YouTube) ─────────────────────────────────────────────────────────

class TestYtDlpDownload:

    def test_youtube_url_detected(self):
        """URLs de YouTube se enrutan a yt-dlp."""
        with patch("sound_catch.ingestion.url._ingest_yt_dlp") as mock_yt:
            mock_yt.return_value = []
            ingest_url("https://www.youtube.com/watch?v=abc123")
            mock_yt.assert_called_once()

    def test_youtu_be_detected(self):
        with patch("sound_catch.ingestion.url._ingest_yt_dlp") as mock_yt:
            mock_yt.return_value = []
            ingest_url("https://youtu.be/abc123")
            mock_yt.assert_called_once()

    def test_soundcloud_detected(self):
        with patch("sound_catch.ingestion.url._ingest_yt_dlp") as mock_yt:
            mock_yt.return_value = []
            ingest_url("https://soundcloud.com/artist/track")
            mock_yt.assert_called_once()

    def test_yt_dlp_not_installed_raises(self):
        import sys
        with patch.dict(sys.modules, {"yt_dlp": None}):
            with pytest.raises((RuntimeError, ImportError)):
                from sound_catch.ingestion import url as url_mod
                import importlib
                importlib.reload(url_mod)
                url_mod._ingest_yt_dlp("https://youtube.com/watch?v=x")


# ── Heurísticas ───────────────────────────────────────────────────────────────

class TestHeuristics:

    def test_soundcloud_looks_like_ytdlp(self):
        assert _looks_like_yt_dlp_url("https://soundcloud.com/x/y") is True

    def test_vimeo_looks_like_ytdlp(self):
        assert _looks_like_yt_dlp_url("https://vimeo.com/123456") is True

    def test_direct_mp3_not_ytdlp(self):
        assert _looks_like_yt_dlp_url("https://example.com/audio.mp3") is False
