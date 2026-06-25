# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

**Sound Catch** — Pipeline de transcripción de audio multi-formato y multi-origen a texto. Convierte archivos WAV, OGG, MP3, M4A, FLAC (entre otros) usando Whisper como backend principal.

## Comandos

```bash
# Instalar dependencias
pip install -r requirements.txt

# ── Transcribir ──────────────────────────────────────────────────────────────
# Archivo local (modelo ya cacheado en ~/.cache/huggingface/)
python -m sound_catch transcribe audio.ogg

# En redes corporativas con proxy SSL (solo la primera vez por modelo)
python -m sound_catch transcribe audio.ogg --no-ssl-verify

# Opciones principales
python -m sound_catch transcribe audio.ogg --lang es --output json --print
python -m sound_catch transcribe audio.ogg --output srt        # subtítulos SRT
python -m sound_catch transcribe audio.ogg --output vtt        # subtítulos WebVTT
python -m sound_catch transcribe audio.ogg --min-confidence 0.6  # filtra segmentos dudosos
python -m sound_catch transcribe audio.ogg --model small       # modelo más preciso

# Lote de archivos
python -m sound_catch transcribe ./carpeta/

# URL directa de audio
python -m sound_catch transcribe https://example.com/audio.mp3

# YouTube (requiere yt-dlp)
python -m sound_catch transcribe "https://youtube.com/watch?v=..."

# Exportación de WhatsApp (ZIP o carpeta extraída)
python -m sound_catch transcribe export_whatsapp.zip
python -m sound_catch transcribe ./WhatsApp_Chat_Export/

# ── Bot de Telegram ───────────────────────────────────────────────────────────
python -m sound_catch bot --token <TOKEN>
# o setear TELEGRAM_BOT_TOKEN en el entorno y correr:
python -m sound_catch bot

# ── Info y tests ─────────────────────────────────────────────────────────────
python -m sound_catch info   # configuración activa y formatos soportados
pytest
pytest tests/test_pipeline_integration.py -v
pytest tests/test_ingestion_whatsapp.py -v
pytest tests/test_ingestion_url.py -v
```

## Arquitectura

El flujo es siempre lineal: **Ingestion → Conversion → Transcription → Output**

- `sound_catch/ingestion/` — Router + adaptadores por origen. `__init__.py` detecta el tipo de fuente (URL, ZIP, carpeta WhatsApp, filesystem) y delega. Adaptadores: `filesystem.py`, `url.py` (directa + yt-dlp), `whatsapp.py` (ZIP y carpeta con parser de `_chat.txt`).
- `sound_catch/conversion/` — Normaliza cualquier formato a WAV 16kHz mono usando FFmpeg/pydub. Paso obligatorio antes de transcribir.
- `sound_catch/transcription/` — Backends intercambiables. `faster-whisper` es el default local. Cada segmento incluye `confidence` (derivado de `avg_logprob`). Soporta `min_confidence` para filtrar ruido.
- `sound_catch/output/` — Formateadores: TXT, SRT, VTT (separador `.`), JSON (con `confidence`, `language_probability`, `word_count`).
- `sound_catch/pipeline.py` — Orquestador. Devuelve `TranscriptionResult` (source, output, transcript, elapsed_seconds, metadata). Propaga `metadata` de AudioFile al Transcript. Limpia automáticamente archivos `is_ephemeral`.
- `sound_catch/bot/telegram_bot.py` — Bot de Telegram (long-polling). Recibe voz/audio, transcribe, responde con el texto.
- `sound_catch/cli.py` — CLI Typer. Comandos: `transcribe`, `info`, `bot`.

## Configuración

`config.yaml` define el backend activo, modelo Whisper, idioma por defecto y directorios de salida. Las credenciales cloud van en `.env` (nunca en `config.yaml`).

## Web UI (Fase 4)

```
web/
├── backend/    FastAPI :5008 — /api/health, /api/info, /api/transcribe, /api/transcribe/stream (SSE)
└── frontend/   React 19 + Vite :5009 — Design System del Portal de Acceso CFOTech
```

```bash
# Levantar todo de una vez
.\START.bat

# O manualmente:
cd web/backend  && python app.py          # :5008
cd web/frontend && npm run dev            # :5009

# Tests del frontend (Vitest)
cd web/frontend && npm test
```

El frontend sigue el Design System del Portal CFOTech (`index.css`): tokens CSS, sin Tailwind, sin MUI.
Detecta `IN_PORTAL = window.self !== window.top` y muestra el botón Salir con `postMessage`.

Para integrar en el Portal de Acceso ver `web/PORTAL_INTEGRATION.md`.

### Diarización de hablantes (opcional)
```bash
pip install pyannote.audio
# Agregar al .env: HF_TOKEN=<token> y SC_DIARIZE=true
# Requiere aceptar términos en huggingface.co/pyannote/speaker-diarization-3.1
```

## Dependencias clave

- `faster-whisper` — transcripción local (requiere modelo descargado en primer uso)
- `pydub` + FFmpeg instalado en el sistema — conversión de formatos
- `typer` — CLI
- `python-dotenv` — variables de entorno para keys cloud
