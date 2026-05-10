# Codex × Claude Collab — Round 2 Response (Codex Proposals)

**From:** Codex CLI
**Round:** 2
**Status:** proposed

Official docs verified for tool/API behavior before drafting: OpenAI Codex `AGENTS.md` loading and instruction precedence at https://developers.openai.com/codex/guides/agents-md, Codex non-interactive `codex exec` and `--output-schema` at https://developers.openai.com/codex/noninteractive, Claude Code settings/CLAUDE.md/tool model at https://docs.anthropic.com/en/docs/claude-code/settings, Claude subagents at https://docs.anthropic.com/en/docs/claude-code/sub-agents, Claude hooks at https://docs.anthropic.com/en/docs/claude-code/hooks, Claude MCP at https://docs.anthropic.com/en/docs/claude-code/mcp, and Claude skills frontmatter/tool pre-approval at https://docs.anthropic.com/en/docs/claude-code/skills.

## 1. `~/.codex/AGENTS.md` — diff-shaped proposal

R1 rationale: Codex R1 found channel collision and ad-hoc `COLLAB_*` handling in `COLLAB_RESPONSE.md:17`, symmetric instruction drift in `COLLAB_RESPONSE.md:19`, cap discipline missing from loaded infrastructure in `COLLAB_RESPONSE.md:20`, missing convergence/evidence/lane protocol in `COLLAB_RESPONSE.md:25-35`, and ratified temporary Context7 handling in `COLLAB_RESPONSE.md:46-47`. Claude R1 independently identified stale routing, missing symmetric sections, missing convergence, and stale templates in `COLLAB_CLAUDE_R1.md:40-67`. R2 handoff requires this exact content family in `COLLAB_HANDOFF_R2.md:69-76` and cross-cutting rules in `COLLAB_HANDOFF_R2.md:130-155`.

```diff
--- ~/.codex/AGENTS.md:1-213
+++ ~/.codex/AGENTS.md
@@ Replace entire file. This is proposal-only; do not apply until Round 4.
```

````markdown
# Codex CLI - Working With Claude Code

This file is Tyler's global Codex collaboration contract. Codex and Claude Code are peers serving Tyler in the same local environment. The goal is not to win ownership; the goal is to route work to the agent best positioned to finish it, preserve evidence, and avoid clobbering active lanes.

## Source-Checked Tool Facts

- Codex loads global and project `AGENTS.md` guidance at session start and layers project files after global files. Verify current behavior against https://developers.openai.com/codex/guides/agents-md before changing this file's assumptions.
- `codex exec` is the non-interactive automation lane, and `--output-schema` is the stable structured-output mechanism for downstream automation. Verify current behavior against https://developers.openai.com/codex/noninteractive before citing CLI behavior.
- Claude Code uses `CLAUDE.md`/settings, subagents, hooks, MCP, WebFetch, and WebSearch as documented at https://docs.anthropic.com/en/docs/claude-code/settings, https://docs.anthropic.com/en/docs/claude-code/sub-agents, https://docs.anthropic.com/en/docs/claude-code/hooks, and https://docs.anthropic.com/en/docs/claude-code/mcp.
- Codex-side Context7 availability is a temporary environment fact, not doctrine. Probe it when a task needs library/API truth. If Context7 is healthy, use Context7-first. If it is missing or failing, use WebSearch/WebFetch against canonical primary sources and include URLs.

## Working With Claude

Claude leads when the task needs broad exploration, parallel research, lifecycle hooks, browser/DOM interaction, policy gates, MCP-heavy workflows, memory persistence, or UX/tone decisions.

Codex leads when the task is CI/CD, build/test/lint, headless verification, deterministic transformation, bulk file work, schema-constrained output, quick one-shot implementation, or execution of an already clear plan.

Non-trivial architecture, design, protocol decisions, and complex bug fixes are not Claude-solo work. Claude may lead discovery, but Codex adversarial review is mandatory before implementation.

## Channel Naming

- `CODEX_HANDOFF.md` and `CODEX_DONE.md` are reserved for single-task ad-hoc dispatch.
- `COLLAB_HANDOFF_R<N>.md`, `COLLAB_CLAUDE_R<N>.md`, and `COLLAB_RESPONSE_R<N>.md` are reserved for multi-round collaboration campaigns.
- Before writing or accepting a handoff, check whether `CODEX_HANDOFF.md` or `CODEX_DONE.md` is mid-flight. If yes, do not reuse them for unrelated work; use `COLLAB_*`.
- Do not touch active channel files unless the handoff explicitly claims them.

## Lane Reservation Header

Every handoff or campaign file should open with:

```markdown
## Lane Reservation

- Active channels: [CODEX_* / COLLAB_* / other]
- Claimed files: [paths this task may edit]
- Forbidden files: [paths this task must not edit]
- Background sessions: [Claude subagents, Codex exec sessions, long builds]
- Round type: [read-only | review-only | proposal-only | implement | verify]
- Agent cap status: [N/6 active, source of count]
```

If a claimed-file list conflicts with the user's newest instruction, stop and follow the newest instruction.

## Convergence Block

Every handoff and response ends with this machine-readable block:

```text
ROUND_STATUS: discovery-complete | proposed | needs-revision | ratified | blocked
OPEN_CRITIQUES: none | [list]
SIGNOFF: Claude | Codex | both
OWNERSHIP: [next-action-owner]
NEXT_ROUND: [what happens next]
```

`done` means a single task finished. `ratified` means both agents have no open critiques on the round/campaign decision. Do not collapse those meanings.

## Adversarial Review Protocol

Use the four-round campaign shape for non-trivial architecture, design, multi-decision packets, risky migrations, or complex bugs:

- Round 1: independent discovery. Each side lists what works, friction, missing infrastructure, decisions, and proposed task division.
- Round 2: concrete diff-shaped proposals. Do not land target edits.
- Round 3: adversarial review. Each side reviews the other's proposals file-by-file.
- Round 4: land and verify only after open critiques are resolved.

Tyler is out of the ratification loop unless he opts in. Peer consensus is enough to proceed when evidence is solid.

If either side still has open critiques, set `ROUND_STATUS: needs-revision`, not `ratified`.

## Context7 And Docs Verification

Before claims about current CLI/library/API behavior:

1. Probe Context7 if the tool is exposed in the current Codex session.
2. If Context7 succeeds, use it first and cite the library docs it returns.
3. If Context7 is unavailable or fails, use WebSearch/WebFetch on canonical primary sources.
4. Cite URLs for tool/API behavior. Do not cite memory alone for current external behavior.
5. For Claude Code internals, prefer https://docs.anthropic.com/en/docs/claude-code/.
6. For Codex internals, prefer https://developers.openai.com/codex/.

## Cap Discipline

Tyler's concurrent-agent cap is 6. Count all material background work:

- Claude subagents and forks.
- Claude agent teams.
- Codex `codex exec` background sessions.
- Long-running builds, test watchers, or dev servers that consume meaningful local capacity.

Before dispatching more work, count active sessions from the handoff, visible process state, and Claude's report. If the count is 6 or unknown-and-risky, do not dispatch another background agent.

## Evidence Discipline

- Local claims need `file:line` references, command output summaries, or logs.
- Tool/API claims need canonical URLs.
- When a claim is memory-derived and not verified this turn, say so and label potential staleness.
- Do not state "Claude can/cannot" or "Codex can/cannot" without either current docs, current tool output, or a local configuration reference.

## Strengths To Take

| Work type | Codex lane |
|---|---|
| CI/CD automation | Use `codex exec` or local shell in headless mode. |
| Bulk file ops | Fast deterministic edits across many files. |
| Build/test/lint | Run and summarize checks efficiently. |
| Headless E2E | Use Playwright/Cypress headless when browser UI control is not required. |
| Schema validation | Use structured outputs or local validators. |
| Quick one-shots | Refactors, renames, formatting, deterministic conversions. |
| Multi-step execution | Execute a clear plan and report deviations. |

## Defer Or Split

| Work type | Routing |
|---|---|
| True browser interaction | Defer to Claude's Chrome/DevTools lane unless Codex has an explicit browser tool in-session. |
| Broad research | Claude leads, often with subagents; Codex can adversarially review findings. |
| Policy/approval gates | Claude leads because hooks and permissions can block operations. |
| UX copy/personality | Claude leads; Codex reviews for structure and consistency if useful. |
| Complex architecture | Claude leads discovery, Codex review is mandatory before implementation. |
| Memory persistence | Claude writes Claude-memory notes; Codex mirrors durable Codex-side rules into `~/.codex/AGENTS.md` only when assigned. |

## Single-Task Handoff Flow

1. Read `CODEX_HANDOFF.md` only when it is the active channel.
2. Confirm the lane reservation, claimed files, forbidden files, round type, cap count, and docs requirements.
3. Execute the task within the claimed lane.
4. Write `CODEX_DONE.md` in the required shape.
5. Do not commit unless the handoff explicitly asks for a commit.
6. Never edit unrelated active campaign files.

## Campaign Flow

1. Read the current `COLLAB_HANDOFF_R<N>.md`.
2. Read all previous-round inputs named by the handoff.
3. Wait briefly for the peer round file if the handoff says it is expected; if absent, state the wait and treat review as blocked/pending.
4. Write only the requested `COLLAB_RESPONSE_R<N>.md` unless the handoff authorizes target edits.
5. Preserve adversarial framing. Agreement is useful only after being tested.

## Completion Self-Check

- Did I obey the newest user instruction?
- Did I avoid destructive git operations and unrelated reverts?
- Did I stay inside the claimed files and avoid forbidden files?
- Did I verify current docs behavior with Context7 or canonical WebSearch/WebFetch?
- Did I include file:line or URL evidence for substantive claims?
- Did I write the required handoff/response shape?
- Did I leave active `CODEX_*` or `COLLAB_*` lanes un-clobbered?

## Environment

- User: Tyler (`wtyler`)
- Home: `/home/wtyler`
- Codex config: `~/.codex/`
- Claude config: `~/.claude/`
- Default project root for this campaign: `/home/wtyler/Projects/ProtoPulse`
````

## 2. `~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_HANDOFF.md` (single-task)

R1 rationale: Claude R1 says stale handoff templates are examples rather than reusable scaffolds and lack constraints/protocol in `COLLAB_CLAUDE_R1.md:66-67`. Codex R1 says exact output shapes improve parseability and handoffs need lane reservations in `COLLAB_RESPONSE.md:11` and `COLLAB_RESPONSE.md:35`. R2 explicitly assigns a single-task ad-hoc template, not a campaign template, in `COLLAB_HANDOFF_R2.md:78-83`.

```diff
--- ~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_HANDOFF.md:1-261
+++ ~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_HANDOFF.md
@@ Replace entire file. This is proposal-only; do not apply until Round 4.
```

````markdown
# CODEX_HANDOFF.md Template - Single-Task Ad-Hoc Dispatch

Use this template only for one bounded task. Use `COLLAB_HANDOFF_R<N>.md` for multi-round architecture/design/review campaigns.

```markdown
# CODEX_HANDOFF.md

**From:** Claude Code
**To:** Codex CLI
**Created:** [ISO timestamp]
**Task:** [short name]
**Priority:** [high|medium|low]

## Lane Reservation

- Active channels: `CODEX_HANDOFF.md` / `CODEX_DONE.md`
- Claimed files: [exact files or globs Codex may edit]
- Forbidden files: [exact files or globs Codex must not edit]
- Background sessions: [Claude subagents, Codex sessions, long builds; include count]
- Round type: [read-only | review-only | implement | verify]
- Agent cap status: [N/6 active, source of count]

## Convergence Block

ROUND_STATUS: [discovery-complete|proposed|needs-revision|ratified|blocked]
OPEN_CRITIQUES: [none|list]
SIGNOFF: [Claude|Codex|both]
OWNERSHIP: [next-action-owner]
NEXT_ROUND: [what happens next]

## Task Summary

[One concise sentence describing the task.]

## Context And Evidence

- Why this matters: [brief]
- Current state evidence:
  - `[file]:[line]` - [claim]
  - `[command/log]` - [claim]
- Tool/API docs required:
  - [canonical URL or Context7 dump path]

## Instructions

1. [First concrete step]
2. [Second concrete step]
3. [Verification step]

## Files To Modify

| File path | Action | Notes |
|---|---|---|
| `[path]` | [modify/create/delete/read-only] | [specific instruction] |

## Constraints

- DO NOT touch: [paths]
- DO NOT run: [commands]
- DO NOT commit unless explicitly instructed here.
- Preserve: [behaviors/contracts]
- If docs verification is needed and Codex Context7 is unavailable, use WebSearch/WebFetch on canonical primary sources.
- If the active-agent count reaches 6, do not start another background Codex session.

## Output Spec For `CODEX_DONE.md`

Codex must write `CODEX_DONE.md` with:

- Convergence block filled in.
- `Status: done|blocked|partial`.
- Changes Made.
- Commands Run.
- Verification.
- Next Steps.
- Blockers, if any.
- Handoff Notes.

## Success Criteria

- [ ] Claimed task completed or blocked honestly.
- [ ] Only claimed files changed.
- [ ] Forbidden files untouched.
- [ ] Required commands run and summarized.
- [ ] Evidence cited with file:line, command output, or canonical URL.
- [ ] `CODEX_DONE.md` written in the required shape.
```
````

## 3. `~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_DONE.md` (single-task)

R1 rationale: Claude R1 identifies `STATUS: done|blocked|partial` as insufficient for convergence in `COLLAB_CLAUDE_R1.md:56-58`. Codex R1 asks for the standard convergence block in `COLLAB_RESPONSE.md:30` and says exact output shapes make handoffs parseable in `COLLAB_RESPONSE.md:11`. R2 requires this completion template content in `COLLAB_HANDOFF_R2.md:85-92`.

```diff
--- ~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_DONE.md:1-280
+++ ~/.claude/skills/claude-codex-routing/handoff-templates/CODEX_DONE.md
@@ Replace entire file. This is proposal-only; do not apply until Round 4.
```

````markdown
# CODEX_DONE.md Template - Single-Task Completion

Use this template to report completion for one `CODEX_HANDOFF.md` task. Do not use it for multi-round campaigns; use `COLLAB_RESPONSE_R<N>.md` there.

```markdown
# CODEX_DONE.md

**From:** Codex CLI
**To:** Claude Code
**Completed:** [ISO timestamp]
**Handoff Reference:** `CODEX_HANDOFF.md`

## Convergence Block

ROUND_STATUS: [ratified|blocked|needs-revision]
OPEN_CRITIQUES: [none|list]
SIGNOFF: Codex
OWNERSHIP: [Claude|Codex|both|Tyler]
NEXT_ROUND: [none|retry|review|follow-up]

## Status

[done|blocked|partial]

## Summary

[One concise sentence.]

## Changes Made

| File path | Change | Notes |
|---|---|---|
| `[path]` | [modified/created/deleted/none] | [what changed] |

## Commands Run

```bash
[commands run, in order]
```

## Verification

- [ ] [check] - [result]
- [ ] [check] - [result]

## Next Steps

- [next action, owner]

## Blockers

- [none or blocker with evidence]

## Handoff Notes

[Anything Claude or Tyler should know, including deviations from the handoff, docs URLs used, and any files intentionally left untouched.]
```
````

## 4. NEW: `~/.claude/skills/claude-codex-routing/handoff-templates/COLLAB_HANDOFF_R<N>.md`

R1 rationale: Channel collision is the proximate failure in Claude R1 `COLLAB_CLAUDE_R1.md:36-38` and Codex R1 `COLLAB_RESPONSE.md:17`. Codex R1 asks for `COLLAB_*` campaign protocol, review-only templates, standard convergence blocks, and lane reservations in `COLLAB_RESPONSE.md:25-35`. R2 requires this new template in `COLLAB_HANDOFF_R2.md:94-100`.

```diff
--- /dev/null
+++ ~/.claude/skills/claude-codex-routing/handoff-templates/COLLAB_HANDOFF_R<N>.md
@@ New file. This is proposal-only; do not apply until Round 4.
```

```markdown
# Claude x Codex Collab - Round <N>: <Round Title>

**From:** [Claude Code|Codex CLI]
**To:** [Claude Code|Codex CLI]
**Date:** [YYYY-MM-DD]
**Round:** <N> of <TOTAL>
**Channel:** `COLLAB_HANDOFF_R<N>.md` / `COLLAB_RESPONSE_R<N>.md`
**Previous round:** [links to prior handoff/response files]

## Lane Reservation

- Active channels: `COLLAB_*_R<N>.md`
- Claimed files: [proposal targets or implementation targets]
- Forbidden files: [must not touch]
- Background sessions: [active Claude subagents, Codex exec sessions, builds]
- Round type: [discovery | proposal-only | adversarial-review | implement | verify]
- Agent cap status: [N/6 active, source of count]

## Round 1 Closure (include if R2+)

| Decision | Claude position | Codex position | Current status |
|---|---|---|---|
| [D1] | [summary] | [summary] | [ratified|open] |

## Round Objective

[What this round must produce. State explicitly whether target files may be edited.]

## Required Inputs

- `[file]:[line]` - [why it matters]
- [canonical URL] - [tool/API behavior]

## Deliverable Spec

The response must include:

1. [section/file proposal/review target]
2. [section/file proposal/review target]
3. [adversarial pushback, always present]
4. [convergence block]

## Proposal Requirements

- Diff-shaped text only unless this is Round 4 implement.
- Cite R1 rationale for every proposed file change.
- Use file:line evidence for local claims.
- Use canonical URLs for current tool/API behavior.
- Preserve active `CODEX_*` lanes unless explicitly claimed.
- Count Claude subagents, Codex sessions, and long-running builds against the 6-agent cap.
- If expected peer input is absent after a reasonable wait, note the absence and mark the relevant review as blocked/pending.

## Convergence Block

ROUND_STATUS: [discovery-complete|proposed|needs-revision|ratified|blocked]
OPEN_CRITIQUES: [none|list]
SIGNOFF: [Claude|Codex|both]
OWNERSHIP: [next-action-owner]
NEXT_ROUND: [what happens next]
```

## 5. NEW: `~/.claude/skills/claude-codex-routing/handoff-templates/COLLAB_RESPONSE_R<N>.md`

R1 rationale: Codex R1 says review-only/campaign response templates are missing in `COLLAB_RESPONSE.md:27`, convergence needs a standard block in `COLLAB_RESPONSE.md:30`, and cross-review must not self-merge in `COLLAB_RESPONSE.md:64`. R2 requires this new response template with adversarial pushback always present in `COLLAB_HANDOFF_R2.md:102-106`.

```diff
--- /dev/null
+++ ~/.claude/skills/claude-codex-routing/handoff-templates/COLLAB_RESPONSE_R<N>.md
@@ New file. This is proposal-only; do not apply until Round 4.
```

```markdown
# Codex x Claude Collab - Round <N> Response (<Agent> <Deliverable Type>)

**From:** [Codex CLI|Claude Code]
**Round:** <N>
**Status:** [discovery-complete|proposed|needs-revision|ratified|blocked]
**Channel:** `COLLAB_RESPONSE_R<N>.md`

## Inputs Read

- `[file]:[line]` - [claim/use]
- [canonical URL] - [tool/API behavior verified]
- [peer file status: present|absent after wait]

## 1. [Mirror Handoff Deliverable Section]

[Diff-shaped proposal, review finding, or requested content.]

## 2. [Mirror Handoff Deliverable Section]

[Diff-shaped proposal, review finding, or requested content.]

## Adversarial Pushback

- [Pushback item, or `none` with a one-sentence reason.]

## Risks And Open Questions

- [Risk/question, or `none`.]

## Convergence Block

ROUND_STATUS: [discovery-complete|proposed|needs-revision|ratified|blocked]
OPEN_CRITIQUES: [none|list]
SIGNOFF: [Claude|Codex|both]
OWNERSHIP: [next-action-owner]
NEXT_ROUND: [what happens next]
```

## 6. `~/.claude/skills/claude-codex-routing/routing-flowchart.md` — diff-shaped proposal

R1 rationale: Current flowchart still routes `"design", "architect", "complex"` to Claude in `routing-flowchart.md:245-262`, and its summary card still says Claude takes complex architecture in `routing-flowchart.md:273-285`. Codex R1 explicitly pushed back that Claude must sanity-check this artifact because it is Claude-loaded operational guidance in `COLLAB_RESPONSE.md:70`; R2 ratified that Claude sanity-check in `COLLAB_HANDOFF_R2.md:46` and assigned this draft in `COLLAB_HANDOFF_R2.md:108-113`. This proposal keeps the flowchart separate rather than absorbing it into `SKILL.md`; that is intentional adversarial pushback against Claude R1 Q9 at `COLLAB_CLAUDE_R1.md:125-126`.

```diff
--- ~/.claude/skills/claude-codex-routing/routing-flowchart.md:1-288
+++ ~/.claude/skills/claude-codex-routing/routing-flowchart.md
@@ Replace entire file. This is proposal-only; do not apply until Round 4.
```

````markdown
# Claude x Codex Routing Flowchart v2

This is the quick operational decision tree. `SKILL.md` owns the full protocol; this file stays separate as a scan-friendly checklist because routing is a hot path and Claude must sanity-check it before Round 4.

## Preflight

Before routing any task:

1. Read the newest user instruction.
2. Check active channels:
   - If `CODEX_HANDOFF.md` / `CODEX_DONE.md` is mid-flight, do not reuse `CODEX_*` for unrelated work.
   - Use `COLLAB_*_R<N>.md` for multi-round campaigns.
3. Fill lane reservation:
   - Active channels.
   - Claimed files.
   - Forbidden files.
   - Background sessions.
   - Round type.
   - Agent cap status.
4. Count active work against the max 6 cap:
   - Claude subagents/forks/agent teams.
   - Codex exec background sessions.
   - Long-running builds/watchers/dev servers.
5. Verify docs route:
   - Claude can use Context7 when healthy.
   - Codex probes Context7 when available.
   - If Codex Context7 is unavailable, Codex uses WebSearch/WebFetch on canonical URLs.

## Channel Decision

```text
NEW WORK
  |
  +-- Is this one bounded implementation/verification task?
  |     |
  |     +-- Is CODEX_* free?
  |           |
  |           +-- yes -> CODEX_HANDOFF.md / CODEX_DONE.md
  |           +-- no  -> COLLAB_* or wait; never clobber active CODEX_*
  |
  +-- Is this architecture/design/multi-decision/review campaign?
        |
        +-- yes -> COLLAB_HANDOFF_R<N>.md / COLLAB_RESPONSE_R<N>.md
```

## Primary Routing

| Signal | Lead | Required partner behavior |
|---|---|---|
| CI/CD, build, lint, tests, schema output | Codex | Claude provides constraints and reviews failures when needed. |
| Bulk deterministic edits | Codex | Claude claims files and forbids unrelated areas. |
| Headless E2E | Codex | Claude handles true browser interaction if visual/DOM state matters. |
| Browser click/fill/visual E2E | Claude | Codex can review logs or run headless support checks. |
| Research/parallel investigation | Claude | Codex reviews synthesis for holes when decisions matter. |
| Policy/approval/hook enforcement | Claude | Codex does not bypass hook-controlled policy. |
| UX copy/style/personality-heavy work | Claude | Codex may review consistency or implementation. |
| Non-trivial architecture/design/complex bug | Claude discovery + Codex adversarial review | Must use campaign flow before implementation. |
| Clear multi-step plan execution | Codex | Claude owns plan quality unless campaign assigns synthesis to Codex. |

## Architecture Review Trigger

Use the 4-round campaign by default when any of these are true:

- More than one subsystem or long-lived contract changes.
- Race ordering, migration sequencing, persistence, security, or data loss is plausible.
- The plan has 3+ meaningful decisions.
- Either side says "I think this converged" on a hard problem; that is a prompt for adversarial review, not a merge signal.

Campaign rounds:

1. R1 discovery.
2. R2 diff-shaped proposals.
3. R3 adversarial review.
4. R4 land and verify.

## Single-Task Dispatch

Use `CODEX_HANDOFF.md` only when all are true:

- One task.
- Clear claimed files.
- Clear forbidden files.
- Success criteria fit in a checklist.
- No architecture ratification needed.
- No active `CODEX_*` lane would be clobbered.

## Convergence

Every handoff/response ends with:

```text
ROUND_STATUS: discovery-complete | proposed | needs-revision | ratified | blocked
OPEN_CRITIQUES: none | [list]
SIGNOFF: Claude | Codex | both
OWNERSHIP: [next-action-owner]
NEXT_ROUND: [what happens next]
```

Do not treat `STATUS: done` as campaign convergence. `done` is task completion; `ratified` is peer signoff.

## ASCII Summary Card

```text
+-------------------------------------------------------------+
|              CLAUDE x CODEX ROUTING CHEAT SHEET             |
+-------------------------------------------------------------+
| CODEX TAKES:                    CLAUDE TAKES:               |
| - CI/CD automation              - Research / investigation  |
| - Bulk deterministic edits      - Browser interaction       |
| - Build / test / lint           - Policy / hooks            |
| - Headless E2E                  - UX copy / tone            |
| - Schema outputs                - MCP-heavy orchestration   |
| - Clear-plan execution          - Initial architecture map  |
|                                                             |
| MANDATORY SPLIT: non-trivial architecture/design/bugs       |
|   -> Claude discovery + Codex adversarial review            |
|                                                             |
| PREFLIGHT: channel free? cap < 6? lane reserved? docs cited?|
| CONTEXT7: probe; if broken, use canonical WebSearch/WebFetch|
| CHANNELS: CODEX_* single task; COLLAB_* campaigns           |
+-------------------------------------------------------------+
```
````

## Adversarial review of `COLLAB_CLAUDE_R2.md`

`COLLAB_CLAUDE_R2.md` was absent during the initial 60-second wait, then landed during final verification. I read it before closing this response.

Per-file pushback:

- **File 1, `SKILL.md`: frontmatter needs correction before landing.** Claude proposes `allowed-tools: Read, Write, Edit, Bash(tmux:*), Bash(codex:*)` at `COLLAB_CLAUDE_R2.md:19-24`. The current Claude skills docs say `allowed-tools` accepts a space-separated string or YAML list, and that it pre-approves tools rather than restricting all other tools. The comma-separated value is therefore suspect, and the omission of `WebSearch` / `WebFetch` undercuts the skill's own canonical-doc fallback. Either use a YAML list with WebSearch/WebFetch included, or remove `allowed-tools` and let normal permission settings govern. Source: https://docs.anthropic.com/en/docs/claude-code/skills.
- **File 1, `SKILL.md`: Context7 probe should not be a nested `codex exec` incantation.** The proposed hook at `COLLAB_CLAUDE_R2.md:187-199` tells Claude to launch Codex to ask Codex to probe Context7. That can create a different process/tool surface than the active Codex session. The safer rule is what R2 ratified: active Codex probes available tools at session start; if the tool is absent or failing, fallback to canonical WebSearch/WebFetch.
- **File 1, `SKILL.md`: convergence wording is internally too strong.** `COLLAB_CLAUDE_R2.md:159` says a round closes only when both sides have `SIGNOFF: both`, but individual responses normally sign only their author. Better: a closure/next-round handoff may mark `SIGNOFF: both` after reading both sides and confirming `OPEN_CRITIQUES: none`; individual R2/R3 files should use their own signer.
- **File 2, project `AGENTS.md`: the proposed section is too large for an always-loaded root file.** R2 ratified symmetric sections, not duplicating the whole skill into project instructions. `COLLAB_CLAUDE_R2.md:426-518` should be compressed to routing triggers, channel naming, lane header, convergence block, and links to the skill/mega-doc. The detailed examples belong in the skill or ref doc.
- **File 2, project `AGENTS.md`: `docs/MASTER_BACKLOG.md` is introduced as the cap-overflow queue at `COLLAB_CLAUDE_R2.md:478-482` without current local evidence that this is the canonical ProtoPulse backlog. Either cite it with file:line or make it generic: "record the deferred work in the active backlog/handoff."
- **File 3, mega-doc: several anchors are approximate, not diff-shaped enough.** `line ~215-228` and `line ~110` style anchors in `COLLAB_CLAUDE_R2.md:419-424` and `COLLAB_CLAUDE_R2.md:555-560` are weaker than the R2 requirement for diff-shaped proposals. Round 3 should require exact line anchors or a full-file replacement for the mega-doc sections.
- **File 3, mega-doc: "server-side issue, not auth-fixable" is overclaimed.** `COLLAB_CLAUDE_R2.md:557-560` hardens an implementation diagnosis that is not evidenced in this R2 file. Keep the durable wording to "currently unavailable/failing in Codex; re-probe and fallback."
- **File 4, memory note: validation is prematurely written as completed.** `COLLAB_CLAUDE_R2.md:638-640` says each round closed and lists outputs as if landed, but R2 is proposal-only and R3/R4 have not happened. The memory note should say "planned outputs" or be finalized only after Round 4 verification.
- **Open question response:** Keep `routing-flowchart.md` separate, but short. My proposal in section 6 answers `COLLAB_CLAUDE_R2.md:672-675`: it should remain a scan-friendly companion, with full details in `SKILL.md`. Document `COLLAB_CLAUDE_R<N>.md` as an optional sidecar for Claude's parallel deliverable, not the primary paired response channel. Treat the checkpoint script idea at `COLLAB_CLAUDE_R2.md:678` as backlog, not a Round 4 blocker.

## Convergence block

ROUND_STATUS: proposed
OPEN_CRITIQUES: Claude SKILL.md frontmatter `allowed-tools` syntax/tool coverage needs correction; Context7 wording must remain live-probed and avoid unsupported root-cause claims; individual responses should not self-mark `SIGNOFF: both`; project AGENTS addition should be much shorter; mega-doc proposal needs exact anchors; memory note must not claim Round 4 validation before Round 4 exists; routing-flowchart should remain separate and short.
SIGNOFF: Codex
OWNERSHIP: Round 3 - adversarial review
NEXT_ROUND: R3
