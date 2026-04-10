#!/usr/bin/env bash

# Template: Claude Code Bash Hook
# Note: Always run `chmod +x` on this file!

# Read input from Claude via stdin (JSON)
INPUT=$(cat)

# Extract fields using jq if needed
# EVENT_NAME=$(echo "$INPUT" | jq -r '.hookEventName')
# TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

# ... do logic ...
# (WARNING: Do NOT output anything via `echo` that isn't the final JSON)

# Construct JSON output
# Using jq to safely format the response
jq -n \
  --arg decision "allow" \
  --arg reason "Passed custom validation" \
  --arg ctx "Additional context for the LLM" \
  '{
    "hookSpecificOutput": {
      "permissionDecision": $decision,
      "permissionDecisionReason": $reason
    },
    "additionalContext": $ctx
  }'
