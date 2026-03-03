---
name: ship
description: Run type check, tests, and git commit+push pipeline with safety checks
disable-model-invocation: true
---

# /ship

Safely ship changes: type check, test, commit, and push. Aborts on any failure.

## Arguments

- `message` (optional) — Custom commit message. If not provided, auto-generate from staged changes.
- `--no-push` — Commit but skip the push step.

## Pipeline

### Stage 1: Type Check

```bash
cd /home/wtyler/Projects/ProtoPulse && npm run check
```

- **MUST pass with zero errors.** If there are errors, print them all and ABORT.
- Do NOT attempt to fix errors automatically — report them to the user.

### Stage 2: Run Tests

```bash
cd /home/wtyler/Projects/ProtoPulse && npx vitest run
```

- **MUST pass with zero failures.** If tests fail, print the failures and ABORT.
- If no test files exist, print a warning but continue (tests are not yet comprehensive).

### Stage 3: Stage Files

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

### Stage 4: Commit

1. If custom message provided, use it
2. If no message, analyze the diff and generate a concise commit message:
   - Summarize the "why" not the "what"
   - Use imperative mood ("Fix contrast" not "Fixed contrast")
   - Keep under 72 characters for the subject line
3. Commit with Co-Authored-By:
   ```bash
   git commit -m "$(cat <<'EOF'
   {commit message}

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```
4. If commit fails (e.g., pre-commit hook): report the error and ABORT
   - Do NOT use `--no-verify`
   - Do NOT amend — if retrying, create a NEW commit

### Stage 5: Push (unless --no-push)

1. Check which remote branch the current branch tracks
2. Run `git push`
3. **NEVER force push** — if push is rejected, report the error and ABORT
4. Confirm push succeeded: `git log --oneline -1` and `git status`

### Final Report

```
Ship complete:
  Type check: PASS
  Tests: PASS (N tests)
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

- Verify we're in the ProtoPulse repo: check for `package.json` with name containing "protopulse" or the expected directory
- Warn if committing to `main` branch directly (but allow it — this is a personal project)
- Never expose secrets in commit messages or staged files
- Never use `--force`, `--no-verify`, or `--no-gpg-sign`
