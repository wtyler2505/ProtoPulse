#!/usr/bin/env bash
# claude-doctor.sh: Comprehensive health and conflict checker
echo "=== CLAUDE DOCTOR HEALTH REPORT ==="

# 1. Check settings.json JSON syntax
if [ -f ".claude/settings.json" ]; then
    if ! jq -e . >/dev/null 2>&1 <<< "$(cat .claude/settings.json)"; then
        echo "❌ FATAL: .claude/settings.json has invalid syntax!"
    else
        echo "✅ settings.json is valid."
    fi
else
    echo "⚠️ No settings.json found."
fi

# 2. Context Budget Sentinel
if [ -f "CLAUDE.md" ]; then
    LINES=$(wc -l < CLAUDE.md)
    BYTES=$(wc -c < CLAUDE.md)
    if [ "$LINES" -gt 200 ] || [ "$BYTES" -gt 25000 ]; then
        echo "⚠️ CONTEXT WARNING: CLAUDE.md is large ($LINES lines). Move rules to .claude/rules/."
    else
        echo "✅ CLAUDE.md footprint is healthy ($LINES lines)."
    fi
fi

# 3. Hook Executability Check
if [ -f ".claude/settings.json" ]; then
    jq -r '.hooks | objects | map(.[]) | .[] | select(.type=="command") | .command' .claude/settings.json 2>/dev/null | while read cmd; do
        # Extract the script path (simplistic parsing for direct calls)
        script_path=$(echo "$cmd" | awk '{print $1}')
        if [ -f "$script_path" ] && [ ! -x "$script_path" ]; then
            echo "❌ HOOK ERROR: Hook script $script_path is not executable! Run chmod +x."
        fi
    done
fi

echo "=== REPORT COMPLETE ==="
