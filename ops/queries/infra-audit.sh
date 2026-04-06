#!/usr/bin/env bash
# infra-audit.sh — Comprehensive Claude Code infrastructure health audit
# Audits hooks, skills, agents, MCP servers, settings, and CLAUDE.md
# Usage: bash ops/queries/infra-audit.sh
# Exit 0 always — informational report, never blocks

set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

SCORE=100
DEDUCTIONS=""

deduct() {
  local points=$1
  local reason=$2
  SCORE=$((SCORE - points))
  DEDUCTIONS="${DEDUCTIONS}  -${points}: ${reason}\n"
}

echo "=== Claude Code Infrastructure Audit ==="
echo "Date: $(date +%Y-%m-%d)"
echo "Repo: $(basename "$(pwd)")"
echo ""

# ============================================================
# HOOKS
# ============================================================

echo "================================================================"
echo "HOOKS"
echo "================================================================"

# Parse settings.json for all hook commands
SETTINGS_FILE=".claude/settings.json"
if [ ! -f "$SETTINGS_FILE" ]; then
  echo "  FAIL: $SETTINGS_FILE not found"
  deduct 15 "settings.json missing"
else
  # Count totals
  all_commands=$(jq -r '.hooks | to_entries[].value[].hooks[].command' "$SETTINGS_FILE" 2>/dev/null)
  total_hooks=$(echo "$all_commands" | wc -l | tr -d ' ')
  claudekit_count=$(echo "$all_commands" | grep -c 'claudekit-hooks' || true)
  custom_count=$((total_hooks - claudekit_count))
  events=$(jq -r '.hooks | keys[]' "$SETTINGS_FILE" 2>/dev/null)
  event_count=$(echo "$events" | wc -l | tr -d ' ')
  group_count=$(jq '[.hooks | to_entries[] | .value | length] | add' "$SETTINGS_FILE" 2>/dev/null)

  echo ""
  echo "  Total: $total_hooks hooks across $event_count events in $group_count matcher groups"
  echo "  Split: $claudekit_count claudekit, $custom_count custom"
  echo ""

  # --- Check each hook command ---
  echo "  --- Hook-by-Hook Health ---"
  echo ""

  while IFS= read -r cmd; do
    [ -z "$cmd" ] && continue

    # Determine hook name for display
    if echo "$cmd" | grep -q 'claudekit-hooks run'; then
      hook_name="claudekit: $(echo "$cmd" | sed 's/.*claudekit-hooks run //')"
      # Check if claudekit-hooks binary exists
      if ! which claudekit-hooks >/dev/null 2>&1; then
        echo "  FAIL: $hook_name — claudekit-hooks binary not found in PATH"
        deduct 3 "claudekit-hooks not in PATH"
        continue
      fi
      echo "  OK: $hook_name"
    else
      # Custom hook — extract script path
      script_path=$(echo "$cmd" | sed 's/^bash //')
      script_name=$(basename "$script_path" .sh)
      if [ -f "$script_path" ]; then
        # Check executable permission
        if [ ! -x "$script_path" ] && ! echo "$cmd" | grep -q '^bash '; then
          echo "  WARN: custom: $script_name — not executable (invoked without bash prefix)"
          deduct 1 "$script_name not executable"
        else
          echo "  OK: custom: $script_name"
        fi
      else
        echo "  FAIL: custom: $script_name — script not found: $script_path"
        deduct 3 "$script_name script missing"
      fi
    fi
  done <<< "$all_commands"

  echo ""

  # --- Check for duplicate commands ---
  echo "  --- Duplicate Detection ---"
  dupes=$(echo "$all_commands" | sort | uniq -d)
  if [ -n "$dupes" ]; then
    while IFS= read -r dup; do
      [ -z "$dup" ] && continue
      echo "  WARN: Duplicate hook command: $(echo "$dup" | sed 's|.*/||')"
      deduct 2 "Duplicate hook: $(echo "$dup" | sed 's|.*/||')"
    done <<< "$dupes"
  else
    echo "  OK: No duplicate hook commands"
  fi
  echo ""

  # --- Check for missing matcher fields ---
  echo "  --- Matcher Validation ---"
  missing_matchers=0
  for event in $events; do
    count=$(jq -r ".hooks.\"$event\" | length" "$SETTINGS_FILE" 2>/dev/null)
    for ((i=0; i<count; i++)); do
      has_matcher=$(jq -r ".hooks.\"$event\"[$i] | has(\"matcher\")" "$SETTINGS_FILE" 2>/dev/null)
      if [ "$has_matcher" = "false" ]; then
        cmd_summary=$(jq -r ".hooks.\"$event\"[$i].hooks[0].command" "$SETTINGS_FILE" 2>/dev/null | sed 's|.*/||')
        echo "  WARN: $event group $((i+1)) ($cmd_summary) — no matcher field (falls through to default)"
        missing_matchers=$((missing_matchers + 1))
        deduct 1 "$event group $((i+1)) missing matcher"
      fi
    done
  done
  [ "$missing_matchers" -eq 0 ] && echo "  OK: All matcher groups have explicit matchers"
  echo ""

  # --- PostToolUse pipeline density ---
  echo "  --- PostToolUse Pipeline Analysis ---"
  ptu_count=$(jq '.hooks.PostToolUse | length' "$SETTINGS_FILE" 2>/dev/null || echo 0)
  ptu_write=$(jq '[.hooks.PostToolUse[] | select(.matcher | test("Write|\\*"))] | length' "$SETTINGS_FILE" 2>/dev/null || echo 0)
  echo "  $ptu_count matcher groups, $ptu_write fire on Write"
  if [ "$ptu_write" -gt 8 ]; then
    echo "  WARN: Dense PostToolUse pipeline ($ptu_write groups fire on Write) — potential latency"
    deduct 2 "Dense PostToolUse pipeline: $ptu_write groups on Write"
  fi
  echo ""

  # --- Async vs blocking analysis ---
  echo "  --- Blocking vs Async ---"
  async_count=$(jq '[.hooks | to_entries[].value[].hooks[] | select(.async == true)] | length' "$SETTINGS_FILE" 2>/dev/null || echo 0)
  blocking_count=$((total_hooks - async_count))
  echo "  $blocking_count blocking, $async_count async"
  if [ "$blocking_count" -gt 20 ]; then
    echo "  WARN: High blocking hook count ($blocking_count) — may slow operations"
    deduct 2 "High blocking hook count: $blocking_count"
  fi

  # --- Check Stop hooks (blocking the agent from stopping is critical) ---
  stop_hooks=$(jq -r '.hooks.Stop[].hooks[].command' "$SETTINGS_FILE" 2>/dev/null | wc -l | tr -d ' ')
  echo "  Stop event: $stop_hooks hooks (blocking = agent cannot stop until all pass)"
  echo ""

  # --- Syntax check on custom scripts ---
  echo "  --- Script Syntax Check ---"
  syntax_issues=0
  for script in .claude/hooks/*.sh; do
    [ -f "$script" ] || continue
    name=$(basename "$script" .sh)
    if ! bash -n "$script" 2>/dev/null; then
      echo "  FAIL: $name — bash syntax error"
      deduct 3 "$name syntax error"
      syntax_issues=$((syntax_issues + 1))
    fi
    # Check for common script issues: statements concatenated on same line
    # Match "fi" or closing paren immediately followed by a keyword (if/for/while/case/done)
    # Exclude legitimate patterns like "file", "find", "filter", "field", "finally"
    if grep -nP '(fi|done|esac)\s*(if|for|while|case|do)\b' "$script" 2>/dev/null | grep -v '^\s*#' >/dev/null 2>&1; then
      echo "  WARN: $name — statements concatenated on one line (missing newline)"
      deduct 1 "$name line concatenation"
      syntax_issues=$((syntax_issues + 1))
    fi
  done
  [ "$syntax_issues" -eq 0 ] && echo "  OK: All custom hook scripts pass syntax check"
fi

echo ""

# ============================================================
# SKILLS
# ============================================================

echo "================================================================"
echo "SKILLS"
echo "================================================================"

SKILLS_DIR=".claude/skills"
if [ ! -d "$SKILLS_DIR" ]; then
  echo "  FAIL: $SKILLS_DIR not found"
  deduct 10 "skills directory missing"
else
  skill_total=0
  vault_skills=0
  project_skills=0

  echo ""
  echo "  --- Vault Skills (Ars Contexta / knowledge system) ---"
  echo ""
  for d in "$SKILLS_DIR"/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    skill_md="$d/SKILL.md"
    if [ ! -f "$skill_md" ]; then
      echo "  FAIL: $name — no SKILL.md"
      deduct 2 "Skill $name has no SKILL.md"
      skill_total=$((skill_total + 1))
      continue
    fi

    lines=$(wc -l < "$skill_md")
    desc=$(head -30 "$skill_md" | grep -E '^description:' | head -1 | sed 's/description: *//' | tr -d '"')
    is_vault=$(head -30 "$skill_md" | grep -ciE 'ars contexta|vault|knowledge|note|extract|connect|pipeline|rethink|revisit|seed|queue' || true)

    skill_total=$((skill_total + 1))

    if [ "$is_vault" -gt 0 ]; then
      vault_skills=$((vault_skills + 1))
      if [ -z "$desc" ]; then
        echo "  WARN: $name ($lines lines) — no description in frontmatter"
        deduct 1 "Skill $name missing description"
      else
        echo "  OK: $name ($lines lines)"
      fi
    fi
  done

  echo ""
  echo "  --- Project Skills (ProtoPulse development) ---"
  echo ""
  for d in "$SKILLS_DIR"/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    skill_md="$d/SKILL.md"
    [ -f "$skill_md" ] || continue

    lines=$(wc -l < "$skill_md")
    desc=$(head -30 "$skill_md" | grep -E '^description:' | head -1 | sed 's/description: *//' | tr -d '"')
    is_vault=$(head -30 "$skill_md" | grep -ciE 'ars contexta|vault|knowledge|note|extract|connect|pipeline|rethink|revisit|seed|queue' || true)

    if [ "$is_vault" -eq 0 ]; then
      project_skills=$((project_skills + 1))
      if [ -z "$desc" ]; then
        echo "  WARN: $name ($lines lines) — no description in frontmatter"
        deduct 1 "Skill $name missing description"
      else
        echo "  OK: $name ($lines lines)"
      fi
    fi
  done

  echo ""
  echo "  Total: $skill_total skills ($vault_skills vault, $project_skills project)"

  # --- Check for overlapping skills ---
  echo ""
  echo "  --- Overlap Detection ---"
  # Check skill descriptions for functional overlap (description line only, not full body)
  commit_skills=0
  validate_skills=0
  for d in "$SKILLS_DIR"/*/; do
    [ -d "$d" ] || continue
    skill_md="$d/SKILL.md"
    [ -f "$skill_md" ] || continue
    desc_line=$(head -30 "$skill_md" | grep -E '^description:' | head -1)
    if echo "$desc_line" | grep -qiE '\bcommit\b|\bpush\b|\bship\b|\bdeploy\b'; then
      commit_skills=$((commit_skills + 1))
    fi
    if echo "$desc_line" | grep -qiE '\bvalidat|\bschema check|\bverif'; then
      validate_skills=$((validate_skills + 1))
    fi
  done
  if [ "$commit_skills" -gt 1 ]; then
    echo "  WARN: $commit_skills skills have commit/ship/deploy in description — check for overlap"
    deduct 1 "Multiple commit/ship/deploy skills"
  else
    echo "  OK: No commit/ship/deploy overlap"
  fi
  if [ "$validate_skills" -gt 2 ]; then
    echo "  WARN: $validate_skills skills have validation/verify in description — check for overlap"
    deduct 1 "Multiple validation skills"
  else
    echo "  OK: Validation/verify overlap within acceptable range ($validate_skills)"
  fi
fi

echo ""

# ============================================================
# AGENTS
# ============================================================

echo "================================================================"
echo "AGENTS"
echo "================================================================"

AGENTS_DIR=".claude/agents"
if [ ! -d "$AGENTS_DIR" ]; then
  echo "  FAIL: $AGENTS_DIR not found"
  deduct 10 "agents directory missing"
else
  agent_total=$(find "$AGENTS_DIR" -name '*.md' -type f | wc -l | tr -d ' ')
  top_level=$(ls "$AGENTS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
  in_dirs=$((agent_total - top_level))

  echo ""
  echo "  Total: $agent_total agent definitions ($top_level standalone, $in_dirs in directories)"
  echo ""

  # --- List with line counts ---
  echo "  --- By Size ---"
  echo ""
  find "$AGENTS_DIR" -name '*.md' -type f -exec sh -c 'echo "$(wc -l < "$1") $1"' _ {} \; | sort -rn | head -15 | while read -r lc path; do
    name=$(basename "$path" .md)
    echo "  OK: $name ($lc lines)"
  done
  echo ""

  # --- Check for missing trigger patterns ---
  echo "  --- Trigger Pattern Check ---"
  no_trigger=0
  for agent in $(find "$AGENTS_DIR" -name '*.md' -type f); do
    has_trigger=$(head -10 "$agent" | grep -ciE 'trigger|when to use|use when|activate when' || true)
    if [ "$has_trigger" -eq 0 ]; then
      no_trigger=$((no_trigger + 1))
    fi
  done
  if [ "$no_trigger" -gt 0 ]; then
    echo "  WARN: $no_trigger/$agent_total agents have no trigger pattern in first 10 lines"
    deduct 2 "$no_trigger agents missing trigger patterns"
  else
    echo "  OK: All agents have trigger patterns"
  fi

  # --- Check for irrelevant agents (not matching this project's stack) ---
  echo ""
  echo "  --- Stack Relevance ---"
  irrelevant=0
  for name in kafka loopback nestjs-expert mongodb jest framework-nextjs; do
    matches=$(find "$AGENTS_DIR" -name "*${name}*" -type f 2>/dev/null | wc -l | tr -d ' ')
    if [ "$matches" -gt 0 ]; then
      echo "  INFO: $name agent exists but is outside ProtoPulse stack"
      irrelevant=$((irrelevant + 1))
    fi
  done
  [ "$irrelevant" -gt 0 ] && echo "  INFO: $irrelevant agent definitions are for technologies not used in ProtoPulse"
fi

echo ""

# ============================================================
# MCP SERVERS
# ============================================================

echo "================================================================"
echo "MCP SERVERS"
echo "================================================================"

MCP_FILE=".mcp.json"
if [ ! -f "$MCP_FILE" ]; then
  echo "  FAIL: $MCP_FILE not found"
  deduct 10 ".mcp.json missing"
else
  echo ""
  # Check each server's command exists
  servers=$(jq -r '.mcpServers | keys[]' "$MCP_FILE" 2>/dev/null)
  server_count=$(echo "$servers" | wc -l | tr -d ' ')
  echo "  Total: $server_count MCP servers configured"
  echo ""

  for server in $servers; do
    cmd=$(jq -r ".mcpServers.\"$server\".command" "$MCP_FILE" 2>/dev/null)
    timeout=$(jq -r ".mcpServers.\"$server\".timeout // \"none\"" "$MCP_FILE" 2>/dev/null)

    if which "$cmd" >/dev/null 2>&1; then
      echo "  OK: $server — binary found: $(which "$cmd")"
    elif [ "$cmd" = "npx" ]; then
      # npx is fine — it pulls the package on demand
      if which npx >/dev/null 2>&1; then
        pkg=$(jq -r ".mcpServers.\"$server\".args[1]" "$MCP_FILE" 2>/dev/null)
        echo "  OK: $server — via npx ($pkg)"
      else
        echo "  FAIL: $server — npx not found"
        deduct 3 "npx not available for $server"
      fi
    else
      echo "  FAIL: $server — command not found: $cmd"
      deduct 5 "MCP server $server binary missing"
    fi

    if [ "$timeout" = "none" ]; then
      echo "       WARN: No timeout configured"
      deduct 1 "$server has no timeout"
    else
      echo "       Timeout: ${timeout}ms"
    fi
  done

  # --- Check for credential exposure ---
  echo ""
  echo "  --- Credential Check ---"
  if jq -r '.mcpServers | to_entries[].value.args[]?' "$MCP_FILE" 2>/dev/null | grep -qiE 'password|secret|token|api.key'; then
    echo "  WARN: Possible credentials in .mcp.json args (check for hardcoded passwords)"
    deduct 3 "Possible credentials in .mcp.json"
  else
    echo "  OK: No obvious credentials in args"
  fi
  # Check postgres specifically for connection string
  pg_args=$(jq -r '.mcpServers.postgres.args[]?' "$MCP_FILE" 2>/dev/null || true)
  if echo "$pg_args" | grep -qE '://[^:]+:[^@]+@'; then
    echo "  WARN: PostgreSQL connection string contains inline credentials"
    deduct 2 "Inline DB credentials in .mcp.json"
  fi
fi

echo ""

# ============================================================
# CLAUDE.MD HEALTH
# ============================================================

echo "================================================================"
echo "CLAUDE.MD HEALTH"
echo "================================================================"

PROJECT_CLAUDE="CLAUDE.md"
GLOBAL_CLAUDE="$HOME/.claude/CLAUDE.md"

echo ""

# --- Line counts and token estimate ---
if [ -f "$PROJECT_CLAUDE" ]; then
  project_lines=$(wc -l < "$PROJECT_CLAUDE")
  project_words=$(wc -w < "$PROJECT_CLAUDE")
  project_tokens=$((project_words * 4 / 3))  # rough token estimate
  echo "  Project CLAUDE.md: $project_lines lines, ~$project_words words (~$project_tokens tokens)"
else
  echo "  FAIL: No project CLAUDE.md"
  deduct 10 "No project CLAUDE.md"
  project_lines=0
fi

if [ -f "$GLOBAL_CLAUDE" ]; then
  global_lines=$(wc -l < "$GLOBAL_CLAUDE")
  global_words=$(wc -w < "$GLOBAL_CLAUDE")
  global_tokens=$((global_words * 4 / 3))
  echo "  Global CLAUDE.md: $global_lines lines, ~$global_words words (~$global_tokens tokens)"
else
  echo "  INFO: No global ~/.claude/CLAUDE.md"
  global_lines=0
fi

combined=$((project_lines + global_lines))
echo "  Combined: $combined lines loaded per session"
if [ "$combined" -gt 800 ]; then
  echo "  WARN: Combined CLAUDE.md exceeds 800 lines — context budget pressure"
  deduct 2 "CLAUDE.md combined >800 lines"
fi

echo ""

# --- Section redundancy check ---
echo "  --- Redundancy Detection ---"
if [ -f "$PROJECT_CLAUDE" ] && [ -f "$GLOBAL_CLAUDE" ]; then
  # Check for sections that appear in both files
  project_sections=$(grep -E '^##+ ' "$PROJECT_CLAUDE" 2>/dev/null | sed 's/^#* //' | tr '[:upper:]' '[:lower:]')
  global_sections=$(grep -E '^##+ ' "$GLOBAL_CLAUDE" 2>/dev/null | sed 's/^#* //' | tr '[:upper:]' '[:lower:]')
  overlaps=0
  while IFS= read -r section; do
    [ -z "$section" ] && continue
    # Check if any global section is similar (shared first word)
    first_word=$(echo "$section" | awk '{print $1}')
    if echo "$global_sections" | grep -qi "^$first_word" 2>/dev/null; then
      echo "  INFO: Possible overlap — \"$section\" vs global section starting with \"$first_word\""
      overlaps=$((overlaps + 1))
    fi
  done <<< "$project_sections"
  [ "$overlaps" -eq 0 ] && echo "  OK: No obvious section overlaps between project and global"
fi

echo ""

# --- Reference validation ---
echo "  --- Reference Validation ---"
ref_issues=0
if [ -f "$PROJECT_CLAUDE" ]; then
  # Check if CLAUDE.md mentions hooks that don't exist
  for hook_ref in $(grep -oE 'hooks/[a-z-]+\.sh' "$PROJECT_CLAUDE" 2>/dev/null | sort -u); do
    if [ ! -f ".claude/$hook_ref" ]; then
      echo "  WARN: CLAUDE.md references .claude/$hook_ref but file not found"
      ref_issues=$((ref_issues + 1))
      deduct 1 "Stale reference: $hook_ref"
    fi
  done
  # Check if CLAUDE.md mentions skills that don't exist
  for skill_ref in $(grep -oE 'skills/[a-z-]+' "$PROJECT_CLAUDE" 2>/dev/null | sort -u); do
    if [ ! -d ".claude/$skill_ref" ]; then
      echo "  WARN: CLAUDE.md references .claude/$skill_ref but directory not found"
      ref_issues=$((ref_issues + 1))
      deduct 1 "Stale reference: $skill_ref"
    fi
  done
fi
[ "$ref_issues" -eq 0 ] && echo "  OK: No stale references found in CLAUDE.md"

echo ""

# ============================================================
# SETTINGS CONSISTENCY
# ============================================================

echo "================================================================"
echo "SETTINGS CONSISTENCY"
echo "================================================================"
echo ""

if [ -f "$SETTINGS_FILE" ]; then
  # --- All script paths in settings.json must exist ---
  echo "  --- Script Path Verification ---"
  path_issues=0
  while IFS= read -r cmd; do
    [ -z "$cmd" ] && continue
    echo "$cmd" | grep -q 'claudekit-hooks' && continue
    # Extract the script path (handle "bash /path/script.sh" prefix)
    path=$(echo "$cmd" | sed 's/^bash //')
    if [[ "$path" == /* ]] && [ ! -f "$path" ]; then
      echo "  FAIL: Settings references missing script: $path"
      path_issues=$((path_issues + 1))
      deduct 3 "Missing script: $(basename "$path")"
    fi
  done <<< "$(jq -r '.hooks | to_entries[].value[].hooks[].command' "$SETTINGS_FILE" 2>/dev/null)"
  [ "$path_issues" -eq 0 ] && echo "  OK: All script paths in settings.json exist on disk"

  echo ""

  # --- Check for empty event arrays ---
  echo "  --- Empty Event Check ---"
  for event in $(jq -r '.hooks | keys[]' "$SETTINGS_FILE" 2>/dev/null); do
    count=$(jq ".hooks.\"$event\" | length" "$SETTINGS_FILE" 2>/dev/null)
    if [ "$count" -eq 0 ]; then
      echo "  INFO: $event event declared but has no hooks"
    fi
  done
  echo "  OK: Event declarations checked"
fi

echo ""

# ============================================================
# CLAUDEKIT CONFIG
# ============================================================

echo "================================================================"
echo "CLAUDEKIT CONFIG"
echo "================================================================"
echo ""

CLAUDEKIT_CONFIG=".claudekit/config.json"
if [ -f "$CLAUDEKIT_CONFIG" ]; then
  echo "  Config: $CLAUDEKIT_CONFIG"
  # Show hook-specific overrides
  jq -r '.hooks | to_entries[] | "  \(.key): timeout=\(.value.timeout // "default")ms"' "$CLAUDEKIT_CONFIG" 2>/dev/null
else
  echo "  INFO: No .claudekit/config.json — all claudekit hooks use defaults"
fi

echo ""

# ============================================================
# SCORE
# ============================================================

echo "================================================================"
# Clamp score to 0
[ "$SCORE" -lt 0 ] && SCORE=0

if [ "$SCORE" -ge 90 ]; then
  grade="A"
elif [ "$SCORE" -ge 80 ]; then
  grade="B"
elif [ "$SCORE" -ge 70 ]; then
  grade="C"
elif [ "$SCORE" -ge 60 ]; then
  grade="D"
else
  grade="F"
fi

echo "SCORE: $SCORE/100 ($grade)"
echo ""
if [ -n "$DEDUCTIONS" ]; then
  echo "Deductions:"
  echo -e "$DEDUCTIONS"
fi
echo "================================================================"
echo "Run: bash ops/queries/infra-gaps.sh  — for gap analysis"
echo "Read: knowledge/dev-infrastructure.md — for infrastructure topic map"
