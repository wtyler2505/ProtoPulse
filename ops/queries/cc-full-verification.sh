#!/usr/bin/env bash
# cc-full-verification.sh — Comprehensive Claude Code infrastructure verification
# Based on official Claude Code v2.1.89+ documentation (Context7)
# Checks EVERY required and optional configuration detail
#
# Usage: bash ops/queries/cc-full-verification.sh

set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

PASS=0; WARN=0; FAIL=0; INFO=0
p() { echo "  [PASS] $1"; PASS=$((PASS+1)); }
w() { echo "  [WARN] $1"; WARN=$((WARN+1)); }
f() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }
i() { echo "  [INFO] $1"; INFO=$((INFO+1)); }

echo "============================================="
echo "  Claude Code Full Infrastructure Verification"
echo "  Based on official docs (Context7 v2.1.89+)"
echo "============================================="
echo ""

# ─────────────────────────────────────────────────
# 1. SETTINGS.JSON
# ─────────────────────────────────────────────────
echo "=== 1. SETTINGS.JSON ==="

# 1.1 File exists and is valid JSON
if [ -f ".claude/settings.json" ]; then
  python3 -c "import json; json.load(open('.claude/settings.json'))" 2>/dev/null && p "settings.json: valid JSON" || f "settings.json: INVALID JSON"
else
  f "settings.json: file missing"
fi

# 1.2 Has hooks section
python3 -c "import json; d=json.load(open('.claude/settings.json')); assert 'hooks' in d" 2>/dev/null && p "settings.json: has hooks section" || w "settings.json: no hooks section"

# 1.3 Check hook event types (required: at least SessionStart, PostToolUse, Stop)
for event in SessionStart PostToolUse Stop PreToolUse; do
  python3 -c "import json; d=json.load(open('.claude/settings.json')); assert '$event' in d.get('hooks',{})" 2>/dev/null && p "Hook event: $event configured" || w "Hook event: $event missing"
done

# 1.4 Check optional but valuable events
for event in SubagentStart SubagentStop TaskCompleted TeammateIdle PreCompact PostCompact UserPromptSubmit; do
  python3 -c "import json; d=json.load(open('.claude/settings.json')); assert '$event' in d.get('hooks',{})" 2>/dev/null && p "Optional event: $event configured" || i "Optional event: $event not configured"
done

echo ""

# ─────────────────────────────────────────────────
# 2. HOOK SCRIPTS
# ─────────────────────────────────────────────────
echo "=== 2. HOOK SCRIPTS ==="

# 2.1 All referenced scripts exist
python3 -c "
import json
d = json.load(open('.claude/settings.json'))
for event, groups in d.get('hooks',{}).items():
    if not isinstance(groups, list): continue
    for g in groups:
        for h in g.get('hooks',[]):
            cmd = h.get('command','')
            if cmd.startswith('bash ') or cmd.startswith('/'):
                path = cmd.replace('bash ','').strip()
                print(path)
" 2>/dev/null | sort -u | while read path; do
  if [ -f "$path" ]; then
    p "Script exists: $(basename $path)"
  else
    f "Script MISSING: $path"
  fi
done

# 2.2 All hook scripts have valid bash syntax
for f_script in .claude/hooks/*.sh; do
  [ -f "$f_script" ] || continue
  bash -n "$f_script" 2>/dev/null && p "Syntax OK: $(basename $f_script)" || f "Syntax ERROR: $(basename $f_script)"
done

# 2.3 All hook scripts produce JSON on stdout (required by Claude Code)
for f_script in .claude/hooks/*.sh; do
  [ -f "$f_script" ] || continue
  name=$(basename "$f_script")
  # Skip slow hooks
  case "$name" in blocking-typecheck.sh) i "Skipped (slow): $name"; continue;; esac
  bytes=$(echo '{}' | timeout 5 bash "$f_script" 2>/dev/null | wc -c)
  if [ "$bytes" -gt 0 ]; then
    p "JSON output: $name ($bytes bytes)"
  else
    f "EMPTY stdout: $name (Claude Code requires JSON)"
  fi
done

# 2.4 No hook scripts write to stderr (stderr = error in Claude Code)
for f_script in .claude/hooks/*.sh; do
  [ -f "$f_script" ] || continue
  name=$(basename "$f_script")
  case "$name" in blocking-typecheck.sh) continue;; esac
  stderr_bytes=$(echo '{}' | timeout 5 bash "$f_script" 2>&1 1>/dev/null | wc -c)
  if [ "$stderr_bytes" -gt 0 ]; then
    w "Has stderr output: $name (may cause 'hook error')"
  else
    p "No stderr: $name"
  fi
done

# 2.5 Hook handler types used
echo ""
echo "  Handler types in use:"
python3 -c "
import json
d = json.load(open('.claude/settings.json'))
types = set()
for event, groups in d.get('hooks',{}).items():
    if not isinstance(groups, list): continue
    for g in groups:
        for h in g.get('hooks',[]):
            types.add(h.get('type','?'))
for t in sorted(types):
    print(f'    {t}')
available = {'command','prompt','agent','http'}
missing = available - types
if missing:
    print(f'    Missing: {sorted(missing)}')
" 2>/dev/null

# 2.6 Hooks with explicit timeouts
echo ""
python3 -c "
import json
d = json.load(open('.claude/settings.json'))
with_timeout = 0; without_timeout = 0
for event, groups in d.get('hooks',{}).items():
    if not isinstance(groups, list): continue
    for g in groups:
        for h in g.get('hooks',[]):
            if h.get('type') == 'command':
                if 'timeout' in h:
                    with_timeout += 1
                else:
                    without_timeout += 1
print(f'  Command hooks with timeout: {with_timeout}')
print(f'  Command hooks without timeout: {without_timeout} (default 60s)')
" 2>/dev/null

echo ""

# ─────────────────────────────────────────────────
# 3. AGENTS
# ─────────────────────────────────────────────────
echo "=== 3. CUSTOM AGENTS ==="

agent_count=$(ls .claude/agents/*.md 2>/dev/null | wc -l)
echo "  Total: $agent_count agents"

# 3.1 Required frontmatter fields
for f_agent in .claude/agents/*.md; do
  [ -f "$f_agent" ] || continue
  name=$(basename "$f_agent" .md)
  has_name=$(head -20 "$f_agent" | grep -c '^name:') || has_name=0
  has_desc=$(head -20 "$f_agent" | grep -c '^description:') || has_desc=0
  [ "$has_name" -gt 0 ] && [ "$has_desc" -gt 0 ] && p "Agent $name: has name+description" || w "Agent $name: missing name or description"
done

# 3.2 Optional but recommended fields
echo ""
echo "  Optional field coverage:"
for field in memory effort maxTurns model color tools; do
  count=$(grep -l "^$field:" .claude/agents/*.md 2>/dev/null | wc -l)
  pct=$((count * 100 / agent_count))
  if [ "$pct" -ge 80 ]; then
    p "$field: $count/$agent_count agents ($pct%)"
  elif [ "$pct" -ge 50 ]; then
    i "$field: $count/$agent_count agents ($pct%)"
  else
    w "$field: $count/$agent_count agents ($pct%)"
  fi
done

# 3.3 Trigger patterns (description with examples)
echo ""
agents_with_triggers=$(grep -l '<example>' .claude/agents/*.md 2>/dev/null | wc -l)
agents_with_proactive=$(grep -l 'PROACTIVELY\|Use.*when' .claude/agents/*.md 2>/dev/null | wc -l)
i "Agents with <example> triggers: $agents_with_triggers/$agent_count"
i "Agents with proactive trigger language: $agents_with_proactive/$agent_count"

echo ""

# ─────────────────────────────────────────────────
# 4. MCP SERVERS
# ─────────────────────────────────────────────────
echo "=== 4. MCP SERVERS ==="

if [ -f ".mcp.json" ]; then
  python3 -c "import json; json.load(open('.mcp.json'))" 2>/dev/null && p ".mcp.json: valid JSON" || f ".mcp.json: INVALID JSON"

  # 4.1 Check each server
  python3 -c "
import json, shutil, os
d = json.load(open('.mcp.json'))
for name, cfg in d.get('mcpServers',{}).items():
    cmd = cfg.get('command','')
    args = cfg.get('args',[])
    timeout = cfg.get('timeout','default')

    # Check for inline credentials
    for arg in args:
        if isinstance(arg, str) and ('@' in arg and ':' in arg and '//' in arg):
            print(f'FAIL|{name}: INLINE CREDENTIALS in args')

    # Check for env var interpolation
    for arg in args:
        if isinstance(arg, str) and '\${' in arg:
            env_var = arg.split('\${')[1].split('}')[0] if '\${' in arg else ''
            if env_var and not os.environ.get(env_var):
                print(f'WARN|{name}: \${{{env_var}}} not set in environment')
            else:
                print(f'PASS|{name}: \${{{env_var}}} resolved')

    # Check command exists
    if cmd.startswith('npx'):
        print(f'PASS|{name}: uses npx (auto-install)')
    elif shutil.which(cmd):
        print(f'PASS|{name}: command \"{cmd}\" found')
    else:
        print(f'WARN|{name}: command \"{cmd}\" not in PATH')

    # Check timeout
    if timeout != 'default':
        print(f'PASS|{name}: timeout={timeout}ms')
    else:
        print(f'INFO|{name}: no timeout set (default)')
" 2>/dev/null | while read line; do
    level=$(echo "$line" | cut -d'|' -f1)
    msg=$(echo "$line" | cut -d'|' -f2)
    case "$level" in
      PASS) p "$msg" ;; WARN) w "$msg" ;; FAIL) f "$msg" ;; INFO) i "$msg" ;;
    esac
  done
else
  w ".mcp.json: file not found"
fi

echo ""

# ─────────────────────────────────────────────────
# 5. CLAUDE.MD
# ─────────────────────────────────────────────────
echo "=== 5. CLAUDE.MD ==="

if [ -f "CLAUDE.md" ]; then
  lines=$(wc -l < CLAUDE.md)
  words=$(wc -w < CLAUDE.md)
  est_tokens=$((words * 4 / 3))

  p "CLAUDE.md exists ($lines lines, ~$est_tokens tokens)"

  # 5.1 Required sections
  for section in "Stack" "Build" "Test" "Architecture" "Code Style" "Guardrails" "Gotchas"; do
    grep -qi "$section" CLAUDE.md 2>/dev/null && p "Section: $section" || w "Missing section: $section"
  done

  # 5.2 Recommended sections
  for section in "Security" "Agent" "Knowledge" "Gap" "Skill" "Infrastructure"; do
    grep -qi "$section" CLAUDE.md 2>/dev/null && p "Optional section: $section" || i "Optional section: $section missing"
  done

  # 5.3 Size check
  if [ "$est_tokens" -gt 10000 ]; then
    w "CLAUDE.md is large (~$est_tokens tokens) — may pressure context budget"
  else
    p "CLAUDE.md size OK (~$est_tokens tokens)"
  fi
else
  f "CLAUDE.md not found"
fi

# 5.4 Global CLAUDE.md
if [ -f "$HOME/.claude/CLAUDE.md" ]; then
  global_lines=$(wc -l < "$HOME/.claude/CLAUDE.md")
  p "Global CLAUDE.md exists ($global_lines lines)"
else
  i "No global CLAUDE.md"
fi

echo ""

# ─────────────────────────────────────────────────
# 6. SKILLS
# ─────────────────────────────────────────────────
echo "=== 6. SKILLS ==="

skill_count=$(ls -d .claude/skills/*/SKILL.md 2>/dev/null | wc -l)
p "Skills installed: $skill_count"

# 6.1 Each skill has required frontmatter
skills_valid=0; skills_invalid=0
for f_skill in .claude/skills/*/SKILL.md; do
  [ -f "$f_skill" ] || continue
  has_name=$(head -10 "$f_skill" | grep -c '^name:') || has_name=0
  has_desc=$(head -10 "$f_skill" | grep -c '^description:') || has_desc=0
  if [ "$has_name" -gt 0 ] && [ "$has_desc" -gt 0 ]; then
    skills_valid=$((skills_valid+1))
  else
    skills_invalid=$((skills_invalid+1))
    w "Skill missing frontmatter: $(basename $(dirname $f_skill))"
  fi
done
[ "$skills_invalid" -eq 0 ] && p "All $skills_valid skills have valid frontmatter"

echo ""

# ─────────────────────────────────────────────────
# 7. PLUGINS
# ─────────────────────────────────────────────────
echo "=== 7. PLUGINS ==="

plugin_count=$(find "$HOME/.claude/plugins" -name "plugin.json" 2>/dev/null | wc -l)
i "Plugins installed: ~$plugin_count"

# 7.1 Check for plugin SessionStart hook conflicts
plugin_session_hooks=$(find "$HOME/.claude/plugins" -name "hooks.json" -exec grep -l "SessionStart" {} \; 2>/dev/null | wc -l)
if [ "$plugin_session_hooks" -gt 2 ]; then
  w "Multiple plugin SessionStart hooks ($plugin_session_hooks) — potential conflicts"
else
  p "Plugin SessionStart hooks: $plugin_session_hooks (manageable)"
fi

echo ""

# ─────────────────────────────────────────────────
# 8. ENVIRONMENT
# ─────────────────────────────────────────────────
echo "=== 8. ENVIRONMENT ==="

# 8.1 Required env vars
for var in DATABASE_URL; do
  val="${!var:-}"
  [ -n "$val" ] && p "Env var: $var set" || w "Env var: $var not set"
done

# 8.2 Claude Code env vars in settings
python3 -c "
import json
for f in ['/home/wtyler/.claude/settings.json', '.claude/settings.json']:
    try:
        d = json.load(open(f))
        env = d.get('env',{})
        for k,v in env.items():
            print(f'PASS|{k}={v[:20]}...' if len(v)>20 else f'PASS|{k}={v}')
    except: pass
" 2>/dev/null | while read line; do
  msg=$(echo "$line" | cut -d'|' -f2)
  p "Settings env: $msg"
done

# 8.3 Agent teams experimental flag
python3 -c "
import json
for f in ['/home/wtyler/.claude/settings.json', '.claude/settings.json']:
    try:
        d = json.load(open(f))
        if d.get('env',{}).get('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS') == '1':
            print('YES')
            break
    except: pass
" 2>/dev/null | grep -q YES && p "Agent teams: enabled" || w "Agent teams: not enabled"

echo ""

# ─────────────────────────────────────────────────
# 9. VAULT INTEGRATION
# ─────────────────────────────────────────────────
echo "=== 9. KNOWLEDGE VAULT ==="

[ -f ".arscontexta" ] && p "Vault marker: present" || i "No Ars Contexta vault"

if [ -d "knowledge" ]; then
  note_count=$(ls knowledge/*.md 2>/dev/null | wc -l)
  p "Knowledge notes: $note_count"

  # Check for infra topic maps
  [ -f "knowledge/dev-infrastructure.md" ] && p "Topic map: dev-infrastructure" || w "Missing: dev-infrastructure topic map"
  [ -f "knowledge/claude-code-skills.md" ] && p "Topic map: claude-code-skills" || w "Missing: claude-code-skills topic map"
  [ -f "knowledge/gaps-and-opportunities.md" ] && p "Topic map: gaps-and-opportunities" || w "Missing: gaps-and-opportunities topic map"
fi

# Check for query scripts
query_count=$(ls ops/queries/*.sh 2>/dev/null | wc -l)
p "Query scripts: $query_count"

echo ""

# ─────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────
echo "============================================="
TOTAL=$((PASS+WARN+FAIL+INFO))
SCORE=$((PASS * 100 / (TOTAL > 0 ? TOTAL : 1)))

echo "  PASS: $PASS | WARN: $WARN | FAIL: $FAIL | INFO: $INFO"
echo "  Score: $SCORE% ($PASS/$TOTAL checks)"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  Grade: NEEDS FIXES ($FAIL failures)"
elif [ "$WARN" -gt 3 ]; then
  echo "  Grade: GOOD ($WARN warnings to address)"
elif [ "$WARN" -gt 0 ]; then
  echo "  Grade: VERY GOOD ($WARN minor warnings)"
else
  echo "  Grade: EXCELLENT (all checks pass)"
fi
echo "============================================="
