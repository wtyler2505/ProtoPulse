#!/usr/bin/env bash
# agent-topology-map.sh
# Scans .claude/agents/*.md for circular delegations (infinite loops) and builds a dependency graph.

AGENTS_DIR=".claude/agents"
echo "=== Agent Team Topology & Infinite Loop Check ==="

if [ ! -d "$AGENTS_DIR" ]; then
    echo "No agents directory found. Skipping."
    exit 0
fi

# Very rudimentary check: look for names of other agents in the markdown files
# If Agent A mentions Agent B, and Agent B mentions Agent A, that's a potential loop.

agent_files=$(ls "$AGENTS_DIR"/*.md 2>/dev/null)
if [ -z "$agent_files" ]; then
    echo "No agents defined."
    exit 0
fi

declare -A agent_names
for f in $agent_files; do
    name=$(grep -m 1 "^name:" "$f" | sed 's/^name:[[:space:]]*//' | tr -d '\r')
    if [ -n "$name" ]; then
        agent_names["$name"]="$f"
    fi
done

has_warnings=0

for name1 in "${!agent_names[@]}"; do
    file1="${agent_names[$name1]}"
    for name2 in "${!agent_names[@]}"; do
        if [ "$name1" != "$name2" ]; then
            file2="${agent_names[$name2]}"
            # Does file1 mention name2?
            if grep -q -i "$name2" "$file1"; then
                # Does file2 mention name1?
                if grep -q -i "$name1" "$file2"; then
                    echo "⚠️ CIRCULAR DELEGATION WARNING: '$name1' and '$name2' reference each other in their prompts. This may cause an infinite subagent loop!"
                    has_warnings=1
                fi
            fi
        fi
    done
done

if [ $has_warnings -eq 0 ]; then
    echo "✅ Agent Team Topology is healthy. No obvious circular delegations detected."
fi
