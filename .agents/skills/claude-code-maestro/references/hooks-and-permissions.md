# Hooks & Permissions Reference

## 1. Permissions & Sandboxing
Claude Code evaluates permission rules in this order: deny -> ask -> allow.
*   **Syntax:** `Tool` or `Tool(specifier)`. e.g., `Bash(npm run *)`, `Read(./.env)`.
*   **Sandboxing:** OS-level isolation (Seatbelt on macOS, bubblewrap on Linux/WSL2). Configured via `sandbox.filesystem.allowWrite` and `sandbox.network.allowedDomains`.
*   **Modes:** 
    *   `default`: reads only without asking
    *   `acceptEdits`: auto-approves file edits and safe commands (`mkdir`, `cp`)
    *   `plan`: read-only research
    *   `auto`: auto-approves everything using a secondary classifier model
    *   `dontAsk`: only pre-approved tools
    *   `bypassPermissions`: skips all checks (containers only).

## 2. Hooks (`.claude/settings.json`)
Hooks intercept Claude's lifecycle events.

### Events
*   `PreToolUse`: Before a tool is called.
*   `PostToolUse`: After a tool completes.
*   `Stop`: Before returning control to the user.
*   `SubagentStart`, `SubagentStop`: Agent lifecycle.
*   `TaskCompleted`: When a background task finishes.
*   `SessionStart`: On launch.
*   `Notification`: When Claude needs attention.
*   `ConfigChange`, `CwdChanged`, `FileChanged`, `PermissionRequest`, `Elicitation`, `ElicitationResult`.

### Types
*   `"command"`: Executes a shell script. Use `"timeout"` and `"async": true` (for long-running).
*   `"prompt"`: Evaluates a prompt against an LLM (outputs JSON).
*   `"agent"`: Evaluates against a subagent.
*   `"http"`: POSTs to a webhook.

### Filtering
*   **`matcher`:** Regex filter for tool names (e.g., `"matcher": "Edit|Write"` or `"matcher": "mcp__.*"`).
*   **`if`:** Glob-style filter for tool *arguments* (e.g., `"if": "Bash(git *)"`). Far more precise than `matcher`.

### Output (Structured JSON)
Command hooks must exit 0 and print valid JSON to `stdout` to dictate behavior. Any non-JSON output on stdout will break the hook. Use `jq` to parse `stdin`.
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse", 
    "permissionDecision": "deny", 
    "permissionDecisionReason": "Blocked by policy"
  },
  "additionalContext": "Extra context for the LLM"
}
```
