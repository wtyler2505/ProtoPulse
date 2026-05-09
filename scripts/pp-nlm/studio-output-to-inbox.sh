#!/usr/bin/env bash
# scripts/pp-nlm/studio-output-to-inbox.sh
# Phase 10 bidirectional bridge — forward leg (Studio output → inbox/ note).
#
# Usage:
#   bash scripts/pp-nlm/studio-output-to-inbox.sh <archive-path>
#
# Reads the archived Studio artifact, generates an inbox/ note with full Ars
# Contexta v2 frontmatter (provenance.source: nlm-studio), routes through the
# existing /extract pipeline. Idempotent via ops/index/nlm-index.json — if the
# artifact_id is already mapped to a knowledge note, skips (loop prevention).
#
# Inputs supported (resolved by extension):
#   .md   — report (Briefing Doc, Study Guide, Blog Post, Create Your Own)
#   .json — quiz / flashcards / data_table / mind_map / infographic — serialized to markdown outline
#   .mp3  — audio overview — transcript extracted via `nlm download audio --transcript-only` (best effort)
#   .pdf / .pptx — slide_deck — surfaces title + slide-count + URL only (manual extract recommended)
#   .mp4  — video overview — title + URL only (manual extract recommended; transcript not auto-extractable)
#
# Output: inbox/<YYYY-MM-DD>-nlm-<artifact-id>-<slug>.md

set -uo pipefail

ROOT="/home/wtyler/Projects/ProtoPulse"
ARCHIVE_MANIFEST="$ROOT/docs/nlm-archive/manifest.json"
NLM_INDEX="$ROOT/ops/index/nlm-index.json"
INBOX="$ROOT/inbox"
mkdir -p "$INBOX" "$(dirname "$NLM_INDEX")"
[ -f "$NLM_INDEX" ] || echo "{}" > "$NLM_INDEX"

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <archive-path>" >&2
  exit 2
fi

ARCHIVE_PATH="$1"
if [ ! -f "$ARCHIVE_PATH" ]; then
  echo "FAIL: archive file not found: $ARCHIVE_PATH" >&2
  exit 3
fi

# Lookup the manifest entry for this artifact (path-based reverse lookup)
META=$(jq -e --arg p "$ARCHIVE_PATH" '
  to_entries | map(select(.value.path == $p)) | .[0] // empty
' "$ARCHIVE_MANIFEST" 2>/dev/null)
if [ -z "$META" ]; then
  echo "WARN: archive path not in $ARCHIVE_MANIFEST — proceeding with degraded metadata" >&2
  ARTIFACT_ID="unknown-$(date +%s)"
  ALIAS="unknown"
  ARTIFACT_TYPE=$(basename "$ARCHIVE_PATH" | sed 's/.*\.//')
  TITLE="$(basename "$ARCHIVE_PATH" | sed 's/\.[^.]*$//')"
  ARCHIVED_DATE=$(date -u +%Y-%m-%d)
else
  ARTIFACT_ID=$(echo "$META" | jq -r '.key')
  ALIAS=$(echo "$META" | jq -r '.value.alias')
  ARTIFACT_TYPE=$(echo "$META" | jq -r '.value.type')
  TITLE=$(echo "$META" | jq -r '.value.title')
  ARCHIVED_DATE=$(echo "$META" | jq -r '.value.archived' | cut -dT -f1)
fi

# Loop-prevention check — if this artifact_id already mapped, skip
if jq -e --arg id "$ARTIFACT_ID" '.[$id]' "$NLM_INDEX" >/dev/null 2>&1; then
  KNOWLEDGE_PATH=$(jq -r --arg id "$ARTIFACT_ID" '.[$id].knowledge_path' "$NLM_INDEX")
  echo "skip: artifact_id $ARTIFACT_ID already extracted to $KNOWLEDGE_PATH"
  exit 0
fi

# Build inbox slug
SLUG=$(echo "$TITLE" | tr ' /' '_-' | tr -dc 'a-zA-Z0-9_-' | head -c 60)
INBOX_FILE="$INBOX/${ARCHIVED_DATE}-nlm-${ARTIFACT_ID}-${SLUG}.md"

if [ -f "$INBOX_FILE" ]; then
  echo "skip: inbox file already exists at $INBOX_FILE"
  exit 0
fi

# Build NotebookLM web-UI URL (best-effort — actual format may need adjustment)
NB_ID=$(nlm alias get "$ALIAS" 2>/dev/null | tail -1)
if [ -n "$NB_ID" ]; then
  NLM_URL="https://notebooklm.google.com/notebook/${NB_ID}?artifactId=${ARTIFACT_ID}"
else
  NLM_URL=""
fi

# Resolve the body content per artifact type
extract_body() {
  case "$ARTIFACT_TYPE" in
    report)
      cat "$ARCHIVE_PATH"
      ;;
    quiz|flashcards|data_table|mind_map|infographic)
      # Serialize JSON to readable markdown
      echo "## Artifact JSON content"
      echo
      echo '```json'
      jq '.' "$ARCHIVE_PATH" 2>/dev/null || cat "$ARCHIVE_PATH"
      echo '```'
      ;;
    audio)
      # Best-effort: nlm may expose --transcript-only; fall back to manual note
      echo "## Audio overview transcript (auto-extraction attempt)"
      echo
      TRANSCRIPT=$(nlm download audio "$ALIAS" --transcript-only 2>/dev/null || echo "")
      if [ -n "$TRANSCRIPT" ]; then
        echo "$TRANSCRIPT"
      else
        echo "_Transcript not auto-extractable. Manual transcription needed._"
        echo
        echo "Audio file: \`$ARCHIVE_PATH\`"
        echo "Open in browser: $NLM_URL"
      fi
      ;;
    slide_deck|video)
      echo "## ${ARTIFACT_TYPE^} (manual extraction required)"
      echo
      echo "File: \`$ARCHIVE_PATH\`"
      echo "Open in NotebookLM: $NLM_URL"
      echo
      echo "_Auto-extraction not implemented for this type. Tyler: review the file, mine atomic claims manually, save extracted notes via /extract or direct knowledge/ writes (after the file is in inbox/)._"
      ;;
    *)
      echo "## Unknown artifact type: $ARTIFACT_TYPE"
      echo
      echo "File: \`$ARCHIVE_PATH\`"
      ;;
  esac
}

# Compose the inbox file with full Ars Contexta v2 frontmatter
{
  echo "---"
  echo "name: ${SLUG}"
  echo "description: NotebookLM Studio ${ARTIFACT_TYPE} from ${ALIAS} on ${ARCHIVED_DATE} — ${TITLE}"
  echo "topics:"
  echo "  - notebooklm-studio"
  echo "  - ${ALIAS}"
  echo "audience:"
  echo "  - intermediate"
  echo "  - expert"
  echo "provenance:"
  echo "  source: nlm-studio"
  echo "  url: ${NLM_URL}"
  echo "  artifact_id: ${ARTIFACT_ID}"
  echo "  artifact_type: ${ARTIFACT_TYPE}"
  echo "  notebook_alias: ${ALIAS}"
  echo "  archive_path: ${ARCHIVE_PATH}"
  echo "  verification_date: ${ARCHIVED_DATE}"
  echo "  verifier: nlm-studio-auto-archive"
  echo "claims: |"
  echo "  Auto-generated NotebookLM Studio artifact awaiting /extract for atomic claim mining."
  echo "reviewed: ${ARCHIVED_DATE}"
  echo "---"
  echo
  echo "# ${TITLE}"
  echo
  echo "**Source notebook:** ${ALIAS}"
  echo "**Artifact type:** ${ARTIFACT_TYPE}"
  echo "**Archived:** ${ARCHIVED_DATE}"
  echo "**Artifact ID:** \`${ARTIFACT_ID}\`"
  echo
  extract_body
} > "$INBOX_FILE"

echo "wrote: $INBOX_FILE"
echo
echo "Next step: invoke /extract on this file to mine atomic claims into knowledge/."
echo "After extraction, ops/index/nlm-index.json will be updated to map artifact_id → knowledge_path."
