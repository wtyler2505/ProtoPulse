#!/usr/bin/env bash
# ProtoPulse session mining runner
# Usage: ops/queries/mine-session.sh <transcript.jsonl>
# Outputs a markdown friction-candidate report to stdout.
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

TRANSCRIPT="${1:-}"
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  echo "usage: $0 <transcript.jsonl>" >&2
  exit 2
fi

BASENAME="$(basename "$TRANSCRIPT" .jsonl)"
BYTES="$(stat -c '%s' "$TRANSCRIPT")"
LINES="$(wc -l < "$TRANSCRIPT")"
FIRST_TS="$(head -20 "$TRANSCRIPT" | jq -r 'select(.timestamp) | .timestamp' 2>/dev/null | head -1)"
LAST_TS="$(tail -20 "$TRANSCRIPT" | jq -r 'select(.timestamp) | .timestamp' 2>/dev/null | tail -1)"

cat <<HEADER
# Friction Candidates — $BASENAME

**Transcript:** \`$TRANSCRIPT\`
**Size:** $BYTES bytes / $LINES lines
**Time range:** $FIRST_TS → $LAST_TS

---

HEADER

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

USER_TEXT="$(extract_user_messages)"
AGENT_TEXT="$(extract_assistant_messages)"
ERRORS_TEXT="$(extract_tool_errors)"

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
