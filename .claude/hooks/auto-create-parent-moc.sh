#!/usr/bin/env bash
# auto-create-parent-moc.sh
#
# PostToolUse hook: when a knowledge/ note is written with a `topics:` frontmatter
# field that wiki-links to a non-existent MOC, auto-create a stub MOC so the
# navigation layer never drifts behind atomic knowledge extraction.
#
# Closes the gap between the vault's stated `automation: full` dimension and
# the reality that MOC stubs were being hand-created after every batch extract.
#
# Triggers only for files under knowledge/ — skips queue/, templates/, self/, etc.
#
# Safety behaviors:
#   - Auto-generated stubs are marked `auto_generated: true` in frontmatter so
#     they can be batch-identified later (e.g., `rg auto_generated knowledge/`).
#   - Every stub creation is appended to ops/observations/auto-stubs-pending.md
#     with a timestamp and the source note that triggered it. Humans can then
#     decide whether to flesh out Core Ideas or delete the stub if it was a typo.
#   - If ops/observations/ doesn't exist (e.g., running outside the vault), the
#     hook exits silently with status 0.
#   - Only reads `topics:` field — ignores wiki-links in body content. Topics
#     is the explicit navigation contract; body links are opportunistic.
#
# Exit codes:
#   0 — success (including no-ops)
#   1 — unexpected error (never blocks the edit; hook is informational)

set -euo pipefail

# Read the hook JSON from stdin (Claude Code hook protocol)
HOOK_INPUT="$(cat)"

# Extract the tool name and file path from the hook payload
TOOL_NAME="$(echo "$HOOK_INPUT" | jq -r '.tool_name // ""')"
FILE_PATH="$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // ""')"

# Only act on Write/Edit/MultiEdit tools
case "$TOOL_NAME" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

# Only act on files under knowledge/ (relative to repo root)
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
KNOWLEDGE_DIR="$REPO_ROOT/knowledge"
TEMPLATES_DIR="$REPO_ROOT/templates"
OBS_FILE="$REPO_ROOT/ops/observations/auto-stubs-pending.md"

# Bail if the written file isn't in knowledge/
case "$FILE_PATH" in
  "$KNOWLEDGE_DIR"/*.md) ;;
  *) exit 0 ;;
esac

# Bail if the file doesn't exist (Edit on a deleted file, etc.)
[ -f "$FILE_PATH" ] || exit 0

# Extract topics: field from YAML frontmatter (best-effort parser — bash, no YAML lib)
# The convention is:
#   topics:
#     - "[[target1]]"
#     - "[[target2]]"
# OR inline:
#   topics: ["[[target1]]", "[[target2]]"]
#
# We grep wiki-links inside the frontmatter block only (first --- to second ---).
FRONTMATTER="$(awk '/^---$/{count++; if (count==2) exit} count==1 {print}' "$FILE_PATH")"

# Look for `topics:` line and the block-scalar entries following it
# Also accept inline arrays. Extract every [[target]] inside the topics section.
TOPICS_BLOCK="$(echo "$FRONTMATTER" | awk '
  /^topics:/{in_topics=1; print; next}
  in_topics && /^[a-zA-Z_]/{in_topics=0}
  in_topics {print}
')"

# If no topics field, nothing to do
[ -z "$TOPICS_BLOCK" ] && exit 0

# Extract target slugs from topics block. Handles both:
#   v1 (legacy):    - "[[target]]"  or  topics: ["[[target]]", ...]
#   v2 (canonical): - target        or  topics: [target, ...]
# Strip display-alias after pipe when present in v1 format.
# v2 bare slugs must match pattern ^[a-z][a-z0-9-]+ to avoid picking up YAML keywords.
mapfile -t V1_TARGETS < <(echo "$TOPICS_BLOCK" | grep -oE '\[\[[^]|]+(\|[^]]+)?\]\]' | sed -E 's/\[\[([^]|]+)(\|[^]]+)?\]\]/\1/')
mapfile -t V2_TARGETS < <(echo "$TOPICS_BLOCK" | grep -oE '^\s*-\s+[a-z][a-z0-9-]+\s*$' | sed -E 's/^\s*-\s+([a-z][a-z0-9-]+)\s*$/\1/')
mapfile -t TARGETS < <(printf '%s\n' "${V1_TARGETS[@]}" "${V2_TARGETS[@]}" | grep -v '^$' | sort -u)

# Track any stubs we create this run for the observation log
CREATED=()

for target in "${TARGETS[@]}"; do
  # Skip if the target already resolves
  target_path="$KNOWLEDGE_DIR/${target}.md"
  [ -f "$target_path" ] && continue

  # Skip common non-MOC sentinel targets
  case "$target" in
    index|""|"#"*) continue ;;
  esac

  # Pull the description from the source note's frontmatter to seed a
  # halfway-reasonable stub description. If unavailable, use a generic one.
  SOURCE_DESC="$(echo "$FRONTMATTER" | grep -E '^description:' | head -1 | sed -E 's/^description:\s*"?([^"]*)"?\s*$/\1/')"
  SOURCE_STEM="$(basename "$FILE_PATH" .md)"

  # v2-compliant stub description: ≤140 chars, no timestamp bloat (logged separately).
  # Truncate source stem if needed to keep under cap.
  SHORT_STEM="${SOURCE_STEM:0:80}"
  STUB_DESC="Auto-stub MOC — awaiting Core Ideas. Seeded from ${SHORT_STEM}. See ops/observations/auto-stubs-pending.md for triage log."
  # Hard-truncate if still over 140 (defensive)
  STUB_DESC="${STUB_DESC:0:140}"

  # Compose stub body using the template's shape. Keep it minimal so humans
  # know at a glance the stub needs fleshing out.
  # v2-compliant frontmatter: bare-slug topics (no [[...]] wrapping), valid type enum.
  cat > "$target_path" <<STUB
---
name: "${target}"
description: "${STUB_DESC}"
type: moc
auto_generated: true
auto_generated_source: "${SOURCE_STEM}"
auto_generated_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
topics:
  - index
---

# ${target}

**Auto-generated stub.** A sibling note (\`${SOURCE_STEM}\`) referenced this
topic map in its \`topics:\` field, but the MOC did not exist yet. This stub
was created by \`.claude/hooks/auto-create-parent-moc.sh\` to keep the
navigation layer in sync with atomic knowledge.

**Next steps for a human:**

1. Decide whether this topic is a genuine MOC (then write Core Ideas and a
   real description) or a typo in the source note (then \`rm\` this file and
   fix the source).
2. Remove the \`auto_generated: true\` frontmatter flag once Core Ideas are
   populated.
3. Consider whether additional parent topics belong in the \`topics:\` field.

## Knowledge Notes

_Populated by \`/connect\` or manual curation._

## Open Questions

_(populated by /extract)_

---

Topics:
- [[index]]
STUB

  CREATED+=("$target")
done

# Append to observation log if we created anything (and the file exists)
if [ ${#CREATED[@]} -gt 0 ] && [ -d "$(dirname "$OBS_FILE")" ]; then
  {
    # Seed file with header if missing
    if [ ! -f "$OBS_FILE" ]; then
      cat <<HEADER
---
description: "Auto-created parent-MOC stubs pending human triage"
type: observation
---

# Auto-Stubs Pending Triage

The \`auto-create-parent-moc.sh\` PostToolUse hook appends an entry here
every time it creates a stub MOC. Items stay here until a human either
(a) fleshes out Core Ideas and removes the \`auto_generated: true\` flag,
or (b) deletes the stub because it was a typo.

## Log

HEADER
    fi
    echo ""
    echo "### $(date -u +%Y-%m-%dT%H:%M:%SZ) — from \`$(basename "$FILE_PATH" .md)\`"
    for t in "${CREATED[@]}"; do
      echo "- [[${t}]] — stub created at \`knowledge/${t}.md\`"
    done
  } >> "$OBS_FILE"
fi

exit 0
