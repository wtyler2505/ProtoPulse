## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R12.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R12_CODEX.md
- Claimed files: client/src/components/views/CircuitCodeView.tsx, client/src/components/views/circuit-code/CodeEditor.tsx, client/src/components/views/__tests__/CircuitCodeView.test.tsx, .agents/skills/pp-view-circuit-code/SKILL.md, .agents/skills/pp-view-circuit-code/references/page-map.md, .agents/skills/pp-view-circuit-code/references/testing.md, .agents/skills/pp-view-circuit-code/references/gotchas.md, .agents/skills/pp-view-circuit-code/references/self-improvement-log.md, .agents/skills/pp-view-circuit-code/scripts/inspect-circuit-code.mjs, docs/audit-screenshots/2026-05-24-r12-circuit-code/**, COLLAB_FULL_APP_BACKLOG_HANDOFF_R12.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R12_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R12

## Scope For This Round

Codex lands the last high-risk blind-action cleanup found by the post-R11 report scan:

- Add a Circuit Code apply consequence preview before mutation.
- Require explicit confirmation before posting to `/api/projects/:projectId/circuits/apply-code`.
- Surface source-trust context for the local/generated DSL workspace.
- Add/refresh focused tests and update the Circuit Code page skill pack.

## Evidence Before Edits

- `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md` lines 301-338 flag Circuit Code as a real canonical-model apply path with no preview/diff.
- The view currently posts layout data directly on "Apply to Project" click.
- `CircuitCodeView.test.tsx` already exists but the page skill pack did not record it.
- `node .agents/skills/pp-view-circuit-code/scripts/inspect-circuit-code.mjs` passed before edits.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: Circuit Code apply creates real circuit designs/instances without a consequence preview or explicit confirm step
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement Circuit Code apply preview, source-trust cue, tests, screenshots, and verification evidence.
---
