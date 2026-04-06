#!/usr/bin/env bash
# infra-gaps.sh — Find missing Claude Code infrastructure based on codebase needs
# Cross-references what the codebase DOES against what the infra PROVIDES
# Usage: bash ops/queries/infra-gaps.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== Infrastructure Gap Analysis ==="
echo ""

echo "--- MISSING HOOKS: Things that could break with no guard ---"
echo ""

# Check if there's a pre-push hook
if ! grep -q 'push' .claude/settings.json 2>/dev/null; then
  echo "  GAP: No pre-push hook — code could be pushed without passing checks"
fi

# Check if there's a hook for database migrations
if ! grep -q 'db:push\|migration\|drizzle' .claude/hooks/*.sh 2>/dev/null; then
  echo "  GAP: No database migration guard — schema changes could be forgotten"
fi

# Check if there's a hook for .env file protection
if ! grep -q '\.env' .claude/hooks/protected-files.sh 2>/dev/null; then
  echo "  GAP: .env files may not be protected from accidental commits"
else
  echo "  OK: protected-files.sh guards sensitive files"
fi

# Check if commit message format is enforced
if ! grep -q 'commit\|CommitCreate' .claude/settings.json 2>/dev/null; then
  echo "  INFO: No commit message format hook — commits may be inconsistent"
fi

echo ""
echo "--- MISSING SKILLS: Commands the codebase needs ---"
echo ""

# Check for common development workflow gaps
skills=$(ls -d .claude/skills/*/SKILL.md 2>/dev/null | xargs -I{} dirname {} | xargs -I{} basename {})

# Check for deployment skill
echo "$skills" | grep -q 'deploy\|ship' && echo "  OK: deploy/ship skill exists" || echo "  GAP: No deployment skill"

# Check for migration skill
echo "$skills" | grep -q 'migrate\|migration' || echo "  GAP: No database migration skill"

# Check for benchmark skill
echo "$skills" | grep -q 'bench\|perf\|performance' || echo "  GAP: No performance benchmarking skill"

# Check for changelog skill
echo "$skills" | grep -q 'changelog\|release' || echo "  INFO: No changelog/release skill"

echo ""
echo "--- MISSING AGENTS: Domain expertise gaps ---"
echo ""

agents=$(ls .claude/agents/*.md 2>/dev/null | xargs -I{} basename {} .md)

# Cross-reference against codebase domains
echo "$agents" | grep -qi 'react\|frontend' && echo "  OK: React/frontend agent" || echo "  GAP: No React agent"
echo "$agents" | grep -qi 'typescript\|type' && echo "  OK: TypeScript agent" || echo "  GAP: No TypeScript agent"
echo "$agents" | grep -qi 'node\|backend\|express' && echo "  OK: Node/backend agent" || echo "  GAP: No Node agent"
echo "$agents" | grep -qi 'test\|vitest\|jest' && echo "  OK: Testing agent" || echo "  GAP: No testing agent"
echo "$agents" | grep -qi 'security\|audit' && echo "  OK: Security agent" || echo "  GAP: No security agent"
echo "$agents" | grep -qi 'eda\|circuit\|electronics' && echo "  OK: EDA domain agent" || echo "  GAP: No EDA domain agent"
echo "$agents" | grep -qi 'database\|postgres\|sql' && echo "  OK: Database agent" || echo "  GAP: No database agent"
echo "$agents" | grep -qi 'css\|style\|design' && echo "  OK: CSS/design agent" || echo "  GAP: No CSS/design agent"
echo "$agents" | grep -qi 'performance\|perf' && echo "  OK: Performance agent" || echo "  GAP: No performance agent"
echo "$agents" | grep -qi 'documentation\|doc' && echo "  OK: Documentation agent" || echo "  GAP: No documentation agent"

echo ""
echo "--- MCP SERVER GAPS ---"
echo ""

# Check what MCP servers are configured
if [ -f ".mcp.json" ]; then
  servers=$(python3 -c "import json; d=json.load(open('.mcp.json')); print('\n'.join(d.get('mcpServers',{}).keys()))" 2>/dev/null || echo "")
  echo "$servers" | grep -qi 'postgres\|database' && echo "  OK: Database MCP server" || echo "  GAP: No database MCP — can't query DB directly"
  echo "$servers" | grep -qi 'playwright\|browser\|chrome' && echo "  OK: Browser automation MCP" || echo "  GAP: No browser MCP"
  echo "$servers" | grep -qi 'desktop\|commander' && echo "  OK: Desktop commander MCP" || echo "  GAP: No file operations MCP"
  echo "$servers" | grep -qi 'qmd\|semantic\|search' && echo "  OK: Semantic search MCP" || echo "  GAP: No semantic search MCP — vault search is limited"
  echo "$servers" | grep -qi 'arduino\|serial\|hardware' && echo "  OK: Hardware MCP" || echo "  INFO: No hardware MCP (Arduino CLI available separately)"
  echo "$servers" | grep -qi 'github\|git' || echo "  INFO: No GitHub MCP — using gh CLI directly"
else
  echo "  FAIL: No .mcp.json file found"
fi

echo ""
echo "--- CLAUDE.MD COVERAGE ---"
echo ""

# Check what the CLAUDE.md covers
clauses=0
for topic in "Build" "Test" "Security" "Guard" "Agent" "Hook" "Knowledge" "Gap" "Style" "Architecture"; do
  if grep -qi "$topic" CLAUDE.md 2>/dev/null; then
    echo "  OK: $topic section present"
    clauses=$((clauses + 1))
  else
    echo "  GAP: No $topic section"
  fi
done
echo "  Coverage: $clauses/10 key topics"

echo ""
echo "--- HOOK PIPELINE ORDERING ---"
echo ""
echo "  PostToolUse fires in settings.json array order:"
echo "  Current order on Write/Edit:"
cat .claude/settings.json 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
groups = d.get('hooks', {}).get('PostToolUse', [])
for i, g in enumerate(groups):
    matcher = g.get('matcher', '*')
    if 'Write' not in matcher and 'Edit' not in matcher and matcher != '*':
        continue
    for h in g.get('hooks', []):
        cmd = h.get('command', '?').split('/')[-1]
        is_async = h.get('async', False)
        print(f'    {i+1}. {cmd}' + (' (async)' if is_async else ''))
" 2>/dev/null

echo ""
echo "  If a blocking hook fails early, later hooks don't run."
echo "  Async hooks run independently."
