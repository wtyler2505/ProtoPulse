---
name: Always write test output to a persistent log file
description: Runtime behavior change — every test invocation writes to logs/tests-latest.log so multi-agent sessions and troubleshooting can share results without re-running
type: queue
priority: high
created: 2026-04-11
status: pending
source: "Tyler direct ask 2026-04-11 during Phase 2 test run"
---

# Always write test output to a persistent log file (plus rotation)

## Tyler's ask

> "Why don't you always run tests that output to a log file? That way, you don't have to rerun tests that fail or tests that don't output all the information you need. [...] having a log file will be very helpful whenever using multiple agents. For example, codex, you, Gemini — if you run tests with one agent, the other agents will be able to at any time look and see what the results were."

## Why it's right

1. **No re-runs for verbose output.** The pattern I hit in this session: initial run gets truncated, failure details are lost, I re-run with `> /tmp/log.txt` to get the full output. That's wasted compute and paid time.
2. **Multi-agent context sharing.** When Codex or Gemini runs tests, I need to be able to read what they saw. A persistent log lets me do that without asking them to re-run.
3. **Historical troubleshooting.** "The test passed last week but fails now — what changed?" is answerable when the log is persistent.
4. **Audit trail.** Proof that a commit was test-verified at a specific time, for retroactive verification.

## Drawbacks (and how to mitigate)

| Drawback | Mitigation |
|---|---|
| Unbounded growth over time | Rotate at 10MB or 7 days; keep `logs/tests-latest.log` as primary + `logs/tests-history/YYYY-MM-DD-HHMMSS.log` for archive |
| Concurrent test runs may interleave | Use `tee` with flock OR timestamp-per-run files; primary is one-writer-at-a-time |
| Transient failures buried in history | `logs/tests-latest.log` always reflects the most recent run; history is secondary |
| Sensitive data in logs (API keys, connection strings) | Same sanitization rules as winston logger — redact `process.env.*_KEY`, `*_SECRET`, DB connection strings |
| Gitignored but still on disk | Add `logs/` to `.gitignore`; never commit logs |

## Implementation plan

### 1. Update `package.json` test scripts

Add wrapper scripts that tee output to the log:

```json
"scripts": {
  "test": "vitest run",
  "test:logged": "mkdir -p logs && vitest run 2>&1 | tee logs/tests-latest.log",
  "test:server": "vitest run --project server",
  "test:server:logged": "mkdir -p logs && vitest run --project server 2>&1 | tee logs/tests-server-latest.log",
  "test:client": "vitest run --project client",
  "test:client:logged": "mkdir -p logs && vitest run --project client 2>&1 | tee logs/tests-client-latest.log"
}
```

Alternative: replace `test` with the logged version so it's always on. Decision point: should the logging be opt-out or default?

**Recommendation: default ON.** The cost is trivial (a tee pipe) and the benefit is universal. Add `test:quiet` as the opt-out for rare cases where log output is undesired.

### 2. Update `.gitignore`

```
logs/
```

### 3. Update the test-changed hook

The PostToolUse hook `claudekit-hooks run test-changed` should also write to the log. If claudekit doesn't natively support log output, wrap it in a bash script that pipes to the log.

### 4. Update AGENTS.md

Add a note under Build & Commands:

> **Always use `npm test` or `npm run test:logged`** — tests write to `logs/tests-latest.log` for multi-agent visibility and troubleshooting. Do NOT use raw `npx vitest run` without tee'ing to a log.

### 5. Update `memory/codebase_patterns.md`

Add the test-logging convention so future sessions remember it.

### 6. Rotation script

Cron or on-demand script: `scripts/rotate-test-logs.sh`
- Move `logs/tests-latest.log` → `logs/tests-history/$(date +%Y%m%d-%H%M%S).log` if >10MB
- Delete history files older than 14 days

## Acceptance criteria

- `npm test` writes all output to `logs/tests-latest.log` via tee
- `logs/` is gitignored
- AGENTS.md documents the convention
- A second agent running in the same repo can read `logs/tests-latest.log` and see the most recent run without re-running tests
- Rotation script caps log size at 10MB / 14 days

## Estimated scope

- 1 hour: package.json scripts + .gitignore + AGENTS.md + memory note
- 30 min: rotation script + cron entry
- 30 min: validate with a full test run, confirm log is readable

## When to implement

**After Phase 2 commits land.** Do not mix this infrastructure change with the parts-consolidation work. Separate commit, separate scope.
