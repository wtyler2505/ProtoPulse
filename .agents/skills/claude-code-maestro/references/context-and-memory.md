# Context, Memory, & Tooling Reference

## 1. Context Window Dynamics
Claude Code manages its context window aggressively.

### Startup Loading
The following are loaded BEFORE the user's first prompt:
*   `CLAUDE.md` (Project root guidelines). Must be kept under 200 lines.
*   `MEMORY.md` (Auto-generated insights, up to 200 lines/25KB).
*   MCP tools (deferred/listed).
*   Skill descriptions (one-liners).

### Path-Scoped Rules
Markdown files in `.claude/rules/*.md` with `paths:` YAML frontmatter (e.g., `paths: ["src/**/*.ts"]`) load dynamically ONLY when a matching file is read or edited.

### Compaction (`/compact`)
Compaction replaces the conversation history with a structured summary when the token limit is neared.
*   **Reloaded:** System prompts, `CLAUDE.md`, and auto memory (`MEMORY.md`).
*   **Lost:** Path-scoped rules and nested `CLAUDE.md` files (until a matching file is read again).
*   **Injected:** Invoked skill bodies are re-injected (capped at 5k tokens per skill).

## 2. Tools & Integrations

### Built-in Tools
*   `Bash`, `Edit`, `Write`, `Read`, `Glob`, `Grep`
*   `Monitor`: Runs a background script and watches output line-by-line.
*   `CronCreate`, `CronDelete`, `CronList`: Schedules tasks within the session.
*   `LSP`: Code intelligence via language servers (jump to def, find refs).
*   `ToolSearch`: Searches for deferred MCP tools.

### Headless Mode (`claude -p`)
Run programmatically for CI/CD or automation:
`claude -p "prompt" --bare --output-format json --json-schema '{"type":"object", ...}'`
*   `--bare` strips local configs for consistent CI runs.

### Agent SDK
Claude Code is available as a library: `@anthropic-ai/claude-agent-sdk` (TS) and `claude-agent-sdk` (Python).
*   Includes built-in tools out of the box.
*   Allows programmatic hook configuration and subagent spawning.

### Key Environment Variables
*   `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`: Native PowerShell on Windows.
*   `ENABLE_TOOL_SEARCH=true`: Defers MCP tools until searched.
*   `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1`: Resets `cd` after each Bash command.
*   `CLAUDE_AUTO_BACKGROUND_TASKS=1`: Forces long-running subagents to the background.
