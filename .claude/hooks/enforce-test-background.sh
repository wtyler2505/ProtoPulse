#!/usr/bin/env bash
# enforce-test-background.sh — PreToolUse hook for Bash.
#
# Blocks any Bash invocation of a test command that is NOT using
# run_in_background: true. Forces tests to run in the background so the
# never-idle-while-waiting hook can fire and the session can progress with
# productive parallel work while tests run.
#
# Rule origin: Tyler 2026-04-11 — "set it up to where all npm tests and
# all vitests automatically run in the background."
#
# Matches:
#   - npm test / npm run test (any suffix)
#   - vitest run / npx vitest / npx vitest run
#
# Does NOT block:
#   - Bash calls with run_in_background: true already set
#   - Non-test commands
#   - claudekit's internal test-changed invocations (those run via child
#     process, not via the Bash tool, so this hook doesn't see them)

set -uo pipefail

INPUT=$(cat)

PARSE_SCRIPT='
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get("tool_input", {}) or {}
    rib = "True" if ti.get("run_in_background") else "False"
    cmd = ti.get("command", "") or ""
    print(rib)
    print(cmd)
except Exception:
    print("False")
    print("")
'

PARSED="$(echo "$INPUT" | python3 -c "$PARSE_SCRIPT" 2>/dev/null)"
RIB="$(echo "$PARSED" | sed -n '1p')"
COMMAND="$(echo "$PARSED" | sed -n '2,$p')"

# Already backgrounded? Pass through.
if [ "${RIB:-False}" = "True" ]; then
  echo '{}'
  exit 0
fi

# Detect test commands
cmd_lower="$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')"

is_test=false
# npm test / npm run test (and any suffix like test:coverage, test:watch, test -- path)
if echo "$cmd_lower" | grep -Eq 'npm (run )?test(\b|:)'; then
  is_test=true
fi
# vitest run (with or without npx prefix, with or without path filters)
if echo "$cmd_lower" | grep -Eq '(\bnpx )?vitest( run)?\b'; then
  is_test=true
fi

if [ "$is_test" = "false" ]; then
  echo '{}'
  exit 0
fi

# Test command without run_in_background — block with reason.
# JSON to stderr + exit 2 (Claude Code hook convention for blocking decisions).
cat >&2 <<'EOF'
{"decision": "block", "reason": "Test commands MUST be spawned with run_in_background: true. Re-issue the Bash call with that flag. Why: (1) tests take minutes and foreground runs block the session (the tier classifier in never-idle-while-waiting.sh cannot fire on foreground calls), (2) multi-agent context sharing requires log output so pipe to tee, (3) Tyler's rule 2026-04-11 mandates backgrounded tests. To also write a log for later inspection, wrap the command like: 'NODE_OPTIONS=\"--max-old-space-size=4096\" npx vitest run --project server 2>&1 | tee logs/tests-server-latest.log | tail -10' — the background task captures the last 10 lines while the full output lands in the log file. Re-issue the same command with run_in_background: true."}
EOF
exit 2
