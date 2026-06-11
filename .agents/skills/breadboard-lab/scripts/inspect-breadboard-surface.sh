#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"
cd "$ROOT"

echo "Breadboard Lab entrypoints"
echo
printf '%s\n' \
  "client/src/components/circuit-editor/BreadboardView.tsx" \
  "client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx" \
  "client/src/components/circuit-editor/BreadboardBoardAuditPanel.tsx" \
  "client/src/components/circuit-editor/BreadboardPartInspector.tsx" \
  "client/src/components/circuit-editor/useBreadboardCoachPlan.ts" \
  "client/src/lib/breadboard-board-audit.ts" \
  "client/src/lib/breadboard-bench.ts" \
  "client/src/lib/breadboard-part-inspector.ts" \
  "client/src/lib/circuit-editor/view-sync.ts"

echo
echo "Suggested verification commands"
printf '%s\n' \
  "npm run check" \
  "npx vitest run client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx"
