## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R15.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R15_CODEX.md
- Claimed files: client/src/lib/breadboard-3d-bridge.ts, client/src/components/circuit-editor/BreadboardView.tsx, client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx, client/src/components/views/BoardViewer3DView.tsx, client/src/components/views/__tests__/BoardViewer3DView.test.tsx, .agents/skills/pp-view-3d/references/testing.md, .agents/skills/pp-view-3d/references/gotchas.md, .agents/skills/pp-view-3d/references/self-improvement-log.md, docs/audit-screenshots/2026-05-24-r15-3d-bridge-consumer/**, COLLAB_FULL_APP_BACKLOG_HANDOFF_R15.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R15_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R15

## Scope For This Round

Codex continues the Breadboard -> 3D bridge:

- Make the Breadboard selected-part payload durable across the view switch.
- Make `BoardViewer3DView` consume and display that selected-part trust/provenance context.
- Highlight the matching 3D component when the selected refdes exists in the scene.
- Refresh the stale focused 3D viewer unit tests discovered at the end of R14.

## Evidence Before Edits

- R14 wired the Breadboard button, but the event is dispatched before `viewer_3d` mounts.
- `BoardViewer3DView.test.tsx` currently fails stale expectations around old empty-scene behavior and old scene test assumptions.
- React docs checked through Context7: subscribe to external browser events inside `useEffect` and remove listeners in cleanup.
- Vitest docs checked through Context7: `vi.mock` is hoisted and module mocks should isolate component tests.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: 3D viewer does not yet consume the Breadboard selected-part payload, and its unit suite is stale against the current dirty 3D hardening surface.
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement durable Breadboard bridge payload, 3D consumer UI/highlight, focused tests, and verification.
---
