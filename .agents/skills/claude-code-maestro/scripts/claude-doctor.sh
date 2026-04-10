#!/usr/bin/env bash
# claude-doctor.sh: Comprehensive health, auto-healer, and conflict checker
echo "=== CLAUDE DOCTOR HEALTH & AUTO-HEAL REPORT ==="

# 1. Check settings.json JSON syntax
if [ -f ".claude/settings.json" ]; then
    if ! jq -e . >/dev/null 2>&1 <<< "$(cat .claude/settings.json)"; then
        echo "❌ FATAL: .claude/settings.json has invalid syntax!"
    else
        echo "✅ settings.json is valid."
    fi
else
    echo "⚠️ No settings.json found. Initializing empty config..."
    mkdir -p .claude
    echo "{}" > .claude/settings.json
    echo "✅ Created empty .claude/settings.json."
fi

# 2. Check claudekit config
if [ -f ".claudekit/config.json" ]; then
    if ! jq -e . >/dev/null 2>&1 <<< "$(cat .claudekit/config.json)"; then
        echo "❌ FATAL: .claudekit/config.json has invalid syntax!"
    else
        echo "✅ .claudekit/config.json is valid."
    fi
fi

# 3. Context Budget Sentinel
if [ -f "CLAUDE.md" ]; then
    LINES=$(wc -l < CLAUDE.md | awk '{print $1}')
    BYTES=$(wc -c < CLAUDE.md | awk '{print $1}')
    if [ "$LINES" -gt 200 ] || [ "$BYTES" -gt 25000 ]; then
        echo "⚠️ CONTEXT WARNING: CLAUDE.md is large ($LINES lines). Move rules to .claude/rules/."
    else
        echo "✅ CLAUDE.md footprint is healthy ($LINES lines)."
    fi
fi

# 4. Hook Executability Check & Auto-Heal
if [ -f ".claude/settings.json" ]; then
    jq -r '.hooks | objects | map(.[]) | .[] | select(.type=="command") | .command' .claude/settings.json 2>/dev/null | while read cmd; do
        # Extract the script path (simplistic parsing for direct calls)
        script_path=$(echo "$cmd" | awk '{print $1}')
        if [ -f "$script_path" ] && [ ! -x "$script_path" ]; then
            echo "⚠️ HOOK WARNING: $script_path is not executable. Auto-healing..."
            chmod +x "$script_path"
            echo "✅ Auto-healed: chmod +x $script_path"
        fi
    done
fi

# 5. Dependency Check
if ! command -v jq &> /dev/null; then
    echo "❌ DEPENDENCY ERROR: 'jq' is not installed. Maestro scripts require jq."
else
    echo "✅ 'jq' is installed."
fi

echo "=== REPORT COMPLETE ==="
