#!/bin/bash
# discover-extensions.sh
# Scans global and local Claude directories for installed extensions (MCPs, Plugins, Skills)
# Outputs a JSON array of discovered extensions for the Maestro to analyze.

GLOBAL_DIR="$HOME/.claude"
LOCAL_DIR=".claude"

# Extract MCP servers from global settings.json
global_mcp=$(jq -r '.mcpServers | keys | join(",")' "$GLOBAL_DIR/settings.json" 2>/dev/null || echo "")

# Extract MCP servers from local settings.json
local_mcp=$(jq -r '.mcpServers | keys | join(",")' "$LOCAL_DIR/settings.json" 2>/dev/null || echo "")

# Find plugins in local dir (plugins usually have a plugin.json)
plugins=""
if [ -d "$LOCAL_DIR" ]; then
    for plugin_file in $(find "$LOCAL_DIR" -name "plugin.json" -type f 2>/dev/null); do
        plugin_name=$(jq -r '.name' "$plugin_file" 2>/dev/null || echo "unknown")
        plugins="${plugins}${plugin_name},"
    done
fi

# Find skills in local dir
skills=""
if [ -d "$LOCAL_DIR/skills" ]; then
    for skill_file in $(find "$LOCAL_DIR/skills" -name "SKILL.md" -type f 2>/dev/null); do
        skill_name=$(grep -m 1 "^name:" "$skill_file" | sed 's/^name:[[:space:]]*//' || echo "unknown")
        if [ -n "$skill_name" ]; then
            skills="${skills}${skill_name},"
        fi
    done
fi

# Output cleanly formatted JSON
jq -n \
  --arg global_mcp "$global_mcp" \
  --arg local_mcp "$local_mcp" \
  --arg plugins "$plugins" \
  --arg skills "$skills" \
  '{
    "mcp_servers": {
      "global": ($global_mcp | split(",") | map(select(length > 0))),
      "local": ($local_mcp | split(",") | map(select(length > 0)))
    },
    "plugins": ($plugins | split(",") | map(select(length > 0))),
    "skills": ($skills | split(",") | map(select(length > 0)))
  }'
