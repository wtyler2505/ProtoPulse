#!/usr/bin/env bash
# Populate pp-feat-ai-integration (Tier-2). Curated source set:
#   - Server-side: ai.ts (vault auto-injection), ai-tools.ts, circuit-ai.ts, circuit-ai/prompt.ts, component-ai.ts, routes/chat.ts, routes/chat-branches.ts, routes/supply-chain.ts
#   - Client-side: ai-co-designer.ts, ai-goal-parser.ts, ai-review-queue.ts, ai-root-cause.ts, ai-safety-mode.ts, ai-tutor.ts, breadboard-ai-prompts.ts, voice-ai.ts, audit-trail.ts
#   - Plans: gemini-cli-tuneup, prompt-to-printer-workflow
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
source "$ROOT/scripts/pp-nlm/lib/source-helpers.sh"
pp_require_auth
ALIAS="pp-feat-ai-integration"

# Server-side AI surface
for f in \
  server/ai.ts \
  server/ai-tools.ts \
  server/circuit-ai.ts \
  server/circuit-ai/prompt.ts \
  server/component-ai.ts \
  server/routes/chat.ts \
  server/routes/chat-branches.ts \
  server/routes/supply-chain.ts \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

# server/ai-tools/ subdir
for f in $ROOT/server/ai-tools/*.ts; do
  [ -f "$f" ] && add_source_text "$ALIAS" "$f"
done

# Client-side AI surface
for f in \
  client/src/lib/ai-co-designer.ts \
  client/src/lib/ai-goal-parser.ts \
  client/src/lib/ai-review-queue.ts \
  client/src/lib/ai-root-cause.ts \
  client/src/lib/ai-safety-mode.ts \
  client/src/lib/ai-tutor.ts \
  client/src/lib/breadboard-ai-prompts.ts \
  client/src/lib/voice-ai.ts \
  client/src/lib/audit-trail.ts \
; do
  [ -f "$ROOT/$f" ] && add_source_text "$ALIAS" "$ROOT/$f"
done

# Plans
for plan in \
  docs/superpowers/plans/2026-04-10-gemini-cli-tuneup.md \
  docs/plans/prompt-to-printer-workflow.md \
; do
  [ -f "$ROOT/$plan" ] && add_source_text "$ALIAS" "$ROOT/$plan"
done

echo "Done populating $ALIAS"
echo "Source count: $(pp_manifest_count "$ALIAS")"
