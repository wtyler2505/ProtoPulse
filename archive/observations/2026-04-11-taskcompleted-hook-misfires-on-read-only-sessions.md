---
observed_date: 2026-04-11
category: friction
severity: medium
resolved: true
resolution: "Rewrote all 4 implementation-biased hook prompts (Stop, TaskCompleted, SubagentStop, TeammateIdle) in .claude/settings.json to be context-aware: the new text explicitly branches on task type (code changes vs read-only vs infrastructure/docs) and instructs the hook reader to NOT produce generic 'cannot verify' responses when criteria don't apply. Fix is live immediately — no session restart needed because Claude Code re-reads settings.json prompts on each hook fire. Verified JSON validity post-edit."
---

# TaskCompleted hook self-review criteria assume implementation work and misfire on read-only sessions causing ignorable noise and false blockers

## Context

Discovered during the session-mining batch in Phase 4 of the session-mining-pipeline-rebuild plan. The mining runner surfaced the same pattern across four extant transcripts: every read-only session (`/resume`, `/status`, `/architect` in plan mode, any status-reporting or analysis-only turn) got flagged by a `TaskCompleted` or `Stop` hook whose self-review prompt asks:

> "Were all TypeScript errors fixed? Did relevant tests pass? Were any new files properly integrated? Is the implementation actually done or just half-done? If anything was left incomplete, block completion with a specific reason."

The criteria are implementation-specific. Read-only sessions have no TypeScript to compile, no tests to run, no files to integrate. The hook then returns a long "cannot verify completion" block-feedback paragraph that the agent has to acknowledge and step past. In several sessions the hook fires more than once within the same turn, producing duplicated noise that the agent can't silence.

## Signal

Four transcripts in the April 2026 mining batch surfaced the exact same hook behavior:

1. **`0364162b-c4cd-499d-a08e-5d700252e6bb`** (2026-04-10 14:22-14:37 UTC): a gemini-cli version-fix session. The hook fired three times with near-identical block-feedback paragraphs insisting on "TypeScript errors, test results, codebase state" even though the session was diagnosing a PATH issue in `.bashrc`. Actual quote from the stop-hook feedback:

   > "Work is incomplete. ... Per the self-review criterion, the work should be finished and verified before stopping, not handed off mid-verification."

2. **`8b4d9360-2b1a-4619-8006-b5c68447c3ae`** (2026-04-11 03:22-03:24 UTC): a `/resume` context-rebuild session. The hook fired and flagged:

   > "No actual work was performed in this session — the assistant gathered memory, file activity, git state, and checklists, then presented a summary with suggested next steps. ... no self-review of completed work, no verification of tests passing, and no decision made on whether to commit or refactor."

   This is exactly what `/resume` is supposed to do. The hook is treating status-gathering as a failure mode.

3. **`4fed4700-ae43-4275-95e3-7eda288bc822`** (2026-04-11 16:14-16:44 UTC): the `/architect` analysis in plan mode that produced the knowledge-vault-health-restoration plan. The hook fired with "This is an exploratory task ('Explore ... context') ... not a coding task with TypeScript errors, tests, or new file integration" — the agent correctly recognized the mismatch but still had to defend against the hook's default block condition.

4. **`a84c75ab-99a6-4f35-8a88-3ffb36a84423`** (2026-04-11 15:10-16:14 UTC): a /architect plan-review session. Hook flagged incomplete work during plan-mode review, producing:

   > "The hook's assessment is correct again. This was a second read-only response — listing the 5 findings the user explicitly asked for in plain text. No files were modified, no tests were run, no TypeScript was compiled."

In every case the agent had to defend the turn against an asserted completion criterion that didn't apply. The defense itself is a friction tax — it costs tokens, it's repetitive, and it trains a habit of "explain why the hook is wrong" which is the exact opposite of "do the work the hook is checking for."

This is the `Over-Automation` failure mode from `reference/failure-modes.md` #8: "Automation should fail loudly, not fix silently." Here the automation is failing loudly but at the wrong target — it's loud-failing on sessions that have nothing to fail.

## Potential Response

This is NOT an agent-behavior issue — it's a hook-design issue. The agent is doing the right thing (reporting status, writing plans, analyzing problems). The hook is applying implementation-task criteria to non-implementation tasks.

Possible fixes to consider (requires poking at `.claude/settings.json` and the wrapper scripts under `.claude/hooks/`):

1. **Gate the hook on tool usage.** If the session didn't call `Write`, `Edit`, or `MultiEdit`, skip the TypeScript/test/integration criteria entirely and instead check a simpler "did the session produce output" condition.

2. **Separate read-only sessions with a different matcher.** `/resume`, `/status`, `/architect` in plan mode, and any slash command marked `read_only: true` in its frontmatter should fire a different Stop hook or skip the implementation-completeness one.

3. **Make the hook prompt modular.** Instead of one all-purpose self-review paragraph, branch: if writes happened → ask about TypeScript/tests/integration; if only reads → ask about "did you answer the user's question completely."

4. **Accept the noise and train the agent to recognize it.** This is the path of least resistance — the agent writes a one-line "this hook criterion doesn't apply to read-only work" and moves on. Current behavior is already roughly this, but the hook re-fires multiple times per turn in some cases, which is the real pain point.

Out of scope here: actually fixing the hook. This observation is a signal. The fix lives in a separate `/architect` pass or `/rethink` session that specifically targets hook hygiene. Could be bundled with the earlier-identified "two hook groups have no explicit matcher" finding in `knowledge/dev-infrastructure.md` → Known Issues → the split session-capture hook group.

Promotion target: **do not promote to methodology yet.** One observation from four sessions is not enough to justify a behavioral rule. If the hook-noise pattern persists after Phase 2's capture-hook fix lands (future sessions will get mined too, and this observation lets us track whether the friction keeps appearing), promote to a methodology note on "how to handle the hook noise" OR file a hook-design task in `docs/plans/` to fix it upstream.

---

Topics:
- [[methodology]]
