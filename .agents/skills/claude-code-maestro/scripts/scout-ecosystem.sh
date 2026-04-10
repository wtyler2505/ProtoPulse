#!/usr/bin/env bash
# scout-ecosystem.sh
# Proactively searches the top community registries for Claude Code extensions.

QUERY="$@"
if [ -z "$QUERY" ]; then
    echo "Usage: $0 <search_term>"
    exit 1
fi

echo "=== ECOSYSTEM SCOUT REPORT FOR: '$QUERY' ==="

echo -e "\n--- 1. PLAYBOOKS DIRECTORY (Skills & Agents) ---"
# Playbooks CLI searches GitHub for agent skills
npx -y playbooks search "$QUERY" 2>/dev/null | head -n 25 || echo "No results found on Playbooks."

echo -e "\n--- 2. SMITHERY REGISTRY (MCP Servers) ---"
# Smithery CLI searches for MCP servers
npx -y @smithery/cli search "$QUERY" 2>/dev/null | head -n 25 || echo "No results found on Smithery."

echo -e "\n--- 3. DEEP WEB DIRECTIVE FOR MAESTRO ---"
echo "Maestro: The CLI searches above only cover registered extensions."
echo "To ensure absolute perfection, you MUST now execute the following queries using your google_web_search tool:"
echo "- site:github.com \"Claude Code\" \"$QUERY\" (skill OR plugin OR mcp OR hook)"
echo "- site:aitmpl.com \"$QUERY\""
echo "Synthesize the CLI results AND your web search results into a highly intelligent, project-aware recommendation for the user."
