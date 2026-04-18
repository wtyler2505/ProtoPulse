#!/usr/bin/env bash
# smart-stop-gate.sh — intelligent stop-review replacement for ProtoPulse
#
# Replaces the old "Self-review before stopping..." prompt-type Stop hook.
# That hook fired on EVERY stop, ran a full-transcript LLM review, and
# produced generic "cannot verify" feedback because the hook can't actually
# see the session transcript. It was noisy and repetitive.
#
# This script fires feedback ONLY when concrete, evidence-based signals
# indicate something is genuinely incomplete. Silence = everything is fine.
#
# Signals that WILL trigger feedback:
#   1. .claude/.tsc-errors.log has real error content (not just the clear file)
#   2. Most recent logs/tests-*.log (newest) shows `failed` or `×` results
#   3. Uncommitted tracked-file changes older than 10 minutes that the
#      auto-commit hook somehow missed (stale WIP)
#   4. npm run check recently errored (check exit-code marker file if present)
#
# Signals that will NOT trigger feedback:
#   - Background agents still running (those are by design; Tyler dispatched
#     them and they'll notify when done)
#   - New untracked files in knowledge/ or ops/ (auto-commit handles these)
#   - Passing tests or clean typecheck
#   - Normal completion flow
#
# Exit codes:
#   0 — silent (all clean, no feedback)
#   0 + stdout message — fires feedback (Claude Code picks up stdout)

set -uo pipefail

PROJECT_ROOT="/home/wtyler/Projects/ProtoPulse"
cd "$PROJECT_ROOT" 2>/dev/null || exit 0

issues=()

# ── Signal 1: tsc errors log has non-empty error content ──────────────────
TSC_ERR_LOG="$PROJECT_ROOT/.claude/.tsc-errors.log"
if [ -s "$TSC_ERR_LOG" ]; then
  # File has content — check if it's a real error or just stale noise
  if grep -qE "error TS[0-9]+:|\berror:" "$TSC_ERR_LOG" 2>/dev/null; then
    # Count unique errors to avoid re-reporting stale log
    err_count=$(grep -cE "error TS[0-9]+:" "$TSC_ERR_LOG" 2>/dev/null || echo 0)
    if [ "$err_count" -gt 0 ]; then
      issues+=("TypeScript has $err_count compile errors in .claude/.tsc-errors.log — fix before any new work")
    fi
  fi
fi

# ── Signal 2: most recent test log shows failures ─────────────────────────
if [ -d "$PROJECT_ROOT/logs" ]; then
  latest_test=$(ls -1t "$PROJECT_ROOT"/logs/tests-*.log 2>/dev/null | head -1)
  if [ -n "$latest_test" ] && [ -f "$latest_test" ]; then
    # Only check logs modified in last 30 min — older logs are stale
    age_min=$(( ($(date +%s) - $(stat -c %Y "$latest_test")) / 60 ))
    if [ "$age_min" -lt 30 ]; then
      # Look for vitest FAIL/× markers in the tail
      if tail -100 "$latest_test" | grep -qE "^[[:space:]]*(×|FAIL |Test Files .*failed)" 2>/dev/null; then
        failed_count=$(tail -100 "$latest_test" | grep -oE "Tests +[0-9]+ failed" | head -1 | grep -oE "[0-9]+" | head -1)
        issues+=("Test suite $(basename "$latest_test") has ${failed_count:-unknown} failing tests (log age ${age_min}m) — fix before stopping")
      fi
    fi
  fi
fi

# ── Signal 3: stale uncommitted work (>10 min old) ────────────────────────
# Only flag code/config files that the auto-commit hook OUGHT to have caught.
# Excludes ephemeral state: .obsidian/, node_modules/, .smart-env/, logs/, ops/sessions/
stale_files=()
while IFS= read -r line; do
  # Parse porcelain: "XY filename"
  status="${line:0:2}"
  file="${line:3}"
  # Skip ignorable paths
  case "$file" in
    .obsidian/*|.smart-env/*|node_modules/*|logs/*|ops/sessions/*|ops/health/*|ops/queue/queue.json|*.log)
      continue
      ;;
  esac
  # Only care about modified/added tracked files
  case "$status" in
    " M"|"M "|"MM"|"A "|" A")
      # Age check
      if [ -f "$PROJECT_ROOT/$file" ]; then
        mtime=$(stat -c %Y "$PROJECT_ROOT/$file" 2>/dev/null || echo 0)
        now=$(date +%s)
        age_sec=$(( now - mtime ))
        if [ "$age_sec" -gt 600 ]; then
          stale_files+=("$file")
        fi
      fi
      ;;
  esac
done < <(git status --porcelain 2>/dev/null)

if [ "${#stale_files[@]}" -gt 0 ]; then
  count="${#stale_files[@]}"
  sample="${stale_files[0]}"
  if [ "$count" -gt 1 ]; then
    issues+=("$count uncommitted files >10min old (auto-commit missed them?), e.g.: $sample")
  else
    issues+=("1 uncommitted file >10min old: $sample")
  fi
fi

# ── Signal 4: explicit "needs-attention" marker file ──────────────────────
# Convention: any file at .claude/needs-attention/*.md indicates an issue
# that some agent flagged for human review. Check for any.
NEEDS_ATTN_DIR="$PROJECT_ROOT/.claude/needs-attention"
if [ -d "$NEEDS_ATTN_DIR" ]; then
  attn_count=$(find "$NEEDS_ATTN_DIR" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l)
  if [ "$attn_count" -gt 0 ]; then
    issues+=("$attn_count file(s) in .claude/needs-attention/ awaiting review")
  fi
fi

# ── Signal 5: npm run check cached exit-code ──────────────────────────────
# blocking-typecheck.sh + check-cache updater writes to .claude/.check-status
# with single line: "<exit-code> <timestamp> <err-count>". If non-zero exit
# and recent (< 20 min), fire.
CHECK_STATUS="$PROJECT_ROOT/.claude/.check-status"
if [ -f "$CHECK_STATUS" ]; then
  read -r check_exit check_ts check_errs < "$CHECK_STATUS" 2>/dev/null || true
  if [ -n "${check_exit:-}" ] && [ "$check_exit" -ne 0 ] 2>/dev/null; then
    now=$(date +%s)
    age_min=$(( (now - ${check_ts:-0}) / 60 ))
    if [ "$age_min" -lt 20 ]; then
      issues+=("npm run check last exited $check_exit (${check_errs:-?} errors, ${age_min}m ago) — fix TS errors before stopping")
    fi
  fi
fi

# ── Signal 6: orphan source/test pairs from current uncommitted diff ──────
# When a new production source file appears without matching __tests__/basename.test.ts,
# or a test file appears without matching source, that's likely mid-work or a miss.
# Only check files added in current uncommitted diff (??  or A ).
orphan_sources=()
orphan_tests=()
while IFS= read -r line; do
  status="${line:0:2}"
  file="${line:3}"
  # Only new-file statuses
  case "$status" in
    "??"|"A ") ;;
    *) continue ;;
  esac
  # Restrict to project source trees
  case "$file" in
    client/src/lib/*.ts|client/src/hooks/*.ts|server/lib/*.ts|server/routes/*.ts|server/ai-tools/*.ts|shared/*.ts)
      ;;
    *)
      continue
      ;;
  esac
  # Skip if file is itself a test
  case "$file" in
    *.test.ts|*.test.tsx|*__tests__/*) continue ;;
    *.d.ts) continue ;;
  esac
  # Skip barrel/index files — reasonable for those to have no direct test
  case "$(basename "$file")" in
    index.ts|types.ts) continue ;;
  esac
  base=$(basename "$file" .ts)
  dir=$(dirname "$file")
  # Look for sibling __tests__/basename.test.ts — NO orphan if found
  if [ ! -f "$PROJECT_ROOT/$dir/__tests__/$base.test.ts" ] && \
     [ ! -f "$PROJECT_ROOT/$dir/__tests__/$base.test.tsx" ]; then
    orphan_sources+=("$file")
  fi
done < <(git status --porcelain 2>/dev/null)

if [ "${#orphan_sources[@]}" -gt 0 ]; then
  count="${#orphan_sources[@]}"
  sample="${orphan_sources[0]}"
  if [ "$count" -gt 1 ]; then
    issues+=("$count new source file(s) without tests, e.g.: $sample")
  else
    issues+=("New source file without test: $sample")
  fi
fi

# ── Signal 7: pattern regression in this session's edits ──────────────────
# Look for newly-ADDED `: any`, `as any`, `console.log/warn/error` lines in
# uncommitted production code — these are usually mistakes snuck past lint.
# Uses `git diff` against HEAD to limit to this session's line additions.
if command -v git &>/dev/null; then
  # Get only ADDED lines (+) excluding the diff header `+++` line
  any_adds=$(git diff --unified=0 HEAD -- \
    'client/src/**/*.ts' 'client/src/**/*.tsx' \
    'server/**/*.ts' 'shared/**/*.ts' 2>/dev/null \
    | grep -E "^\+[^+]" \
    | grep -cE ":\s*any\b|<any>|\bas\s+any\b" 2>/dev/null || echo 0)
  if [ "${any_adds:-0}" -gt 0 ] 2>/dev/null; then
    issues+=("$any_adds new \`any\` type(s) added in this session — prefer proper types or \`unknown\`")
  fi

  console_adds=$(git diff --unified=0 HEAD -- \
    'client/src/**/*.ts' 'client/src/**/*.tsx' \
    'server/**/*.ts' 2>/dev/null \
    | grep -E "^\+[^+]" \
    | grep -vE "^\+\s*\*|^\+\s*//" \
    | grep -cE "console\.(log|warn|error|debug|info)\s*\(" 2>/dev/null || echo 0)
  if [ "${console_adds:-0}" -gt 0 ] 2>/dev/null; then
    issues+=("$console_adds new \`console.*\` call(s) in production code — route through logger")
  fi

  tsignore_adds=$(git diff --unified=0 HEAD -- \
    'client/src/**/*.ts' 'client/src/**/*.tsx' \
    'server/**/*.ts' 'shared/**/*.ts' 2>/dev/null \
    | grep -E "^\+[^+]" \
    | grep -cE "@ts-ignore|@ts-expect-error" 2>/dev/null || echo 0)
  if [ "${tsignore_adds:-0}" -gt 0 ] 2>/dev/null; then
    issues+=("$tsignore_adds new \`@ts-ignore\` / \`@ts-expect-error\` line(s) added — fix the type instead")
  fi
fi

# ── Output ────────────────────────────────────────────────────────────────
if [ "${#issues[@]}" -eq 0 ]; then
  # Silent exit — no feedback, no noise
  exit 0
fi

# Fire concise, concrete feedback with only the real issues
echo "Stop-gate detected concrete issues:"
for issue in "${issues[@]}"; do
  echo "  - $issue"
done
exit 0
