"""Backend de transcripción usando faster-whisper (inferencia local)."""

from pathlib import Path

from faster_whisper import WhisperModel

from sound_catch.models import Segment, Transcript
from sound_catch.transcription.base import TranscriptionBackend

# Tamaños de modelo disponibles en faster-whisper
VALID_MODELS = {"tiny", "base", "small", "medium", "large-v2", "large-v3"}


def _patch_httpx_ssl() -> None:
    """Deshabilita la verificación SSL en httpx (necesario en redes corporativas).

    Aplica dos estrategias complementarias:
    1. Monkey-patch de httpx.Client.__init__ para forzar verify=False en todas
       las instancias nuevas (necesario porque HuggingFace Hub crea sus clientes
       internamente).
    2. configure_http_backend de huggingface_hub como respaldo si está disponible.
    """
    import warnings

    warnings.filterwarnings("ignore", message=".*Unverified HTTPS.*")

    try:
        import httpx

        _orig_client_init = httpx.Client.__init__

        def _no_verify_init(self, *args, **kwargs):
            kwargs["verify"] = False
            _orig_client_init(self, *args, **kwargs)

        httpx.Client.__init__ = _no_verify_init  # type: ignore[method-assign]
    except Exception:
        pass

    try:
        import httpx
        from huggingface_hub import configure_http_backend

        configure_http_backend(
            backend_factory=lambda: httpx.Client(verify=False, timeout=120.0)
        )
    except Exception:
        pass


class WhisperLocalBackend(TranscriptionBackend):
    """Corre Whisper localmente. El modelo se descarga en el primer uso (~MB según tamaño).

    Args:
        model_size: "base" es el balance calidad/velocidad recomendado para starters.
        device: "cpu" o "cuda" si hay GPU disponible.
        compute_type: "int8" para CPU (máxima compatibilidad y velocidad).
        verify_ssl: False para entornos con proxy/SSL corporativo (deshabilita la
                    verificación al descargar el modelo desde HuggingFace).
    """

    def __init__(
        self,
        model_size: str = "base",
        device: str = "cpu",
        compute_type: str = "int8",
        verify_ssl: bool = True,
    ) -> None:
        if model_size not in VALID_MODELS:
            raise ValueError(f"model_size debe ser uno de: {', '.join(sorted(VALID_MODELS))}")
        if not verify_ssl:
            _patch_httpx_ssl()
        self._model = WhisperModel(model_size, device=device, compute_type=compute_type)

    def transcribe(
        self,
        wav_path: Path,
        language: str | None = None,
        min_confidence: float = 0.0,
    ) -> Transcript:
        """Transcribe un WAV 16 kHz mono.

        Args:
            wav_path: ruta al archivo WAV normalizado.
            language: código ISO 639-1 o None para auto-detectar.
            min_confidence: descarta segmentos con confianza < este umbral (0.0 = sin filtro).
        """
        segments_iter, info = self._model.transcribe(
            str(wav_path),
            language=language,
            beam_size=5,
        )

        segments: list[Segment] = []
        texts: list[str] = []

        for seg in segments_iter:
            built = Segment.from_whisper(seg)
            if not built.text:
                continue
            if built.confidence < min_confidence:
                continue
            segments.append(built)
            texts.append(built.text)

        return Transcript(
            text=" ".join(texts),
            segments=segments,
            language=info.language,
            duration=info.duration,
            source_path=wav_path,
            language_probability=round(info.language_probability, 4),
        )
