---
name: claude-code
description: "Drive the claude CLI from scripts or another agent: print mode, tmux interactive sessions, dialog handling. NOT needed inside a Claude Code session."
---

# Driving the claude CLI

Recipes for invoking Claude Code programmatically. Two modes: print mode (`-p`, one-shot, no TUI) and interactive TUI via tmux.

## Print Mode (`-p`) — preferred for one-shot tasks

Runs a task, prints the result, exits. Skips all interactive dialogs (trust, permissions).

```bash
claude -p 'Add error handling to all API calls in src/' --allowedTools 'Read,Edit' --max-turns 10
cat src/auth.py | claude -p 'Review this code for bugs' --max-turns 1   # piped input
git diff main...feature | claude -p 'Review this diff thoroughly' --max-turns 1
```

Key flags:
- `--max-turns <n>` — cap agentic loops (print-mode only; start with 5-10)
- `--allowedTools 'Read,Edit,Bash(git *)'` — restrict to what the task needs
- `--permission-mode bypassPermissions` or `--dangerously-skip-permissions` — no prompts (print mode never shows the warning dialog)
- `--model haiku|sonnet|opus`, `--fallback-model haiku` (auto-fallback on overload)
- `--max-budget-usd <n>` — spend cap (minimum ~$0.05)
- `--bare` — skip hooks/plugins/MCP/CLAUDE.md/OAuth; needs `ANTHROPIC_API_KEY`. Fastest for CI.
- `-c` / `--resume <session_id>` / `--fork-session` — continue or fork sessions (same directory)

## Structured Output

```bash
claude -p 'Analyze auth.py for security issues' --output-format json --max-turns 5
```

JSON result fields: `result`, `session_id` (for `--resume`), `num_turns`, `total_cost_usd`, `subtype` (`success` | `error_max_turns` | `error_budget`).

Streaming (newline-delimited JSON events):

```bash
claude -p 'Explain X' --output-format stream-json --verbose --include-partial-messages | \
  jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

Schema-validated extraction (needs enough `--max-turns` to read files first):

```bash
claude -p 'List all functions in src/' --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}' --max-turns 5
# parse .structured_output from the result
```

## Interactive Sessions via tmux

Claude Code is a full TUI; multi-turn orchestration needs tmux (`capture-pane` to read, `send-keys` to type).

```bash
tmux new-session -d -s claude-work -x 200 -y 50
tmux send-keys -t claude-work 'cd /path/to/project && claude' Enter
sleep 5 && tmux send-keys -t claude-work 'Refactor the auth module to use JWT' Enter
sleep 15 && tmux capture-pane -t claude-work -p -S -50          # monitor
tmux send-keys -t claude-work 'Now add unit tests' Enter        # follow-up
tmux send-keys -t claude-work '/exit' Enter                     # done
tmux kill-session -t claude-work                                # always clean up
```

Reading the pane: `❯` at the bottom = waiting for input (done or asking); `●` lines = actively running tools.

## Dialog Choreography (first launch)

**Dialog 1 — workspace trust** (first visit to a directory; cached afterward). Default is "Yes, trust":

```bash
sleep 4 && tmux send-keys -t claude-work Enter
```

**Dialog 2 — bypass-permissions warning** (every launch with `--dangerously-skip-permissions`). Default is "No, exit" — you MUST navigate down first:

```bash
sleep 3 && tmux send-keys -t claude-work Down && sleep 0.3 && tmux send-keys -t claude-work Enter
```

Full sequence:

```bash
tmux send-keys -t claude-work 'claude --dangerously-skip-permissions "your task"' Enter
sleep 4 && tmux send-keys -t claude-work Enter                                   # trust
sleep 3 && tmux send-keys -t claude-work Down && sleep 0.3 && tmux send-keys -t claude-work Enter  # accept bypass
sleep 15 && tmux capture-pane -t claude-work -p -S -60
```

## Gotchas

1. Print mode skips both dialogs entirely — prefer it when you don't need multi-turn.
2. `--max-turns` and `--max-budget-usd` are print-mode only.
3. Session resume (`-c`/`--resume`) finds sessions per working directory.
4. Slash commands only work in interactive mode; in `-p`, describe the task in natural language.
5. Kill leftover tmux sessions; don't kill slow ones — capture the pane and check progress first.
