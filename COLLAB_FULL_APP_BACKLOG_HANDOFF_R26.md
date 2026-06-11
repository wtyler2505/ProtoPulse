## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R26.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R26_CODEX.md
- Claimed files: e2e/p1-viewer-3d-bridge.spec.ts, .agents/skills/pp-view-3d/references/testing.md, .agents/skills/pp-view-3d/references/self-improvement-log.md, .agents/skills/pp-view-component-editor/references/testing.md, .agents/skills/pp-view-component-editor/references/self-improvement-log.md, .agents/skills/pp-view-generative/references/testing.md, .agents/skills/pp-view-generative/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R26.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R26_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background implementation workers dispatched

# Full App Views Backlog Campaign R26

## Scope For This Round

Close the browser-proof gap in the 3D bridge pass:

- Add route-level Playwright proof that Component Editor can send a selected exact part into the hardened 3D viewer with verification, pin-map, model, and ready-state context.
- Add route-level Playwright proof that Generative can send a real generated candidate into the hardened 3D viewer with AI-generated provenance and component-count context.
- Keep this as a proof/hardening slice. Do not start a new 3D renderer, broad Component Editor refactor, or Digital Twin expansion in this round.
- Update the nearest 3D, Component Editor, and Generative page-skill references so the bridge proof remains durable.

## Evidence Before Edits

- `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md` explicitly calls for Breadboard, Component Editor, Community, and Generative flows to hand real selected parts/models into 3D with provenance carried along.
- The current 3D bridge spec already proves Community, Breadboard, and Digital Twin browser flows, but not Component Editor or Generative.
- `client/src/components/views/ComponentEditorView.tsx` currently has a dirty `button-view-3d` implementation that publishes a `component-editor` bridge payload.
- `client/src/components/views/GenerativeDesignView.tsx` currently has a dirty `view-3d-button-*` implementation that publishes a `generative` bridge payload.
- Context7 checked current React docs for event-handler callbacks and derived render data; Context7 checked current Playwright docs for test IDs, web-first assertions, clicks, and screenshot assertions.
- Dirty diffs for the bridge source files and the existing E2E spec were inspected before edits.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: R26 verifies and hardens existing Component Editor and Generative bridge paths; if the browser proof exposes a runtime defect, fix only the narrow defect needed for the bridge.
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Add Component Editor and Generative browser bridge proof, then rerun focused 3D bridge checks.
---
