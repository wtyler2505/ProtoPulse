#!/usr/bin/env bash
# ProtoPulse session mining runner
#
# Two modes:
#   1. Full-fidelity mode:
#        ops/queries/mine-session.sh <transcript.jsonl>
#      Reads a live Claude Code transcript and extracts friction
#      signals from BOTH user and assistant messages plus tool errors.
#
#   2. Recovery mode (transcript expired via retention):
#        ops/queries/mine-session.sh --recovery <session-uuid> [history-file]
#      Reads user-side messages from ~/.claude/history.jsonl indexed
#      by sessionId. Assistant responses and tool calls are gone, but
#      user-side friction signals (the richest mining vector anyway)
#      are recoverable. See ops/methodology/recover-user-messages-from-history-jsonl-when-transcript-expired.md
#      for context on why the grep-then-jq pattern is used instead of
#      streaming jq.
#
# Detection taxonomy (from /remember skill spec):
#   1. User corrections       -- direct "no/wrong/stop" followed by alternative
#   2. Repeated redirections  -- same correction appearing >1 time
#   3. Workflow breakdowns    -- tool errors, retries, wrong outputs
#   4. Agent confusion        -- questions the agent should have known
#   5. Undocumented decisions -- choices made without reasoning
#   6. Escalation patterns    -- tone shift from gentle to firm
#
# This is a REPORTING script, not a note-writing one. The agent reviews
# the report and decides which candidates become observations vs
# methodology notes vs discards.

set -uo pipefail

MODE="full"
TRANSCRIPT=""
SESSION_UUID=""
HISTORY_FILE="${HOME}/.claude/history.jsonl"

if [ "${1:-}" = "--recovery" ]; then
  MODE="recovery"
  SESSION_UUID="${2:-}"
  [ -n "${3:-}" ] && HISTORY_FILE="$3"
  if [ -z "$SESSION_UUID" ]; then
    echo "usage: $0 --recovery <session-uuid> [history-file]" >&2
    exit 2
  fi
  if [ ! -f "$HISTORY_FILE" ]; then
    echo "error: history file not found: $HISTORY_FILE" >&2
    exit 2
  fi
else
  TRANSCRIPT="${1:-}"
  if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
    echo "usage: $0 <transcript.jsonl>" >&2
    echo "       $0 --recovery <session-uuid> [history-file]" >&2
    exit 2
  fi
fi

if [ "$MODE" = "recovery" ]; then
  BASENAME="$SESSION_UUID"
  # Write recovered user messages to a temp file for grep-based mining
  RECOVERED_FILE="$(mktemp)"
  trap 'rm -f "$RECOVERED_FILE"' EXIT
  # Use grep-then-jq (streaming jq silently fails on malformed history lines)
  grep "\"sessionId\":\"$SESSION_UUID\"" "$HISTORY_FILE" 2>/dev/null \
    | jq -r '.display // empty' 2>/dev/null \
    > "$RECOVERED_FILE"
  BYTES="$(stat -c '%s' "$RECOVERED_FILE")"
  LINES="$(wc -l < "$RECOVERED_FILE")"
  FIRST_TS="$(grep "\"sessionId\":\"$SESSION_UUID\"" "$HISTORY_FILE" 2>/dev/null | head -1 | jq -r '.timestamp // empty' 2>/dev/null)"
  LAST_TS="$(grep "\"sessionId\":\"$SESSION_UUID\"" "$HISTORY_FILE" 2>/dev/null | tail -1 | jq -r '.timestamp // empty' 2>/dev/null)"
  # Convert epoch-ms timestamps to ISO where possible
  [ -n "$FIRST_TS" ] && FIRST_TS="$(date -d "@$((FIRST_TS / 1000))" -Iseconds 2>/dev/null || echo "$FIRST_TS")"
  [ -n "$LAST_TS" ] && LAST_TS="$(date -d "@$((LAST_TS / 1000))" -Iseconds 2>/dev/null || echo "$LAST_TS")"
  if [ "$LINES" -eq 0 ]; then
    cat <<EMPTYHEADER
# Friction Candidates — $BASENAME (recovery mode, empty)

**Session UUID:** \`$SESSION_UUID\`
**History file:** \`$HISTORY_FILE\`
**Result:** No user messages found in history.jsonl for this sessionId.
Session may have been too short to log any prompts, OR the UUID is
wrong, OR this session ran in a different project context.

EMPTYHEADER
    exit 0
  fi
else
  BASENAME="$(basename "$TRANSCRIPT" .jsonl)"
  BYTES="$(stat -c '%s' "$TRANSCRIPT")"
  LINES="$(wc -l < "$TRANSCRIPT")"
  FIRST_TS="$(head -20 "$TRANSCRIPT" | jq -r 'select(.timestamp) | .timestamp' 2>/dev/null | head -1)"
  LAST_TS="$(tail -20 "$TRANSCRIPT" | jq -r 'select(.timestamp) | .timestamp' 2>/dev/null | tail -1)"
fi

if [ "$MODE" = "recovery" ]; then
  cat <<HEADER
# Friction Candidates — $BASENAME (recovery mode, user-side only)

**Mode:** recovery (transcript expired; user messages recovered from history.jsonl)
**Session UUID:** \`$SESSION_UUID\`
**Recovered messages:** $LINES ($BYTES bytes)
**Time range:** $FIRST_TS → $LAST_TS

NOTE: This report covers ONLY user-side messages. Assistant responses,
tool calls, and tool results are unavailable because the full transcript
at ~/.claude/projects/.../${SESSION_UUID}.jsonl was deleted by Claude
Code retention cleanup. Sections 3 (Workflow Breakdowns) and 4 (Agent
Confusion) will be empty by definition — those require assistant-side
data that is gone.

---

HEADER
else
  cat <<HEADER
# Friction Candidates — $BASENAME

**Transcript:** \`$TRANSCRIPT\`
**Size:** $BYTES bytes / $LINES lines
**Time range:** $FIRST_TS → $LAST_TS

---

HEADER
fi

# Helper: extract user message text. User messages have shape
# {type:"user", message:{role:"user", content:"..."}}. Content may
# be a string OR an array of content blocks with .text fields.
extract_user_messages() {
  jq -r --unbuffered '
    select(.type == "user" and (.message.role // "") == "user")
    | (.message.content // "")
    | if type == "string" then .
      elif type == "array" then
        map(if type == "object" and has("text") then .text
            elif type == "object" and has("content") then (.content // "")
            else "" end) | join(" ")
      else ""
      end
  ' "$TRANSCRIPT" 2>/dev/null
}

# Helper: extract assistant text blocks (agent utterances).
extract_assistant_messages() {
  jq -r --unbuffered '
    select(.type == "assistant")
    | (.message.content // [])
    | if type == "array" then
        map(if type == "object" and .type == "text" then .text else "" end) | join(" ")
      else tostring end
  ' "$TRANSCRIPT" 2>/dev/null
}

# Helper: find tool_result entries with is_error:true
extract_tool_errors() {
  jq -r --unbuffered '
    select(.type == "user" and (.message.content // [] | type) == "array")
    | .message.content[]?
    | select(type == "object" and .type == "tool_result" and .is_error == true)
    | .content
    | if type == "string" then .
      elif type == "array" then map(.text // "") | join(" ")
      else "" end
  ' "$TRANSCRIPT" 2>/dev/null
}

if [ "$MODE" = "recovery" ]; then
  # Recovery mode: user messages come from the grep+jq recovered file,
  # assistant messages and tool errors are unavailable.
  USER_TEXT="$(cat "$RECOVERED_FILE")"
  AGENT_TEXT=""
  ERRORS_TEXT=""
else
  USER_TEXT="$(extract_user_messages)"
  AGENT_TEXT="$(extract_assistant_messages)"
  ERRORS_TEXT="$(extract_tool_errors)"
fi

# 1. User corrections -- keywords followed by redirection
echo "## 1. User Corrections"
echo ""
CORRECTION_HITS="$(echo "$USER_TEXT" | grep -iE '(^|[^a-z])(no,?|wrong|stop|don'"'"'t|never|not like that|incorrect|actually)([^a-z]|$)' | head -20)"
if [ -n "$CORRECTION_HITS" ]; then
  echo '```'
  echo "$CORRECTION_HITS" | sed 's/^/- /' | head -20
  echo '```'
else
  echo '_None detected._'
fi
echo ""

# 2. Repeated redirections -- same correction >=2x
echo "## 2. Repeated Redirections"
echo ""
REPEATS="$(echo "$USER_TEXT" | grep -iE '(again|already said|the (third|fourth|fifth) time|why did you)' | head -10)"
if [ -n "$REPEATS" ]; then
  echo '```'
  echo "$REPEATS" | sed 's/^/- /'
  echo '```'
else
  echo '_None detected._'
fi
echo ""

# 3. Workflow breakdowns -- tool errors + retry patterns
echo "## 3. Workflow Breakdowns"
echo ""
if [ -n "$ERRORS_TEXT" ]; then
  echo '```'
  echo "$ERRORS_TEXT" | head -20 | sed 's/^/- /'
  echo '```'
else
  echo '_None detected._'
fi
echo ""

# 4. Agent confusion -- agent questions that suggest missing context
echo "## 4. Agent Confusion"
echo ""
CONFUSION="$(echo "$AGENT_TEXT" | grep -iE '(should I|what would you like|which approach|unclear|not sure|can you clarify)' | head -10)"
if [ -n "$CONFUSION" ]; then
  echo '```'
  echo "$CONFUSION" | sed 's/^/- /'
  echo '```'
else
  echo '_None detected._'
fi
echo ""

# 5. Undocumented decisions -- user directives without explanation
echo "## 5. Undocumented Decisions"
echo ""
DIRECTIVES="$(echo "$USER_TEXT" | grep -iE '(always|never|from now on|prefer|skip|ignore)' | head -10)"
if [ -n "$DIRECTIVES" ]; then
  echo '```'
  echo "$DIRECTIVES" | sed 's/^/- /'
  echo '```'
else
  echo '_None detected._'
fi
echo ""

# 6. Escalation patterns -- profanity + strong directives
echo "## 6. Escalation Patterns"
echo ""
ESCALATION="$(echo "$USER_TEXT" | grep -iE '(fuck|shit|dammit|absolutely|mandatory|must)' | head -10)"
if [ -n "$ESCALATION" ]; then
  echo '```'
  echo "$ESCALATION" | sed 's/^/- /'
  echo '```'
else
  echo '_None detected._'
fi
echo ""

echo "---"
echo ""
echo "**Next step:** the executing agent reviews each section, classifies"
echo "true friction signals (not false positives), and decides whether"
echo "each becomes an observation note, a methodology note, or gets"
echo "discarded as noise. Raw grep hits are candidates, not conclusions."
