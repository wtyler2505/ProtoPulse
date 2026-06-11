## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R35.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R35_CODEX.md
- Claimed files: client/src/components/views/ComponentEditorView.tsx; client/src/lib/__tests__/viewer-3d-bridge.test.ts; .agents/skills/pp-view-component-editor/references/testing.md; .agents/skills/pp-view-component-editor/references/self-improvement-log.md; COLLAB_FULL_APP_BACKLOG_HANDOFF_R35.md; COLLAB_FULL_APP_BACKLOG_RESPONSE_R35_CODEX.md
- Forbidden files: CODEX_HANDOFF.md; CODEX_DONE.md; unrelated existing COLLAB_*; .env; knowledge/**; data/pp-nlm/**
- Background sessions: focused test/browser checks only, none intended to remain active
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 2/6 active (source: inherited campaign context plus current Codex lane)

# ProtoPulse Full App Views Backlog R35 - Component Editor 3D Bridge Contract

## Context

The 3D bridge scan shows Breadboard, Community, Generative, Digital Twin, and Component Editor bridge flows already exist in the dirty tree. Component Editor still needs one small hardening pass: the toolbar action should use the same visible language as the rest of the app, and the shared bridge library should lock the `component-editor` payload shape in a focused unit test.

## Scope

- Rename the Component Editor toolbar action from `View 3D` to `View in 3D` while keeping the existing test id and bridge behavior.
- Add focused bridge-library coverage for Component Editor exact-part payload fields: source id, title, subtitle, trust tier, verification level/status, pin-map confidence, model kind/format, and ready state.
- Update Component Editor skill references.

## Verification Required

- `npm run test -- client/src/lib/__tests__/viewer-3d-bridge.test.ts`
- `node .agents/skills/pp-view-component-editor/scripts/inspect-component-editor.mjs`
- `env -u NO_COLOR -u FORCE_COLOR PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- e2e/p1-viewer-3d-bridge.spec.ts --reporter=dot --workers=1 -g "component editor"`
- `npm run check`

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Tighten Component Editor 3D bridge contract and verify it.
---
