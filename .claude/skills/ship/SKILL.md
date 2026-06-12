---
name: ship
description: Full ship pipeline — typecheck (root + packages engine), tests (root + packages, background-compliant), then git commit+push with safety checks. Use for deliberate milestone commits with a real message — when work is verified-done and Tyler says "ship it", "commit and push", "milestone commit", or "lock this in". Routine saves don't need it (the auto-commit hook handles those).
disable-model-invocation: true
---

# /ship

Safely ship changes: type check (root + engine packages), test (root + engine packages), commit, and push. Aborts on any failure.

## Interaction with the auto-commit / auto-push automation

- A PostToolUse hook (`.claude/hooks/auto-commit-vault.sh`) already sweeps edits into "Auto: N files" commits, and an auto-push cron + Stop hook (`~/.claude/scripts/auto-push-protopulse.sh`) pushes main periodically.
- /ship exists for **deliberate milestone commits with real messages** — a verified (typecheck + tests green) commit pushed immediately, not whenever the cron next fires.
- Because auto-commit runs constantly, `git status` may already be clean at Stage 4. That is normal: report "changes already committed by automation", skip the commit, and still run the verification stages + push.

## Arguments

- `message` (optional) — Custom commit message. If not provided, auto-generate from staged changes.
- `--no-push` — Commit but skip the push step.

## Pipeline

### Stage 1: Type Check (root)

```bash
cd /home/wtyler/Projects/ProtoPulse && npm run check
```

- Covers the root app (client/server/shared). **MUST pass with zero errors.** If there are errors, print them all and ABORT.
- Do NOT attempt to fix errors automatically — report them to the user.

### Stage 2: Type Check (engine packages)

```bash
cd /home/wtyler/Projects/ProtoPulse && npm run check:packages
```

- Covers the `packages/*` workspace monorepo (`tsc -p packages`). **MUST pass with zero errors.** Same abort rule as Stage 1.

### Stage 3: Run Tests (background-compliant — REQUIRED)

The project's PreToolUse hook (`.claude/hooks/enforce-test-background.sh`) **BLOCKS any foreground `npm test` / `npx vitest run` / `npm run test:packages`**. Both suites MUST be issued as Bash calls with `run_in_background: true`, teeing output to a log, then waited on and exit-code-asserted.

1. **Root suite** — Bash with `run_in_background: true`:
   ```bash
   cd /home/wtyler/Projects/ProtoPulse
   mkdir -p logs
   set -o pipefail
   npm test 2>&1 | tee logs/ship-tests-root.log | tail -20
   ```
2. **Engine packages suite** — Bash with `run_in_background: true` (may run concurrently with the root suite):
   ```bash
   cd /home/wtyler/Projects/ProtoPulse
   mkdir -p logs
   set -o pipefail
   npm run test:packages 2>&1 | tee logs/ship-tests-packages.log | tail -20
   ```
3. **WAIT for both background tasks to exit.** Do not proceed to Stage 4 on partial output.
4. **Assert BOTH exit codes are 0.** `set -o pipefail` makes the tee pipeline carry the test exit code. On any nonzero exit, print the tail of the corresponding `logs/ship-tests-*.log` and ABORT.

- Workspaces without test scripts are skipped by `--if-present` — that is fine, not a failure.
- If no test files exist at the root, print a warning but continue (tests are not yet comprehensive).

### Stage 4: Stage Files

1. Run `git status` to see all changes
2. Stage specific files using `git add <file>` for each modified/new file
3. **NEVER stage these files:**
   - `.env`, `.env.*` — secrets
   - `.mcp.json` — API keys
   - `*.pem`, `*.key` — certificates
   - `credentials.json`, `secrets.*` — credentials
   - `node_modules/` — dependencies
4. **NEVER use `git add -A` or `git add .`** — always stage specific files
5. Show the user what will be committed: `git diff --cached --stat`
6. If there is nothing to stage (auto-commit already swept it), say so and continue to Stage 6.

### Stage 5: Commit

1. If custom message provided, use it
2. If no message, analyze the diff and generate a concise commit message:
   - Summarize the "why" not the "what"
   - Use imperative mood ("Fix contrast" not "Fixed contrast")
   - Keep under 72 characters for the subject line
3. Commit with a Co-Authored-By trailer using the **current model identity from the system prompt** — do NOT hardcode a model name; read your own identity at run time:
   ```bash
   git commit -m "$(cat <<'EOF'
   {commit message}

   Co-Authored-By: {current model identity from the system prompt} <noreply@anthropic.com>
   EOF
   )"
   ```
4. If commit fails (e.g., pre-commit hook): report the error and ABORT
   - Do NOT use `--no-verify`
   - Do NOT amend — if retrying, create a NEW commit

### Stage 6: Push (unless --no-push)

1. Check which remote branch the current branch tracks
2. Run `git push`
3. **NEVER force push** — if push is rejected, report the error and ABORT
4. Confirm push succeeded: `git log --oneline -1` and `git status`

### Final Report

```
Ship complete:
  Type check (root): PASS
  Type check (packages): PASS
  Tests (root): PASS (N tests) — logs/ship-tests-root.log
  Tests (packages): PASS — logs/ship-tests-packages.log
  Committed: {short hash} {message}
  Pushed to: origin/{branch}
  Files: {count} files changed
```

## Abort Behavior

If ANY stage fails, immediately stop and report:

```
Ship ABORTED at Stage {N}: {stage name}
  Error: {error details}

  No changes were committed or pushed.
  Fix the issues above and run /ship again.
```

Do NOT continue to later stages after a failure. Do NOT attempt automatic fixes.

## Safety Checks

- Verify we're in the ProtoPulse repo — by **git remote URL or directory name, NOT package name** (the root package is named `rest-express`):
  ```bash
  git remote get-url origin   # must contain github.com/wtyler2505/ProtoPulse
  ```
  Fallback: `basename "$(git rev-parse --show-toplevel)"` equals `ProtoPulse`. In a worktree under `.claude/worktrees/` the directory check reports the worktree name, so the remote-URL check is the authoritative one.
- Warn if committing to `main` branch directly (but allow it — this is a personal project)
- Never expose secrets in commit messages or staged files
- Never use `--force`, `--no-verify`, or `--no-gpg-sign`
