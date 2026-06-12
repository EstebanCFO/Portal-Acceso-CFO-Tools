"""
hook_post_import.py
-------------------
Hook de Claude Code (PostToolUse / Bash).

Claude Code invoca este script después de cada comando Bash.
Recibe por stdin un JSON con la info del tool use. Si el comando
ejecutado contiene "import_excel", corre la suite de tests y
devuelve el resultado para que Claude lo vea en contexto.

Configurado en .claude/settings.json:
  {
    "hooks": {
      "PostToolUse": [{
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "python \"C:\\\\Esteban CFOTech\\\\Bandas Salariales\\\\scripts\\\\hook_post_import.py\""
        }]
      }]
    }
  }

Exit codes:
  0  → todo OK (Claude continúa normal)
  1  → hay fallos de tests (Claude ve el output y puede actuar)
  2  → el comando no era un import (hook se saltea silenciosamente)
"""

import io
import json
import subprocess
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

SCRIPT_DIR = Path(__file__).parent
TEST_SCRIPT = SCRIPT_DIR / "test_injection.py"
TRIGGER_KEYWORDS = ["import_excel"]


def main():
    # Leer el JSON que Claude Code manda por stdin
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
    except (json.JSONDecodeError, Exception):
        data = {}

    # Extraer el comando bash que se ejecutó
    # Estructura: {"tool_input": {"command": "..."}, "tool_response": {...}}
    comando = ""
    tool_input = data.get("tool_input", {})
    if isinstance(tool_input, dict):
        comando = tool_input.get("command", "")
    elif isinstance(tool_input, str):
        comando = tool_input

    # Solo actuar si el comando incluye import_excel
    es_import = any(kw in comando for kw in TRIGGER_KEYWORDS)
    if not es_import:
        sys.exit(2)  # Salida silenciosa — no era un import

    # Verificar que el import no falló (exit code en tool_response)
    tool_response = data.get("tool_response", {})
    if isinstance(tool_response, dict):
        exit_code = tool_response.get("exitCode", tool_response.get("exit_code", 0))
        if exit_code not in (0, None, ""):
            print("[hook] El import terminó con error — omitiendo tests.")
            sys.exit(2)

    # Correr la suite de tests
    print("\n[hook] Import detectado — ejecutando tests de inyección...\n")

    resultado = subprocess.run(
        [sys.executable, str(TEST_SCRIPT), "--verbose"],
        capture_output=False,   # dejar que el output llegue directo a stdout
        cwd=str(SCRIPT_DIR.parent),
    )

    sys.exit(0 if resultado.returncode == 0 else 1)


if __name__ == "__main__":
    main()
