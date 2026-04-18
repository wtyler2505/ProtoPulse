#!/bin/bash
# PreToolUse hook: Remind about vault citation ONLY when editing hardware component files.
# Replaces the dumb prompt-style hook that fired on every Edit regardless of path.
#
# Triggers only when file_path matches:
#   - shared/verified-boards/
#   - shared/verified_boards/
#   - standard-library/
#
# Exit 0 = allow (with optional advisory message via stdout)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // .file_path // empty')

# No path = nothing to check
if [ -z "$FILE_PATH" ]; then
  echo "{}"; exit 0
fi

# Only fire for actual hardware-component paths
case "$FILE_PATH" in
  */shared/verified-boards/*|*/shared/verified_boards/*|*/standard-library/*)
    # Skip for test files, index files, type files — those aren't hardware definitions
    case "$FILE_PATH" in
      */__tests__/*|*/types.ts|*/index.ts|*/to-part-state.ts)
        echo "{}"; exit 0
        ;;
    esac
    cat <<'EOF'
HARDWARE ENFORCEMENT: You are modifying a hardware component file. Before proceeding:
1. Search knowledge/ for the part exact physical dimensions, pinout, and color.
2. If the part is not in the vault, use web search to discover exact real-world specs (mm, header spacing, pin voltage).
3. Do NOT invent, hallucinate, or approximate dimensions or pinouts.
4. New hardware knowledge must be routed through inbox/ then /arscontexta:extract.
EOF
    exit 0
    ;;
esac

# Not a hardware file — silent pass
echo "{}"; exit 0
