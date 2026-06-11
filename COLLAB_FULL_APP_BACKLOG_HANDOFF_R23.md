## Lane Reservation

- Active channels: COLLAB_FULL_APP_BACKLOG_HANDOFF_R23.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R23_CODEX.md
- Claimed files: client/src/components/views/CalculatorsView.tsx, client/src/components/views/AuditTrailView.tsx, client/src/components/views/GenerativeDesignView.tsx, client/src/components/views/PcbOrderingView.tsx, client/src/pages/settings/SettingsPage.tsx, client/src/pages/settings/sections/ProfileSection.tsx, client/src/pages/settings/sections/AppearanceSection.tsx, client/src/pages/settings/sections/APIKeysSection.tsx, .agents/skills/pp-view-calculators/references/testing.md, .agents/skills/pp-view-calculators/references/self-improvement-log.md, .agents/skills/pp-view-audit-trail/references/testing.md, .agents/skills/pp-view-audit-trail/references/self-improvement-log.md, .agents/skills/pp-view-generative/references/testing.md, .agents/skills/pp-view-generative/references/self-improvement-log.md, .agents/skills/pp-view-order-pcb/references/testing.md, .agents/skills/pp-view-order-pcb/references/self-improvement-log.md, .agents/skills/pp-view-uiux-design/references/testing.md, .agents/skills/pp-view-uiux-design/references/self-improvement-log.md, COLLAB_FULL_APP_BACKLOG_HANDOFF_R23.md, COLLAB_FULL_APP_BACKLOG_RESPONSE_R23_CODEX.md
- Forbidden files: CODEX_HANDOFF.md, CODEX_DONE.md, existing unrelated COLLAB_*, .env, knowledge/**, data/pp-nlm/**
- Background sessions: none
- Round type: implement
- Target file edits permitted this round: listed-only
- Agent cap status: 1/6 active implementation agent counted from current Codex turn; no background implementation workers dispatched

# Full App Views Backlog Campaign R23

## Scope For This Round

Address the lowest-risk keyboard-navigation failures left by R22:

- Calculators: give every tab-reachable numeric control a stable accessible name.
- Audit Trail: remove the date-input focus pin by making the filter controls advance predictably.
- Generative Design: remove the input focus pin and make the spec panel keyboard-friendly.
- Order PCB: name the board-spec quantity and dimension controls found by the broad keyboard rerun.
- Settings: replace the placeholder tabpanel-only surface with real focusable controls so the route is not a keyboard dead end.

## Evidence Before Edits

- R22 broad keyboard gate failed after Digital Twin passed:
  - Calculators: unnamed focus stop `[data-testid="calc-divider-r1-input"]`.
  - Audit Trail: focus did not advance, stuck on `[data-testid="audit-date-start"]`.
  - Generative Design: focus did not advance, stuck on `input`.
  - Settings: suspected trap with only `[data-testid="settings-tab-profile"]` and `div[role="tabpanel"]`.
- Existing dirty diffs for Calculators, Audit Trail, and Generative Design were inspected before this claim.
- Existing dirty diff for Order PCB was inspected before expanding this claim.
- Settings source files are clean before R23 edits.
- Context7 React docs checked: use normal controlled inputs and real labels/`htmlFor`; derive display labels in render or `useMemo` rather than redundant state/effects.
- Page-skill inspectors passed before edits for Calculators, Audit Trail, Generative, and UI/UX.

---
ROUND_STATUS: proposed
OPEN_CRITIQUES: R23 intentionally covers only low-risk named/focus-stuck keyboard failures; broader trust/container work remains for later rounds.
SIGNOFF: Codex
OWNERSHIP: Codex
NEXT_ROUND: Implement the low-risk keyboard fixes, run focused keyboard-nav checks, then record remaining broad UI/UX debt.
---
