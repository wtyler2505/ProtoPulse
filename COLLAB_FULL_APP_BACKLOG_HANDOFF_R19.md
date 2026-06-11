## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R19.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R19_CODEX.md
- Claimed files: client/src/components/circuit-editor/BreadboardPartInspector.tsx, client/src/components/circuit-editor/__tests__/BreadboardPartInspector.trustTier.test.tsx, client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx, e2e/p1-breadboard-inspector-container.spec.ts, .agents/skills/pp-view-breadboard/references/testing.md, .agents/skills/pp-view-breadboard/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R19.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R19_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R19

## Scope For This Round

Continue from R18 into the Breadboard Lab container/UI debt:

- Make the selected-part inspector reachable on laptop-height screens.
- Add a real collapse affordance so the inspector can stop blocking the canvas without losing selection context.
- Add native horizontal resize constraints so the inspector follows the UI Container Rule.
- Preserve the existing Breadboard -> 3D button and trust/provenance badges.
- Cover the behavior with focused Breadboard inspector tests and browser/layout proof.

## Evidence Before Edits

- R18 wired the selected-part `View in 3D` handler and carried board-health context to the 3D bridge.
- `docs/FULL-APP-VIEWS-AND-PAGES-BACKLOG-REPORT.md` calls out Breadboard canvas/container debt, board-health/coach visibility, provenance badge visibility, and laptop-height scroll traps.
- Current `BreadboardPartInspector.tsx` is an absolute overlay on the canvas with scrollable body content, but it has no collapse affordance and no resize affordance.
- Context7 React docs checked: derived render values should stay in render/useMemo; effects/state are appropriate only for interactions or DOM/external synchronization.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: The selected-part inspector can still block canvas work and does not yet satisfy collapse/resize expectations.
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement inspector collapse/resize/reachability, tests, and browser proof.
---
