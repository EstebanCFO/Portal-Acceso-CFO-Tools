#!/bin/bash
# Hook: pre-commit-tests.sh
# Ejecuta los tests del portal shell antes de permitir un commit.
# Configurar en .claude/settings.json o settings.local.json:
#
#   "hooks": {
#     "PreToolUse": [{
#       "matcher": "Bash",
#       "hooks": [{ "type": "command", "command": "bash .claude/hooks/pre-commit-tests.sh" }]
#     }]
#   }
#
# Para activarlo globalmente en el proyecto, agregar a settings.local.json.

set -e

# Solo correr ante commits de git
if [[ "$CLAUDE_TOOL_INPUT" != *"git commit"* ]]; then
  exit 0
fi

echo "🧪 Verificando tests antes de commitear..."

cd "$(git rev-parse --show-toplevel)"

# Correr tests del portal shell
npm run test:run --silent

EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ Tests fallaron — commit bloqueado."
  echo "   Corregí los tests antes de commitear."
  exit 1
fi

echo "✅ Todos los tests pasaron."
exit 0
