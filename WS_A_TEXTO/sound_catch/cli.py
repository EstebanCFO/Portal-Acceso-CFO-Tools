"""CLI de Sound Catch — `python -m sound_catch transcribe <fuente>`."""

import datetime
from pathlib import Path
from typing import Optional

import typer
import yaml
from rich.console import Console
from rich.table import Table

app = typer.Typer(
    name="sound-catch",
    help="Transcribe audios de multiples formatos a texto.",
    add_completion=False,
)
console = Console(highlight=False)

_CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"


def _load_config() -> dict:
    if _CONFIG_PATH.exists():
        with open(_CONFIG_PATH, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}


# ── Comandos ──────────────────────────────────────────────────────────────────

@app.command(name="info")
def info() -> None:
    """Muestra los formatos de audio soportados y la configuracion activa."""
    from sound_catch.ingestion.filesystem import SUPPORTED_FORMATS

    cfg = _load_config()
    console.print("\n[bold]Sound Catch[/] — configuracion activa\n")
    console.print(f"  Backend   : {cfg.get('transcription', {}).get('backend', 'whisper_local')}")
    console.print(f"  Modelo    : {cfg.get('transcription', {}).get('model', 'base')}")
    console.print(f"  Idioma    : {cfg.get('transcription', {}).get('language') or 'auto-deteccion'}")
    console.print(f"  Formato   : {cfg.get('output', {}).get('default_format', 'txt')}")
    console.print(f"  Directorio: {cfg.get('output', {}).get('directory', './transcriptions')}")
    console.print(f"\n  Formatos soportados: {', '.join(sorted(SUPPORTED_FORMATS))}\n")


@app.command()
def transcribe(
    source: str = typer.Argument(..., help="Archivo de audio o carpeta a transcribir."),
    lang: Optional[str] = typer.Option(
        None, "--lang", "-l",
        help="Codigo de idioma ISO 639-1 (ej. 'es', 'en'). Por defecto: auto-deteccion.",
    ),
    output: Optional[str] = typer.Option(
        None, "--output", "-o",
        help="Formato de salida: txt | srt | vtt | json.",
    ),
    model: Optional[str] = typer.Option(
        None, "--model", "-m",
        help="Modelo Whisper: tiny | base | small | medium | large-v3.",
    ),
    out_dir: Optional[str] = typer.Option(
        None, "--out-dir", "-d",
        help="Carpeta de salida. Por defecto: ./transcriptions.",
    ),
    min_confidence: float = typer.Option(
        0.0, "--min-confidence", "-c",
        help="Descarta segmentos con confianza menor a este valor [0.0-1.0].",
        min=0.0, max=1.0,
    ),
    print_text: bool = typer.Option(
        False, "--print", "-p",
        help="Imprime el texto transcripto en la terminal ademas de escribir el archivo.",
    ),
    no_ssl_verify: bool = typer.Option(
        False, "--no-ssl-verify",
        help="Deshabilita verificacion SSL al descargar el modelo (redes corporativas).",
    ),
) -> None:
    """Transcribe un archivo de audio o todos los audios de una carpeta."""
    from sound_catch.pipeline import Pipeline

    cfg = _load_config()
    t_cfg = cfg.get("transcription", {})
    o_cfg = cfg.get("output", {})

    resolved_model = model or t_cfg.get("model", "base")
    resolved_lang = lang or t_cfg.get("language") or None
    resolved_fmt = output or o_cfg.get("default_format", "txt")
    resolved_dir = Path(out_dir) if out_dir else Path(o_cfg.get("directory", "./transcriptions"))

    try:
        pipeline = Pipeline(
            model_size=resolved_model,
            language=resolved_lang,
            output_dir=resolved_dir,
            output_format=resolved_fmt,
            min_confidence=min_confidence,
            verify_ssl=not no_ssl_verify,
        )
        results = pipeline.run(source)
    except (FileNotFoundError, ValueError) as exc:
        console.print(f"[bold red]Error:[/] {exc}")
        raise typer.Exit(code=1) from exc

    # ── Resumen ───────────────────────────────────────────────────────────────
    console.print()
    if len(results) == 1:
        r = results[0]
        t = r.transcript
        dur = str(datetime.timedelta(seconds=int(t.duration)))
        console.print(
            f"[bold green]OK[/] "
            f"Idioma: [cyan]{t.language}[/] ({t.language_probability:.0%}) | "
            f"Duracion: [cyan]{dur}[/] | "
            f"Palabras: [cyan]{t.word_count}[/] | "
            f"Segmentos: [cyan]{len(t.segments)}[/] | "
            f"Confianza: [cyan]{t.avg_confidence:.0%}[/] | "
            f"Tiempo: [cyan]{r.elapsed_seconds}s[/]"
        )
        console.print(f"  -> [dim]{r.output}[/]")
        if print_text:
            console.print(f"\n[bold]Transcripcion:[/]\n{t.text}\n")
    else:
        _print_batch_summary(results, print_text)


@app.command(name="bot")
def bot(
    token: Optional[str] = typer.Option(
        None, "--token", "-t",
        help="Token del bot de Telegram. Alternativa: variable de entorno TELEGRAM_BOT_TOKEN.",
        envvar="TELEGRAM_BOT_TOKEN",
    ),
    lang: Optional[str] = typer.Option(None, "--lang", "-l", help="Idioma ISO 639-1 o auto."),
    model: Optional[str] = typer.Option(None, "--model", "-m", help="Modelo Whisper."),
    min_confidence: float = typer.Option(0.0, "--min-confidence", "-c", min=0.0, max=1.0),
    no_ssl_verify: bool = typer.Option(False, "--no-ssl-verify"),
) -> None:
    """Inicia el bot de Telegram que transcribe mensajes de voz y audio."""
    import asyncio
    from sound_catch.bot.telegram_bot import run_bot

    cfg = _load_config()
    t_cfg = cfg.get("transcription", {})

    resolved_token = token
    if not resolved_token:
        console.print("[bold red]Error:[/] Necesitas un token de bot de Telegram.")
        console.print("  Obtenerlo via @BotFather en Telegram, luego:")
        console.print("  python -m sound_catch bot --token <TOKEN>")
        console.print("  o setear la variable de entorno TELEGRAM_BOT_TOKEN")
        raise typer.Exit(code=1)

    asyncio.run(run_bot(
        token=resolved_token,
        model_size=model or t_cfg.get("model", "base"),
        language=lang or t_cfg.get("language") or None,
        min_confidence=min_confidence,
        verify_ssl=not no_ssl_verify,
    ))


def _print_batch_summary(results, print_text: bool) -> None:
    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Archivo", style="dim", no_wrap=True)
    table.add_column("Idioma", justify="center")
    table.add_column("Palabras", justify="right")
    table.add_column("Confianza", justify="right")
    table.add_column("Tiempo", justify="right")
    table.add_column("Salida", style="dim")

    for r in results:
        t = r.transcript
        table.add_row(
            r.source.name,
            t.language,
            str(t.word_count),
            f"{t.avg_confidence:.0%}",
            f"{r.elapsed_seconds}s",
            str(r.output),
        )
        if print_text:
            console.print(f"\n[bold]{r.source.name}:[/]\n{t.text}\n")

    console.print(table)
    console.print(f"\n[bold green]OK[/] {len(results)} archivo(s) generado(s).")
