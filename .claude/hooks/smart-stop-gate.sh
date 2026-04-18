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
