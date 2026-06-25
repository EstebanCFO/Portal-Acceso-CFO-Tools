"""Orquestador principal: ingestion → conversion → transcription → output."""

import time
from dataclasses import dataclass
from pathlib import Path

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

from sound_catch.conversion import normalize
from sound_catch.ingestion import ingest
from sound_catch.models import AudioFile, Transcript
from sound_catch.output import write_output
from sound_catch.transcription import WhisperLocalBackend

console = Console(highlight=False)


@dataclass
class TranscriptionResult:
    """Resultado de procesar un único archivo."""
    source: Path
    output: Path
    transcript: Transcript
    elapsed_seconds: float
    metadata: dict  # propagado desde AudioFile (sender, timestamp, source, …)


class Pipeline:
    """Coordina todos los pasos del pipeline para uno o varios archivos.

    Args:
        model_size: modelo Whisper a usar ("tiny", "base", "small", "medium", "large-v3").
        language: código ISO 639-1 del idioma ("es", "en", ...) o None para auto-detectar.
        output_dir: carpeta donde se guardan las transcripciones.
        output_format: "txt", "srt", "vtt" o "json".
        min_confidence: descarta segmentos con confianza < este umbral [0.0–1.0].
        verify_ssl: False para entornos con proxy SSL corporativo.
    """

    def __init__(
        self,
        model_size: str = "base",
        language: str | None = None,
        output_dir: str | Path = "./transcriptions",
        output_format: str = "txt",
        min_confidence: float = 0.0,
        verify_ssl: bool = True,
    ) -> None:
        self.language = language
        self.output_dir = Path(output_dir)
        self.output_format = output_format
        self.min_confidence = min_confidence

        console.print(f"[bold cyan]>> Cargando modelo Whisper '{model_size}'...[/]")
        self._backend = WhisperLocalBackend(model_size=model_size, verify_ssl=verify_ssl)

    def run(self, source: str | Path) -> list[TranscriptionResult]:
        """Procesa un archivo, carpeta o URL. Devuelve una lista de TranscriptionResult."""
        audio_files = ingest(source)
        results: list[TranscriptionResult] = []
        conversion_tmps: list[Path] = []  # WAVs temporales de conversión

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            console=console,
        ) as progress:
            for audio in audio_files:
                task = progress.add_task(
                    f"[cyan]{audio.path.name}[/]", total=None
                )
                t0 = time.perf_counter()

                # Conversión
                progress.update(task, description=f"[yellow]Convirtiendo {audio.path.name}...[/]")
                wav_path = normalize(audio)
                if wav_path != audio.path:
                    conversion_tmps.append(wav_path)

                # Transcripción
                progress.update(task, description=f"[green]Transcribiendo {audio.path.name}...[/]")
                transcript = self._backend.transcribe(
                    wav_path,
                    language=self.language,
                    min_confidence=self.min_confidence,
                )
                transcript.metadata = audio.metadata  # propagar sender/timestamp/source

                # Salida
                out_path = write_output(
                    transcript,
                    output_dir=self.output_dir,
                    fmt=self.output_format,
                    stem=audio.path.stem,
                )

                elapsed = round(time.perf_counter() - t0, 1)
                results.append(TranscriptionResult(
                    source=audio.path,
                    output=out_path,
                    transcript=transcript,
                    elapsed_seconds=elapsed,
                    metadata=audio.metadata,
                ))

                progress.update(
                    task,
                    description=f"[bold green]OK {audio.path.name}[/] -> [dim]{out_path}[/]",
                    completed=1,
                    total=1,
                )

                # Limpiar archivo efímero (descargado de URL/Telegram) inmediatamente
                _try_unlink(audio, conversion_tmps)

        # Limpiar WAVs temporales de conversión restantes
        for tmp in conversion_tmps:
            _safe_unlink(tmp)

        return results

    def transcribe_raw(self, source: str | Path) -> list[Transcript]:
        """Igual que run() pero devuelve los Transcript directamente (sin archivo de salida)."""
        audio_files = ingest(source)
        transcripts: list[Transcript] = []
        conversion_tmps: list[Path] = []

        for audio in audio_files:
            wav_path = normalize(audio)
            if wav_path != audio.path:
                conversion_tmps.append(wav_path)

            transcript = self._backend.transcribe(
                wav_path,
                language=self.language,
                min_confidence=self.min_confidence,
            )
            transcript.metadata = audio.metadata
            transcripts.append(transcript)
            _try_unlink(audio, conversion_tmps)

        for tmp in conversion_tmps:
            _safe_unlink(tmp)

        return transcripts


# ── Helpers de limpieza ───────────────────────────────────────────────────────

def _try_unlink(audio: AudioFile, conversion_tmps: list[Path]) -> None:
    """Elimina el archivo fuente si es efímero (descargado de URL o Telegram)."""
    if not audio.is_ephemeral:
        return
    _safe_unlink(audio.path)
    # Si el WAV de conversión ya fue agregado, también eliminarlo
    if audio.path in conversion_tmps:
        conversion_tmps.remove(audio.path)


def _safe_unlink(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass
