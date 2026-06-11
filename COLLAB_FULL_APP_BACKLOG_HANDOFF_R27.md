## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R27.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R27_CODEX.md
- Claimed files: client/src/components/views/BoardViewer3DView.tsx, client/src/components/views/__tests__/BoardViewer3DView.test.tsx, client/src/components/views/DigitalTwinView.tsx, client/src/components/views/__tests__/DigitalTwinView.test.tsx, client/src/lib/viewer-3d-bridge.ts, client/src/lib/__tests__/viewer-3d-bridge.test.ts, e2e/p1-viewer-3d-bridge.spec.ts, client/src/components/panels/SerialMonitorPanel.tsx, client/src/components/views/CircuitCodeView.tsx, .agents/skills/pp-view-digital-twin/references/testing.md, .agents/skills/pp-view-digital-twin/references/self-improvement-log.md, .agents/skills/pp-view-3d/references/testing.md, .agents/skills/pp-view-3d/references/self-improvement-log.md, .agents/skills/pp-view-serial-monitor/references/testing.md, .agents/skills/pp-view-serial-monitor/references/self-improvement-log.md, .agents/skills/pp-view-circuit-code/references/testing.md, .agents/skills/pp-view-circuit-code/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R27.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R27_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background implementation workers dispatched

# Full App Views Backlog Campaign R27

## Scope For This Round

Start the Digital Twin capstone slice now that the main 3D bridge paths are browser-proven:

- Make the 3D viewer render Digital Twin live-state context as a visible overlay, not just a provenance card.
- Show live channel, pin, net, state-confidence, model-kind, and health context in that overlay.
- Add "go fix this" navigation from the 3D viewer back to Digital Twin, Breadboard, and Component Editor.
- Keep the slice narrow. Do not start a new renderer, telemetry backend, or broad Digital Twin refactor.
- Update the nearest 3D and Digital Twin skill references so future work preserves this bridge behavior.
- If the required UI gates expose an unrelated accessibility/keyboard failure, fix only the narrow defect needed to leave the gate green.

## Evidence Before Edits

- `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md` calls for Digital Twin to expose missing 3D/behavior preview, live pin/channel/net state, and repair paths back to the relevant work surfaces.
- R26 already browser-proved Community, Breadboard, Component Editor, Generative, and Digital Twin route handoffs into 3D.
- `client/src/components/views/DigitalTwinView.tsx` already publishes a `digital-twin` 3D bridge target with live channel, pin, net, health, confidence, and model-kind fields.
- `client/src/components/views/BoardViewer3DView.tsx` already consumes generic 3D bridge targets and renders the provenance card, but Digital Twin details are not yet visualized as a scene-level overlay.
- Context7 checked current React docs for event handlers, conditional render data, and avoiding unnecessary effects.
- Context7 checked current Playwright docs for locators, web-first assertions, route navigation, and screenshot checks.
- Dirty diffs for the claimed files were inspected before this R27 implementation.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: R27 should only harden the Digital Twin live-state overlay/go-fix-link path; broader Digital Twin telemetry modeling belongs in a later round.
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Add the 3D viewer Digital Twin overlay and focused tests, then rerun focused unit/E2E and page-skill checks.
---
