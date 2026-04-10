#!/usr/bin/env bash
# git-hook-sync.sh
# Analyzes conflicts between Claude Code Bash hooks and standard Git hooks

echo "{"
echo "  \"git_hook_analysis\": {"

has_conflict="false"
conflict_details=""

# Check for git pre-commit hook vs Claude Bash(git commit) hook
if [ -f ".git/hooks/pre-commit" ] && [ -x ".git/hooks/pre-commit" ]; then
    if [ -f ".claude/settings.json" ]; then
        # Check if there is a Claude hook that matches git commit
        git_claude_hook=$(jq -r '.hooks | objects | map(.[]) | .[] | select(.if | test("Bash\\\\(git commit.*\\\\)")) | .command' .claude/settings.json 2>/dev/null || echo "")
        if [ -n "$git_claude_hook" ]; then
            has_conflict="true"
            conflict_details="WARNING: You have an executable .git/hooks/pre-commit AND a Claude Code hook targeting 'git commit'. This can cause double-execution or race conditions during Claude autonomous commits."
        fi
    fi
fi

if [ "$has_conflict" == "true" ]; then
    echo "    \"status\": \"conflict_detected\","
    echo "    \"details\": \"$conflict_details\""
else
    echo "    \"status\": \"clean\","
    echo "    \"details\": \"No conflicts detected between Git hooks and Claude hooks.\""
fi

echo "  }"
echo "}"
