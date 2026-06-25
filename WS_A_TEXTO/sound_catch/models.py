"""Modelos de datos compartidos entre todas las capas del pipeline."""

import math
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class AudioFile:
    path: Path
    original_format: str        # e.g. ".ogg"
    size_bytes: int
    metadata: dict = field(default_factory=dict)
    # True para archivos descargados temporalmente (URL, Telegram); el pipeline
    # los elimina después de transcribir para no dejar basura en disco.
    is_ephemeral: bool = False


@dataclass
class Segment:
    start: float                # segundos
    end: float                  # segundos
    text: str
    confidence: float = 1.0    # [0.0–1.0]; derivado de avg_logprob de Whisper

    @classmethod
    def from_whisper(cls, seg) -> "Segment":
        """Construye un Segment a partir de un segmento de faster-whisper."""
        # avg_logprob ∈ (-∞, 0]; exp() lo lleva al intervalo (0, 1]
        confidence = round(math.exp(seg.avg_logprob), 4)
        return cls(
            start=seg.start,
            end=seg.end,
            text=seg.text.strip(),
            confidence=confidence,
        )


@dataclass
class Transcript:
    text: str
    segments: list[Segment]
    language: str
    duration: float             # segundos
    source_path: Path
    language_probability: float = 1.0
    metadata: dict = field(default_factory=dict)  # propagado desde AudioFile

    @property
    def word_count(self) -> int:
        return len(self.text.split()) if self.text else 0

    @property
    def avg_confidence(self) -> float:
        if not self.segments:
            return 0.0
        return round(sum(s.confidence for s in self.segments) / len(self.segments), 4)
