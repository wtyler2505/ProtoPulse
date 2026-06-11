## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R17.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R17_CODEX.md
- Claimed files: client/src/lib/viewer-3d-bridge.ts, client/src/lib/breadboard-3d-bridge.ts, client/src/lib/__tests__/viewer-3d-bridge.test.ts, client/src/components/layout/sidebar/sidebar-constants.ts, client/src/components/layout/sidebar/__tests__/sidebar-constants.test.ts, client/src/components/circuit-editor/BreadboardView.tsx, client/src/components/views/BoardViewer3DView.tsx, client/src/components/views/__tests__/BoardViewer3DView.test.tsx, client/src/components/views/ComponentEditorView.tsx, client/src/components/views/CommunityView.tsx, client/src/components/views/__tests__/CommunityView.test.tsx, client/src/components/views/GenerativeDesignView.tsx, client/src/components/views/__tests__/GenerativeDesignView.test.tsx, e2e/p1-viewer-3d-bridge.spec.ts, .agents/skills/pp-view-3d/SKILL.md, .agents/skills/pp-view-3d/scripts/inspect-3d.mjs, .agents/skills/pp-view-3d/references/testing.md, .agents/skills/pp-view-3d/references/gotchas.md, .agents/skills/pp-view-3d/references/self-improvement-log.md, .agents/skills/pp-view-component-editor/references/testing.md, .agents/skills/pp-view-component-editor/references/gotchas.md, .agents/skills/pp-view-component-editor/references/self-improvement-log.md, .agents/skills/pp-view-community/SKILL.md, .agents/skills/pp-view-community/scripts/inspect-community.mjs, .agents/skills/pp-view-community/references/testing.md, .agents/skills/pp-view-community/references/gotchas.md, .agents/skills/pp-view-community/references/self-improvement-log.md, .agents/skills/pp-view-generative/references/testing.md, .agents/skills/pp-view-generative/references/gotchas.md, .agents/skills/pp-view-generative/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R17.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R17_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background workers dispatched

# Full App Views Backlog Campaign R17

## Scope For This Round

Extend the R15 Breadboard -> 3D bridge into the broader 3D View bridge pass:

- Generalize the pending 3D target bridge while keeping Breadboard compatibility.
- Let Component Editor publish the current part context into 3D View.
- Let Community publish selected 3D-model context into 3D View.
- Let Generative publish candidate context into 3D View.
- Keep provenance/trust context visible in the 3D viewer card.

## Evidence Before Edits

- R15 proved the durable bridge pattern for Breadboard, but the helper was Breadboard-specific.
- Component Editor, Community, and Generative already have selected item/candidate state and can use `useProjectMeta().setActiveView('viewer_3d')`.
- Existing source-view files are dirty with UI density work; R17 must layer on top without reverting those changes.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: Component Editor, Community, and Generative source views do not yet hand their selected part/model context into 3D View.
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Generalize bridge helper, wire source views, extend 3D consumer card, and verify focused tests.
---
