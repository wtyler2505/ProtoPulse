#!/usr/bin/env bash
# Stable entrypoint for Tyler's private ProtoPulse DevLab mirror sync.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PY="${PP_NLM_PYTHON:-$HOME/.local/share/uv/tools/notebooklm-mcp-cli/bin/python}"

exec "$PY" "$ROOT/scripts/pp-nlm/devlab_mirror_sync.py" "$@"
