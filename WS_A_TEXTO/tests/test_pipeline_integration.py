"""Tests de integración del pipeline completo.

Estos tests usan audio sintético (tono + silencio) para verificar que el pipeline
corre de punta a punta sin requerir archivos de audio reales en el repositorio.

Whisper puede devolver texto vacío o mínimo para audio sintético — lo que se
valida aquí es que el pipeline no falla y genera el archivo de salida.
"""

import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

from sound_catch.models import Segment, Transcript
from sound_catch.pipeline import Pipeline, TranscriptionResult


# ── Fixture: transcript mockeado ───────────────────────────────────────────────

def _mock_transcript(source: Path) -> Transcript:
    return Transcript(
        text="Este es un texto de prueba de integracion.",
        segments=[
            Segment(start=0.0, end=1.0, text="Este es un texto", confidence=0.95),
            Segment(start=1.0, end=2.5, text="de prueba de integracion.", confidence=0.88),
        ],
        language="es",
        language_probability=0.99,
        duration=2.5,
        source_path=source,
    )


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_silent_wav(path: Path, duration_ms: int = 500) -> Path:
    """Crea un WAV de silencio puro usando pydub (sin importar ffmpeg)."""
    from pydub import AudioSegment
    silence = AudioSegment.silent(duration=duration_ms, frame_rate=16000)
    silence = silence.set_channels(1)
    silence.export(str(path), format="wav")
    return path


# ── Tests con backend mockeado ─────────────────────────────────────────────────

class TestPipelineMocked:
    """Prueba el orquestador con el backend de transcripción mockeado."""

    @pytest.fixture
    def wav_file(self, tmp_path) -> Path:
        return _make_silent_wav(tmp_path / "test.wav")

    def _pipeline_with_mock(self, tmp_path, **kwargs) -> tuple[Pipeline, MagicMock]:
        with patch("sound_catch.pipeline.WhisperLocalBackend") as MockBackend:
            mock_instance = MagicMock()
            MockBackend.return_value = mock_instance
            p = Pipeline(output_dir=tmp_path / "out", **kwargs)
        return p, mock_instance

    def test_run_single_file_txt(self, tmp_path, wav_file):
        pipeline, mock_backend = self._pipeline_with_mock(tmp_path, output_format="txt")
        mock_backend.transcribe.return_value = _mock_transcript(wav_file)

        results = pipeline.run(wav_file)

        assert len(results) == 1
        r = results[0]
        assert isinstance(r, TranscriptionResult)
        assert r.output.suffix == ".txt"
        assert r.output.exists()
        assert "integracion" in r.output.read_text(encoding="utf-8")

    def test_run_single_file_json(self, tmp_path, wav_file):
        pipeline, mock_backend = self._pipeline_with_mock(tmp_path, output_format="json")
        mock_backend.transcribe.return_value = _mock_transcript(wav_file)

        results = pipeline.run(wav_file)

        import json
        data = json.loads(results[0].output.read_text(encoding="utf-8"))
        assert data["language"] == "es"
        assert data["language_probability"] == 0.99
        assert len(data["segments"]) == 2
        assert "confidence" in data["segments"][0]

    def test_run_single_file_srt(self, tmp_path, wav_file):
        pipeline, mock_backend = self._pipeline_with_mock(tmp_path, output_format="srt")
        mock_backend.transcribe.return_value = _mock_transcript(wav_file)

        results = pipeline.run(wav_file)
        content = results[0].output.read_text(encoding="utf-8")
        assert "00:00:00,000 --> 00:00:01,000" in content

    def test_run_single_file_vtt(self, tmp_path, wav_file):
        pipeline, mock_backend = self._pipeline_with_mock(tmp_path, output_format="vtt")
        mock_backend.transcribe.return_value = _mock_transcript(wav_file)

        results = pipeline.run(wav_file)
        content = results[0].output.read_text(encoding="utf-8")
        assert content.startswith("WEBVTT")
        assert "00:00:00.000 --> 00:00:01.000" in content

    def test_run_batch_directory(self, tmp_path):
        audio_dir = tmp_path / "audios"
        audio_dir.mkdir()
        files = [
            _make_silent_wav(audio_dir / "a.wav"),
            _make_silent_wav(audio_dir / "b.wav"),
        ]

        pipeline, mock_backend = self._pipeline_with_mock(tmp_path, output_format="txt")
        mock_backend.transcribe.side_effect = [
            _mock_transcript(files[0]),
            _mock_transcript(files[1]),
        ]

        results = pipeline.run(audio_dir)
        assert len(results) == 2
        assert mock_backend.transcribe.call_count == 2

    def test_result_has_elapsed_time(self, tmp_path, wav_file):
        pipeline, mock_backend = self._pipeline_with_mock(tmp_path)
        mock_backend.transcribe.return_value = _mock_transcript(wav_file)

        results = pipeline.run(wav_file)
        assert results[0].elapsed_seconds >= 0.0

    def test_min_confidence_passed_to_backend(self, tmp_path, wav_file):
        pipeline, mock_backend = self._pipeline_with_mock(tmp_path, min_confidence=0.7)
        mock_backend.transcribe.return_value = _mock_transcript(wav_file)

        pipeline.run(wav_file)

        call_kwargs = mock_backend.transcribe.call_args[1]
        assert call_kwargs.get("min_confidence") == 0.7

    def test_transcribe_raw(self, tmp_path, wav_file):
        pipeline, mock_backend = self._pipeline_with_mock(tmp_path)
        expected = _mock_transcript(wav_file)
        mock_backend.transcribe.return_value = expected

        transcripts = pipeline.transcribe_raw(wav_file)
        assert len(transcripts) == 1
        assert transcripts[0].text == expected.text

    def test_ogg_conversion_then_transcribe(self, tmp_path):
        """Verifica que archivos no-WAV pasan por conversión antes de transcribir."""
        from pydub import AudioSegment
        ogg_path = tmp_path / "test.ogg"
        silence = AudioSegment.silent(duration=300, frame_rate=16000).set_channels(1)
        silence.export(str(ogg_path), format="ogg")

        pipeline, mock_backend = self._pipeline_with_mock(tmp_path, output_format="txt")
        mock_backend.transcribe.return_value = _mock_transcript(ogg_path)

        results = pipeline.run(ogg_path)
        assert len(results) == 1
        # El archivo de salida debe tener el stem del OGG original
        assert results[0].output.stem == "test"


# ── Tests del filtro de confianza (sin pipeline, directo en backend) ───────────

class TestConfidenceFilter:
    def test_segment_below_threshold_excluded(self):
        """El backend descarta segmentos con confianza < min_confidence."""
        from unittest.mock import MagicMock, patch
        import math

        mock_seg_high = MagicMock()
        mock_seg_high.start, mock_seg_high.end = 0.0, 1.0
        mock_seg_high.text = "texto confiable"
        mock_seg_high.avg_logprob = -0.1   # exp(-0.1) ≈ 0.90

        mock_seg_low = MagicMock()
        mock_seg_low.start, mock_seg_low.end = 1.0, 2.0
        mock_seg_low.text = "texto dudoso"
        mock_seg_low.avg_logprob = -5.0    # exp(-5) ≈ 0.007

        mock_info = MagicMock()
        mock_info.language = "es"
        mock_info.language_probability = 0.95
        mock_info.duration = 2.0

        from sound_catch.transcription.whisper_local import WhisperLocalBackend

        with patch.object(WhisperLocalBackend, "__init__", return_value=None):
            backend = WhisperLocalBackend.__new__(WhisperLocalBackend)
            backend._model = MagicMock()
            backend._model.transcribe.return_value = (
                [mock_seg_high, mock_seg_low],
                mock_info,
            )

            transcript = backend.transcribe(Path("x.wav"), min_confidence=0.5)

        assert len(transcript.segments) == 1
        assert transcript.segments[0].text == "texto confiable"
