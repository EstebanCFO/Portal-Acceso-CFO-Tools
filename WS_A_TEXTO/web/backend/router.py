"""
router.py — Sound Catch API Router (importable por portal_server.py o app.py standalone).

Diseño dual:
  · Standalone (app.py):  app.include_router(router, prefix='/api')
    → rutas: /api/health, /api/transcribe, /api/summarize/stream, …
  · Gateway (portal_server.py): app.include_router(router, prefix='/api/sound-catch')
    → rutas: /api/sound-catch/health, /api/sound-catch/transcribe, …

Lee su propia configuración desde .env SIN contaminar os.environ
(usa dotenv_values en lugar de load_dotenv).
"""

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path

from dotenv import dotenv_values
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

# ── Config desde .env propio (no poluciona os.environ del proceso padre) ──────
_HERE      = Path(__file__).parent
_SC_ENV    = dotenv_values(_HERE / ".env")   # lee sin escribir a os.environ

# Helpers para leer config: preferir .env propio, fallback a os.environ
def _cfg(key: str, default: str = "") -> str:
    return _SC_ENV.get(key) or os.environ.get(key, default)

SC_MODEL          = _cfg("SC_MODEL", "base")
SC_LANGUAGE       = _cfg("SC_LANGUAGE") or None
SC_MIN_CONF       = float(_cfg("SC_MIN_CONFIDENCE", "0.0"))
SC_NO_SSL         = _cfg("SC_NO_SSL_VERIFY", "false").lower() == "true"
SC_DIARIZE        = _cfg("SC_DIARIZE", "false").lower() == "true"
HF_TOKEN          = _cfg("HF_TOKEN") or None
ANTHROPIC_API_KEY = _cfg("ANTHROPIC_API_KEY") or None
SC_SUMMARY_MODEL  = _cfg("SC_SUMMARY_MODEL", "claude-haiku-4-5-20251001")

# Asegurar que sound_catch sea importable (útil cuando importa el gateway)
_SC_ROOT = _HERE.parent.parent.parent   # …/Sound Catch/
if str(_SC_ROOT) not in sys.path:
    sys.path.insert(0, str(_SC_ROOT))

# ── Router ────────────────────────────────────────────────────────────────────
router = APIRouter(tags=["Sound Catch"])

# Lazy-init del pipeline (carga el modelo Whisper en el primer request)
_pipeline = None


def _get_pipeline(model: str, language: str | None, min_confidence: float):
    global _pipeline
    from sound_catch.pipeline import Pipeline
    if _pipeline is None or _pipeline._backend._model_size_or_path != model:
        _pipeline = Pipeline(
            model_size=model,
            language=language,
            output_format="json",
            min_confidence=min_confidence,
            verify_ssl=not SC_NO_SSL,
        )
    return _pipeline


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "model": SC_MODEL}


@router.get("/info")
def info():
    from sound_catch.ingestion.filesystem import SUPPORTED_FORMATS
    from sound_catch.transcription.whisper_local import VALID_MODELS
    return {
        "supported_formats":  sorted(SUPPORTED_FORMATS),
        "models":             sorted(VALID_MODELS),
        "default_model":      SC_MODEL,
        "default_language":   SC_LANGUAGE,
        "diarization_available": _check_diarization(),
    }


@router.post("/transcribe")
async def transcribe(
    file: UploadFile    = File(...),
    lang: str           = Form(None),
    model: str          = Form(None),
    fmt: str            = Form("json"),
    min_confidence: float = Form(0.0),
    diarize: bool       = Form(False),
):
    """Transcribe un archivo de audio. Devuelve el transcript completo.
    Para archivos largos usar /transcribe/stream (SSE).
    """
    suffix = Path(file.filename or "audio.ogg").suffix or ".ogg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, prefix="sc_web_") as tmp:
        tmp.write(await file.read())
        tmp_path = Path(tmp.name)
    try:
        transcript = await asyncio.to_thread(
            _run_transcription, tmp_path, lang, model, min_confidence, diarize
        )
        return transcript
    finally:
        tmp_path.unlink(missing_ok=True)


@router.post("/transcribe/stream")
async def transcribe_stream(
    file: UploadFile    = File(...),
    lang: str           = Form(None),
    model: str          = Form(None),
    min_confidence: float = Form(0.0),
    diarize: bool       = Form(False),
):
    """Transcribe con SSE — ideal para archivos largos.

    Emite:
      {"type":"progress","step":"saving"|"converting"|"transcribing","message":"..."}
      {"type":"segment","index":N,"start":0.0,"end":1.5,"text":"...","confidence":0.9}
      {"type":"done","transcript":{...}}
      {"type":"error","message":"..."}
    """
    suffix  = Path(file.filename or "audio.ogg").suffix or ".ogg"
    content = await file.read()

    async def generate():
        tmp_path = None
        try:
            yield _sse({"type": "progress", "step": "saving",
                        "message": f"Recibiendo {file.filename}..."})

            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, prefix="sc_web_") as tmp:
                tmp.write(content)
                tmp_path = Path(tmp.name)

            yield _sse({"type": "progress", "step": "converting",
                        "message": "Normalizando audio..."})
            from sound_catch.ingestion import ingest
            from sound_catch.conversion import normalize
            audio_files = ingest(tmp_path)
            wav_path    = await asyncio.to_thread(normalize, audio_files[0])

            yield _sse({"type": "progress", "step": "transcribing",
                        "message": "Transcribiendo..."})

            resolved_model = model or SC_MODEL
            resolved_lang  = lang  or SC_LANGUAGE

            from sound_catch.transcription.whisper_local import WhisperLocalBackend
            backend    = WhisperLocalBackend(model_size=resolved_model, verify_ssl=not SC_NO_SSL)
            transcript = await asyncio.to_thread(
                backend.transcribe, wav_path, resolved_lang, min_confidence
            )

            for i, seg in enumerate(transcript.segments):
                yield _sse({
                    "type":       "segment",
                    "index":      i,
                    "start":      round(seg.start, 2),
                    "end":        round(seg.end, 2),
                    "text":       seg.text,
                    "confidence": seg.confidence,
                })

            if diarize and _check_diarization():
                yield _sse({"type": "progress", "step": "diarizing",
                            "message": "Identificando hablantes..."})
                transcript = await asyncio.to_thread(_run_diarization, transcript, wav_path)

            yield _sse({"type": "done", "transcript": _transcript_to_dict(transcript)})

            if wav_path != tmp_path:
                wav_path.unlink(missing_ok=True)

        except Exception as exc:
            yield _sse({"type": "error", "message": str(exc)})
        finally:
            if tmp_path:
                tmp_path.unlink(missing_ok=True)

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Resumen Ejecutivo IA ──────────────────────────────────────────────────────

_LANG_NAMES: dict[str, str] = {
    "es": "español", "en": "English", "pt": "português",
    "fr": "français", "de": "deutsch", "it": "italiano",
}

_SUMMARY_PROMPT = """\
Eres un asistente ejecutivo. Analiza la siguiente transcripcion y genera:

1. Un resumen ejecutivo concreto y directo de lo tratado (maximo 3 parrafos cortos).
2. Una lista de temas potenciales para trabajar como objetivos concretos y accionables.

Transcripcion:
---
{text}
---

Responde en {lang_name}. Usa EXACTAMENTE este formato, sin texto adicional antes ni despues:

## Resumen Ejecutivo
[resumen aqui]

## Objetivos Potenciales
- [objetivo 1]
- [objetivo 2]
- [agrega todos los que sean necesarios]"""


@router.get("/summarize/available")
def summarize_available():
    return {"available": bool(ANTHROPIC_API_KEY), "model": SC_SUMMARY_MODEL}


@router.post("/summarize/stream")
async def summarize_stream(request: Request):
    """Genera resumen ejecutivo via SSE streaming con Claude.

    Body JSON: { "text": "...", "language": "es" }
    Emite: {"type":"chunk","text":"..."} | {"type":"done"} | {"type":"error","message":"..."}
    """
    body     = await request.json()
    text     = (body.get("text") or "").strip()
    language = (body.get("language") or "es").strip()

    if not text:
        raise HTTPException(status_code=400, detail="text es requerido")
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY no configurado. Agregar al .env del backend y reiniciar.",
        )

    words = text.split()
    if len(words) > 60_000:
        text = " ".join(words[:60_000]) + "\n[...truncada...]"

    lang_name = _LANG_NAMES.get(language[:2], language)
    prompt    = _SUMMARY_PROMPT.format(text=text, lang_name=lang_name)

    async def generate():
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
            async with client.messages.stream(
                model=SC_SUMMARY_MODEL, max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                async for chunk in stream.text_stream:
                    yield _sse({"type": "chunk", "text": chunk})
            yield _sse({"type": "done"})
        except Exception as exc:
            yield _sse({"type": "error", "message": str(exc)})

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _run_transcription(tmp_path, lang, model, min_confidence, diarize):
    from sound_catch.ingestion import ingest
    from sound_catch.conversion import normalize
    from sound_catch.transcription.whisper_local import WhisperLocalBackend

    audio_files = ingest(tmp_path)
    wav_path    = normalize(audio_files[0])
    backend     = WhisperLocalBackend(model_size=model or SC_MODEL, verify_ssl=not SC_NO_SSL)
    transcript  = backend.transcribe(wav_path, language=lang or SC_LANGUAGE,
                                     min_confidence=min_confidence)

    if diarize and _check_diarization():
        transcript = _run_diarization(transcript, wav_path)

    if wav_path != tmp_path:
        wav_path.unlink(missing_ok=True)

    return _transcript_to_dict(transcript)


def _run_diarization(transcript, wav_path: Path):
    try:
        from pyannote.audio import Pipeline as PyannotePipeline
        diarization_pipeline = PyannotePipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1", use_auth_token=HF_TOKEN,
        )
        diarization  = diarization_pipeline(str(wav_path))
        speaker_turns = [
            (turn.start, turn.end, speaker)
            for turn, _, speaker in diarization.itertracks(yield_label=True)
        ]
        from sound_catch.models import Segment
        transcript.segments = [
            Segment(start=s.start, end=s.end, text=s.text, confidence=s.confidence,
                    speaker=_best_speaker(s.start, s.end, speaker_turns))
            for s in transcript.segments
        ]
    except Exception:
        pass
    return transcript


def _best_speaker(start: float, end: float, turns: list) -> str | None:
    best, best_overlap = None, 0.0
    for t_start, t_end, speaker in turns:
        overlap = max(0, min(end, t_end) - max(start, t_start))
        if overlap > best_overlap:
            best_overlap, best = overlap, speaker
    return best


def _check_diarization() -> bool:
    try:
        import pyannote.audio  # noqa: F401
        return bool(HF_TOKEN)
    except ImportError:
        return False


def _transcript_to_dict(transcript) -> dict:
    return {
        "language":             transcript.language,
        "language_probability": transcript.language_probability,
        "duration":             round(transcript.duration, 2),
        "word_count":           transcript.word_count,
        "avg_confidence":       transcript.avg_confidence,
        "text":                 transcript.text,
        "segments": [
            {
                "start":      round(s.start, 2),
                "end":        round(s.end, 2),
                "text":       s.text,
                "confidence": s.confidence,
                "speaker":    getattr(s, "speaker", None),
            }
            for s in transcript.segments
        ],
    }


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
