---
name: E2E walkthrough — Dashboard tab — TESTED
description: Frontend E2E findings for 'Dashboard tab — TESTED' chunk from 2026-04-18 walkthrough. 17 E2E IDs; 2 🔴, 6 🟡, 4 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 2
  ux: 6
  idea: 4
  works: 0
  e2e_ids: 17
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Dashboard tab — TESTED

URL: `/projects/30/dashboard`. Shows welcome overlay first time on this account.

Welcome overlay testids: `welcome-overlay`, `welcome-header`, `welcome-dismiss`, `welcome-mode-panel`, `welcome-plain-labels-toggle`, `role-preset-{student,hobbyist,pro}`, `welcome-mode-description`, `welcome-feature-{architecture,schematics,bom,ai,validation,export}`, `welcome-step-{architecture,ai,validation}`, `welcome-step-*-action`, `welcome-skip`.

Welcome content: "Welcome to ProtoPulse — AI-assisted electronic design automation". Mode picker (Student/Hobbyist/Pro). 6 feature tiles. 3-step getting started.

### Dashboard findings

- **E2E-011 🟢 IDEA** — "Use plain labels" toggle is in welcome but mode/labels are global preferences — should also live in Settings.
- **E2E-012 🟢 IDEA** — Welcome overlay is a great UX moment — could include a "Watch 60s tour" video button.
- **E2E-013 🟡 UX** — "Skip and go to dashboard" button placement at bottom — but if a user clicks Open Architecture they go to architecture, not dashboard. The flow assumes user wants the welcome again. Need to verify it doesn't re-show on next login.
- **E2E-014 ⚪ OBS** — Mode picker has 3 presets but no "custom" — power users might want à la carte.

After dismiss: dashboard renders with `dashboard-view`, `dashboard-header`, `dashboard-quick-stats` (5 stats: components/connections/bom-items/total-cost/issues all 0), `dashboard-card-architecture` (nodes/edges/density), `dashboard-card-bom` (qty/unique/cost), `dashboard-card-validation`, `dashboard-card-activity`.

- **E2E-015 🔴 BUG** — Validation shows "All Checks Passing — No issues detected" on a project with **0 components, 0 connections, 0 BOM items**. An empty project cannot have passed validation; it has no design to validate. Should show "No design yet" / "Add components to begin validation".
- **E2E-016 🟡 UX** — Quick stats and Architecture/BOM cards both show counts (e.g. "Components 0" and "Architecture 0 NODES"). Redundant.
- **E2E-017 🟢 IDEA** — Recent Activity card empty. Should show "Created project" event or last AI interaction.
- **E2E-018 ⚪ OBS (CORRECTED)** — Architecture/BOM/Validation cards DO have `role="button"` + `tabindex=0` + `onclick` handlers. Click-through works. **However Activity card does NOT** (`role=null`, no onclick, cursor=auto) — inconsistent. Either make Activity clickable too (e.g. open History tab) or visually distinguish non-interactive cards.
- **E2E-068 🟡 a11y** — Cards use `role="button"` on a div with no inner `<button>`. Better to use a real `<button>`/`<a>` so screen readers + Enter/Space work natively.
- **E2E-069 🟡 UX** — `workspace-hardware-badge` shows "Need board profile" but has no tooltip (`title=""`). Should explain WHY board profile is needed and link to setup.
- **E2E-070 🟢 IDEA** — `workspace-health-badge` shows "Saved" — but only after autosave fires. Need state for "Saving…", "Save failed (retry)", "Conflict (refresh)".

### Global toolbar buttons (Dashboard pass)

- **E2E-071 ⚪ OBS** — `workspace-mode-button` (Hobbyist) opens dialog with Student/Hobbyist/Pro selectors + plain-language toggle. Works.
- **E2E-072 ⚪ OBS** — `explain-panel-button` opens contextual dialog ("Dashboard — Your project overview at a glance…" + tips). Excellent feature.
- **E2E-073 ⚪ OBS** — `whats-new-button` opens "What's New" dialog with changelog (Snapshot restore, PCB geometry bridge, BL-0568, etc.). Real changelog wired.
- **E2E-074 🔴 BUG (CONFIRMED)** — `coach-help-button` opens nothing. Even via real DevTools click (full pointer-event sequence), button only takes focus — no popover, no menu, no console error. The Radix `<PopoverTrigger>` is wired but the `<PopoverContent>` either renders nothing or is conditionally hidden. Source: `client/src/pages/workspace/WorkspaceHeader.tsx:431`. Severity P1.
- **E2E-074b 🟡 a11y** — Same issue means keyboard activation (Enter/Space) ALSO will not work. Confirmed dead button.
- **E2E-075 🟡 UX** — `pcb-tutorial-button`, `import-design-button`, `mention-badge-button`, `toggle-activity-feed`, `button-share-project` — none have aria-labels visible in toolbar (just icons). Hover tooltips presumably exist but not verified.

---

