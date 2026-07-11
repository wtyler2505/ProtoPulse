#!/usr/bin/env bash
# fill-template.sh — Replace {{PLACEHOLDERS}} in template with detected context
# Usage: ./fill-template.sh <template-file> <context-json-file> [output-file]
# If output-file is omitted, writes to stdout

set -euo pipefail

TEMPLATE_FILE="${1:?Usage: fill-template.sh <template-file> <context-json-file> [output-file]}"
CONTEXT_FILE="${2:?Usage: fill-template.sh <template-file> <context-json-file> [output-file]}"
OUTPUT_FILE="${3:-}"

if [[ ! -f "$TEMPLATE_FILE" ]]; then
    echo "Error: Template file not found: $TEMPLATE_FILE" >&2
    exit 1
fi

if [[ ! -f "$CONTEXT_FILE" ]]; then
    echo "Error: Context file not found: $CONTEXT_FILE" >&2
    exit 1
fi

if ! command -v jq &>/dev/null; then
    echo "Error: jq is required but not installed" >&2
    exit 1
fi

# ─── EXTRACT VALUES FROM CONTEXT JSON ───────────────────────────────────────────

PROJECT_NAME=$(jq -r '.project_name // "Unknown"' "$CONTEXT_FILE")
TECH_STACK=$(jq -r '.tech_stack // "Unknown"' "$CONTEXT_FILE")
DOMAIN=$(jq -r '.domain // "Unknown"' "$CONTEXT_FILE")
PROJECT_ROOT=$(jq -r '.project_root // "."' "$CONTEXT_FILE")
KEY_FILES=$(jq -r '.key_files | join(", ")' "$CONTEXT_FILE")
COMPETITORS=$(jq -r '.competitors | join(", ")' "$CONTEXT_FILE")
PERSONAS=$(jq -r '.personas | join(", ")' "$CONTEXT_FILE")
DATE=$(jq -r '.date // "unknown"' "$CONTEXT_FILE")

# ─── PERFORM REPLACEMENTS ──────────────────────────────────────────────────────

# Read template
CONTENT=$(<"$TEMPLATE_FILE")

# Replace placeholders (using parameter expansion for safety — no sed injection)
CONTENT="${CONTENT//\{\{PROJECT_NAME\}\}/$PROJECT_NAME}"
CONTENT="${CONTENT//\{\{TECH_STACK\}\}/$TECH_STACK}"
CONTENT="${CONTENT//\{\{DOMAIN\}\}/$DOMAIN}"
CONTENT="${CONTENT//\{\{PROJECT_ROOT\}\}/$PROJECT_ROOT}"
CONTENT="${CONTENT//\{\{KEY_FILES\}\}/$KEY_FILES}"
CONTENT="${CONTENT//\{\{COMPETITORS\}\}/$COMPETITORS}"
CONTENT="${CONTENT//\{\{PERSONAS\}\}/$PERSONAS}"
CONTENT="${CONTENT//\{\{DATE\}\}/$DATE}"

# ─── VERIFY NO PLACEHOLDERS REMAIN ─────────────────────────────────────────────

REMAINING=$(echo "$CONTENT" | grep -oP '\{\{[A-Z_]+\}\}' | sort -u || true)

if [[ -n "$REMAINING" ]]; then
    echo "Warning: Unfilled placeholders remain:" >&2
    echo "$REMAINING" >&2
    # Don't fail — the template may have example {{PLACEHOLDER}} text in comments
fi

# ─── OUTPUT ─────────────────────────────────────────────────────────────────────

if [[ -n "$OUTPUT_FILE" ]]; then
    echo "$CONTENT" > "$OUTPUT_FILE"
    echo "Template filled successfully: $OUTPUT_FILE" >&2
    echo "Placeholders replaced: PROJECT_NAME, TECH_STACK, DOMAIN, PROJECT_ROOT, KEY_FILES, COMPETITORS, PERSONAS, DATE" >&2
else
    echo "$CONTENT"
fi
