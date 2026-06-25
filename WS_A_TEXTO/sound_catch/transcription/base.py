"""Interfaz base para backends de transcripción."""

from abc import ABC, abstractmethod
from pathlib import Path

from sound_catch.models import Transcript


class TranscriptionBackend(ABC):
    @abstractmethod
    def transcribe(self, wav_path: Path, language: str | None = None) -> Transcript:
        """Transcribe un WAV 16 kHz mono y devuelve un Transcript."""
