#!/usr/bin/env bash
# Ars Contexta -- PostToolUse (Write) hook: validate knowledge vault notes
# Validates files in knowledge/ and inbox/ against schema templates
# Checks: YAML frontmatter exists, required fields present, enum values valid

set -euo pipefail

VAULT_MARKER=".arscontexta"
[[ -f "$VAULT_MARKER" ]] || { echo "{}"; exit 0; }

# Get the file path from the tool input
FILE_PATH="${CLAUDE_TOOL_INPUT_FILE_PATH:-}"
[[ -z "$FILE_PATH" ]] && { echo "{}"; exit 0; }

# Only validate vault files
case "$FILE_PATH" in
  knowledge/*.md|*/knowledge/*.md)
    # Skip index.md -- it's a hub, not a regular note
    [[ "$(basename "$FILE_PATH")" == "index.md" ]] && { echo "{}"; exit 0; }

    # Check for YAML frontmatter
    if ! head -1 "$FILE_PATH" | grep -q '^---'; then
      echo "VALIDATION WARNING: $FILE_PATH missing YAML frontmatter"
      exit 0
    fi
    # Determine if this is a topic map or a knowledge note
    if grep -q '^type: moc' "$FILE_PATH" 2>/dev/null; then
      # Topic map: requires description
      if ! grep -q '^description:' "$FILE_PATH" 2>/dev/null; then
        echo "VALIDATION WARNING: $FILE_PATH (topic-map) missing required field: description"
      fi
    else
      # Knowledge note: requires description, type, topics
      for field in description type topics; do
        if ! grep -q "^${field}:" "$FILE_PATH" 2>/dev/null; then
          echo "VALIDATION WARNING: $FILE_PATH missing required field: $field"
        fi
      done

      # Validate type enum if present
      note_type=$(grep '^type:' "$FILE_PATH" 2>/dev/null | head -1 | sed 's/^type: *//' | tr -d '"' | tr -d "'")
      if [[ -n "$note_type" && "$note_type" != "moc" ]]; then
        case "$note_type" in
          claim|decision|concept|insight|pattern|debt-note|need) ;;
          *) echo "VALIDATION WARNING: $FILE_PATH has invalid type: '$note_type' (expected: claim, decision, concept, insight, pattern, debt-note, need)" ;;
        esac
      fi

      # Validate confidence enum if present
      confidence=$(grep '^confidence:' "$FILE_PATH" 2>/dev/null | head -1 | sed 's/^confidence: *//' | tr -d '"' | tr -d "'")
      if [[ -n "$confidence" ]]; then
        case "$confidence" in
          proven|likely|experimental|outdated) ;;
          *) echo "VALIDATION WARNING: $FILE_PATH has invalid confidence: '$confidence' (expected: proven, likely, experimental, outdated)" ;;
        esac
      fi
    fi

    # Check for Topics footer (both note types should have topic map membership)
    if ! grep -q '^Topics:' "$FILE_PATH" 2>/dev/null; then
      echo "VALIDATION WARNING: $FILE_PATH missing Topics footer (topic map membership)"
    fi
    ;;

  inbox/*.md|*/inbox/*.md)
    # Source capture: check for YAML frontmatter
    if ! head -1 "$FILE_PATH" | grep -q '^---'; then
      echo "VALIDATION WARNING: $FILE_PATH missing YAML frontmatter"
    fi
    # Check for required source-capture fields
    for field in source_url captured_date extraction_status; do
      if ! grep -q "^${field}:" "$FILE_PATH" 2>/dev/null; then
        echo "VALIDATION WARNING: $FILE_PATH (source-capture) missing field: $field"
      fi
    done
    ;;
  ops/observations/*.md|*/ops/observations/*.md)
    # Observation: check for required fields
    if ! head -1 "$FILE_PATH" | grep -q '^---'; then
      echo "VALIDATION WARNING: $FILE_PATH missing YAML frontmatter"
    fi
    for field in observed_date category; do
      if ! grep -q "^${field}:" "$FILE_PATH" 2>/dev/null; then
        echo "VALIDATION WARNING: $FILE_PATH (observation) missing field: $field"
      fi
    done
    ;;

  *)
    # Not a vault content file, skip validation
    ;;
esac

exit 0