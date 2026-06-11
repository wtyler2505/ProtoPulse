## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R18.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R18_CODEX.md
- Claimed files: client/src/lib/viewer-3d-bridge.ts, client/src/lib/__tests__/viewer-3d-bridge.test.ts, client/src/components/circuit-editor/BreadboardView.tsx, client/src/components/views/BoardViewer3DView.tsx, client/src/components/views/__tests__/BoardViewer3DView.test.tsx, client/src/components/views/DigitalTwinView.tsx, client/src/components/views/__tests__/DigitalTwinView.test.tsx, e2e/p1-viewer-3d-bridge.spec.ts, .agents/skills/pp-view-digital-twin/SKILL.md, .agents/skills/pp-view-digital-twin/scripts/inspect-digital-twin.mjs, .agents/skills/pp-view-digital-twin/references/testing.md, .agents/skills/pp-view-digital-twin/references/gotchas.md, .agents/skills/pp-view-digital-twin/references/self-improvement-log.md, .agents/skills/pp-view-3d/references/testing.md, .agents/skills/pp-view-breadboard/references/testing.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R18.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R18_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R18

## Scope For This Round

Continue from R17's generic 3D bridge into the Breadboard Lab + Digital Twin handoff:

- Add board-health summary fields to Breadboard -> 3D payloads.
- Let Digital Twin publish a live-state 3D target with channel, pin, net, health, and confidence context.
- Surface Digital Twin live-state context in the 3D viewer provenance card.
- Add visible "go fix this" links from Digital Twin to Breadboard, Component Editor, and 3D View.
- Add the first dedicated Digital Twin view test and update focused 3D bridge tests.

## Evidence Before Edits

- R17 proved Community -> 3D in a real browser and made `viewer_3d` reachable before a graph exists.
- Current Breadboard code already publishes a selected-part 3D target, but it does not include board-health context.
- Current Digital Twin has no dedicated recorded test glob and only shows connection, channels, simulation comparison, and firmware generation.
- The full-app backlog calls out missing 3D/behavior preview, live pin/channel/net state, and fix links for Digital Twin.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: Digital Twin still does not hand live telemetry state into the 3D bridge, and Breadboard 3D context does not carry board-health state.
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement the R18 bridge fields, UI preview, tests, and verification.
---
