#!/bin/bash
# Hook: pre-commit-tests.sh
# Corre los tests del portal shell antes de un git commit.
# Activado desde .claude/settings.json con:
#   PreToolUse → matcher: "Bash" → if: "Bash(git commit *)"
# El filtrado por comando lo hace el campo "if" en settings.json —
# este script siempre corre tests sin condiciones adicionales.

set -e

cd "$(git rev-parse --show-toplevel)"

echo "🧪 Corriendo tests del portal antes de commitear..."
npm run test:run --silent

echo "✅ Tests pasaron — commit autorizado."
exit 0
