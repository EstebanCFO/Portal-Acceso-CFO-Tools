"""Bot de Telegram para recibir audios y responder con la transcripción.

Usa long-polling (sin necesidad de servidor público ni webhook).

Uso:
    python -m sound_catch bot --token <BOT_TOKEN> [--lang es] [--model base]
"""

import asyncio
import logging
import os
import tempfile
from pathlib import Path

from rich.console import Console

console = Console(highlight=False)
log = logging.getLogger(__name__)


async def run_bot(
    token: str,
    model_size: str = "base",
    language: str | None = None,
    min_confidence: float = 0.0,
    verify_ssl: bool = True,
) -> None:
    """Inicia el bot en modo long-polling. Bloquea hasta Ctrl+C."""
    from telegram import Update
    from telegram.ext import Application, MessageHandler, filters, ContextTypes

    from sound_catch.pipeline import Pipeline

    # Inicializar pipeline una sola vez (el modelo se carga aquí)
    pipeline = Pipeline(
        model_size=model_size,
        language=language,
        output_dir=Path(tempfile.gettempdir()) / "sc_bot_transcriptions",
        output_format="txt",
        min_confidence=min_confidence,
        verify_ssl=verify_ssl,
    )

    async def handle_audio(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Maneja mensajes de voz, audio y documentos de audio."""
        msg = update.message
        if not msg:
            return

        # Detectar qué tipo de audio es
        file_obj = msg.voice or msg.audio
        doc = msg.document
        if not file_obj and doc and _is_audio_doc(doc.file_name or ""):
            file_obj = doc

        if not file_obj:
            return

        await msg.reply_text("Recibido, transcribiendo...")

        # Determinar extensión
        if msg.voice:
            suffix = ".ogg"
        elif msg.audio and msg.audio.file_name:
            suffix = Path(msg.audio.file_name).suffix or ".mp3"
        elif doc and doc.file_name:
            suffix = Path(doc.file_name).suffix or ".ogg"
        else:
            suffix = ".ogg"

        # Descargar a temporal
        tg_file = await file_obj.get_file()
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, prefix="sc_tg_") as tmp:
            tmp_path = Path(tmp.name)

        try:
            await tg_file.download_to_drive(str(tmp_path))
            transcripts = pipeline.transcribe_raw(tmp_path)

            if transcripts and transcripts[0].text:
                t = transcripts[0]
                header = (
                    f"Idioma: {t.language} ({t.language_probability:.0%}) | "
                    f"Duracion: {int(t.duration)}s | "
                    f"Palabras: {t.word_count}\n\n"
                )
                await msg.reply_text(header + t.text)
            else:
                await msg.reply_text("No se detectó audio con voz en el archivo.")

        except Exception as exc:
            log.exception("Error transcribiendo archivo de Telegram")
            await msg.reply_text(f"Error al transcribir: {exc}")
        finally:
            tmp_path.unlink(missing_ok=True)

    async def handle_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        await update.message.reply_text(
            "Hola! Soy Sound Catch.\n"
            "Enviame un mensaje de voz o un archivo de audio y te devuelvo la transcripcion.\n\n"
            f"Modelo activo: {model_size} | Idioma: {language or 'auto'}"
        )

    app = Application.builder().token(token).build()

    from telegram.ext import CommandHandler
    app.add_handler(CommandHandler("start", handle_start))
    app.add_handler(MessageHandler(filters.VOICE | filters.AUDIO | filters.Document.AUDIO, handle_audio))

    console.print(f"[bold green]Bot iniciado[/] (modelo: {model_size}, idioma: {language or 'auto'})")
    console.print("[dim]Ctrl+C para detener[/]")

    await app.run_polling(allowed_updates=["message"])


def _is_audio_doc(filename: str) -> bool:
    from sound_catch.ingestion.filesystem import SUPPORTED_FORMATS
    return Path(filename).suffix.lower() in SUPPORTED_FORMATS
