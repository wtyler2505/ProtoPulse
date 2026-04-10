#!/usr/bin/env bash
# analyze-telemetry.sh
# Gathers token footprint data and evaluates the health of the local Claude environment.

echo "{"
echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","
echo "  \"telemetry\": {"

# Size of .claude directory
if [ -d ".claude" ]; then
    size=$(du -sh .claude 2>/dev/null | cut -f1 | xargs)
    echo "    \"local_claude_size\": \"$size\","
else
    echo "    \"local_claude_size\": \"0\","
fi

# Count of path-scoped rules
rules_count=$(find .claude/rules -type f -name "*.md" 2>/dev/null | wc -l | xargs)
echo "    \"path_scoped_rules_count\": $rules_count,"

# Count of agents
agents_count=$(find .claude/agents -type f -name "*.md" 2>/dev/null | wc -l | xargs)
echo "    \"agents_count\": $agents_count,"

# Count of active hooks in local settings.json
if [ -f ".claude/settings.json" ]; then
    hooks_count=$(jq -r '.hooks | map(length) | add' ".claude/settings.json" 2>/dev/null || echo "0")
    # If null or empty string, default to 0
    if [ "$hooks_count" = "null" ] || [ -z "$hooks_count" ]; then hooks_count=0; fi
    echo "    \"active_hooks_count\": $hooks_count,"
else
    echo "    \"active_hooks_count\": 0,"
fi

# CLAUDE.md footprint
if [ -f "CLAUDE.md" ]; then
    lines=$(wc -l < CLAUDE.md | xargs)
    bytes=$(wc -c < CLAUDE.md | xargs)
    echo "    \"claude_md_lines\": $lines,"
    echo "    \"claude_md_bytes\": $bytes,"
    
    if [ "$lines" -gt 200 ] || [ "$bytes" -gt 25000 ]; then
        echo "    \"claude_md_health\": \"WARNING: Over 200 lines or 25KB. Recommend splitting into path-scoped rules.\""
    else
        echo "    \"claude_md_health\": \"Healthy (Under 200 lines / 25KB)\""
    fi
else
    echo "    \"claude_md_lines\": 0,"
    echo "    \"claude_md_bytes\": 0,"
    echo "    \"claude_md_health\": \"Not found. No global context loaded.\""
fi

echo "  }"
echo "}"
