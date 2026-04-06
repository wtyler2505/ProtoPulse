#!/usr/bin/env bash
# claude-code-changelog-check.sh — Compare your setup against Claude Code's latest features
# Fetches the latest Claude Code changelog and checks what you're NOT using yet
# Usage: bash ops/queries/claude-code-changelog-check.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== Claude Code Feature Adoption Check ==="
echo ""
echo "This script checks your Claude Code setup against known features."
echo "For the LATEST changelog, ask me to WebSearch 'Claude Code changelog 2026'"
echo "or check https://docs.anthropic.com/en/docs/claude-code"
echo ""

# Current Claude Code version
CC_VERSION=$(claude --version 2>/dev/null | head -1 || echo "unknown")
echo "Your Claude Code version: $CC_VERSION"
echo ""

echo "--- FEATURE ADOPTION STATUS ---"
echo ""

# Check agent teams
if grep -q 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS' ~/.claude/settings.json 2>/dev/null || \
   grep -q 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS' .claude/settings.json 2>/dev/null; then
  echo "  USING: Agent Teams (experimental)"
else
  echo "  NOT USING: Agent Teams — set CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 in settings.json env"
fi

# Check hooks (introduced ~Jan 2025)
hook_count=$(cat .claude/settings.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(len(v) for v in d.get('hooks',{}).values() if isinstance(v,list)))" 2>/dev/null || echo 0)
echo "  USING: Hooks ($hook_count matcher groups) — SessionStart, PostToolUse, Stop, etc."

# Check MCP servers
mcp_count=$(cat .mcp.json 2>/dev/null | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('mcpServers',{})))" 2>/dev/null || echo 0)
echo "  USING: MCP Servers ($mcp_count configured)"

# Check custom agents
agent_count=$(ls .claude/agents/*.md 2>/dev/null | wc -l)
echo "  USING: Custom Agents ($agent_count definitions)"

# Check skills/commands
skill_count=$(ls -d .claude/skills/*/SKILL.md 2>/dev/null | wc -l)
echo "  USING: Skills ($skill_count installed)"

# Check worktrees
if grep -q 'worktree\|isolation' .claude/settings.json 2>/dev/null; then
  echo "  USING: Git Worktrees for agent isolation"
else
  echo "  NOT CHECKED: Git Worktrees — available for isolated agent work"
fi

# Check plugins
plugin_count=$(ls -d .claude/plugins/*/ 2>/dev/null | wc -l)
echo "  USING: Plugins ($plugin_count installed)"

# Check memory system
if [ -d "$HOME/.claude/projects" ]; then
  memory_files=$(find "$HOME/.claude/projects" -name "*.md" 2>/dev/null | wc -l)
  echo "  USING: Auto Memory ($memory_files memory files)"
fi

# Check permissions configuration
if cat .claude/settings.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); perms=d.get('permissions',{}); print(len(perms))" 2>/dev/null | grep -q '^0$'; then
  echo "  NOT USING: Custom permissions — all tools require approval"
else
  echo "  USING: Custom permissions"
fi

echo ""
echo "--- FEATURES TO INVESTIGATE ---"
echo ""
echo "  Ask me to WebSearch any of these for the latest details:"
echo ""
echo '  1. "Claude Code agent teams features 2026"'
echo '     -> Team coordination, teammate messaging, shared tasks'
echo ""
echo '  2. "Claude Code hooks best practices 2026"'
echo '     -> Hook event types, matcher patterns, async vs blocking'
echo ""
echo '  3. "Claude Code MCP servers list 2026"'
echo '     -> What MCP servers are available and what they enable'
echo ""
echo '  4. "Claude Code worktrees isolation 2026"'
echo '     -> How to use git worktrees for safe parallel agent work'
echo ""
echo '  5. "Claude Code plugins marketplace 2026"'
echo '     -> Available plugins and how to install them'
echo ""
echo '  6. "Claude Code custom slash commands 2026"'
echo '     -> Creating and managing custom slash commands'
echo ""
echo '  7. "Claude Code settings.json reference 2026"'
echo '     -> All available configuration options'
echo ""

echo "--- POTENTIAL IMPROVEMENTS ---"
echo ""

# Check if qmd MCP is configured
if ! grep -q 'qmd' .mcp.json 2>/dev/null; then
  echo "  ADD: qmd MCP server — enables semantic search from within Claude Code"
  echo '       Add to .mcp.json: {"mcpServers":{"qmd":{"command":"qmd","args":["mcp"]}}}'
fi

# Check if Chrome DevTools MCP is configured (separate from playwright)
if ! grep -q 'chrome-devtools\|devtools' .mcp.json 2>/dev/null; then
  echo "  CHECK: Chrome DevTools MCP — may be available for DOM inspection"
fi

# Check if context7 is configured
if ! grep -q 'context7' .mcp.json 2>/dev/null; then
  echo "  CHECK: Context7 MCP — library documentation lookup"
fi

echo ""
echo "To update: ask me to research the latest Claude Code features and compare against your setup."
