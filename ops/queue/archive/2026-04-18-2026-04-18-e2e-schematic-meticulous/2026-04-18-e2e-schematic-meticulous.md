---
name: E2E walkthrough — Schematic — meticulous
description: Frontend E2E findings for 'Schematic — meticulous' chunk from 2026-04-18 walkthrough. 9 E2E IDs; 0 🔴, 4 🟡, 2 🟢, 3 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_none
severity_counts:
  p1_bug: 0
  ux: 4
  idea: 2
  works: 3
  e2e_ids: 9
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## Schematic — meticulous

Empty "New Circuit" pre-created. Toolbar: Select(V), Pan(H), Draw Net(W), Place Component (disabled — drag from Parts), Place Power (disabled — drag from Power), Place Annotation(T), Undo/Redo (disabled), Snap, Grid, Angle: Free/45/90 (radio group, Free checked), Fit View, Keyboard Shortcuts, Net browser. Top: combobox circuit selector + New + AI Generate + Push to PCB (disabled with hover-tooltip "No components to push…"). Sub-panels: Parts (search + ATtiny85), Power, Sheets, Sim.

- **E2E-217 ✅ GOOD** — Push to PCB button is disabled WITH explanatory aria-description. Excellent.
- **E2E-218 ✅ GOOD** — Tools have keyboard shortcuts in label `(V)`, `(H)`, `(W)`, `(T)`, undo `Ctrl+Z`. Excellent.
- **E2E-219 🟡 UX** — Parts panel "Drag a component onto the canvas" hint is good. But for users without mouse (touch / keyboard), there's no alternative path. "Add Component" CTA in empty state might be that — verify.
- **E2E-220 🟡 a11y** — Tool buttons are `radio`-grouped only for angle. Select/Pan should also be a radio group (mutually exclusive). They're standalone buttons currently which lacks group semantics.
- **E2E-221 ✅ Keyboard Shortcuts dialog opens.** GLOBAL section: Ctrl+Shift+P palette / Ctrl+K find / Ctrl+S save / Ctrl+Z undo / Ctrl+Shift+Z redo / ? toggle. SCHEMATIC section: R rotate / M mirror / W wire / Del / V select / H pan / G snap / F fit / Esc cancel. **Real shortcuts dialog. Excellent feature.**
- **E2E-222 🟢 IDEA** — Add a "Print this list" button on shortcuts dialog (or copy as table). Power users will want a wall-pinnable cheat sheet.
- **E2E-223 🟢 IDEA** — Add ability to remap shortcuts. (Many EDA users are coming from KiCad/Altium with muscle memory.)
- **E2E-224 🟡 UX** — Shortcut keys shown without OS variant (Mac users see Ctrl, expect ⌘). Detect platform.
- **E2E-225 🟡 UX** — `Add Component` empty-state CTA → no component placed, just shows X:600 Y:400 coordinate readout in toolbar. Likely entered "click-to-place mode" but no part is pre-selected from Parts panel, so clicking the canvas would place… what? Either auto-select first part, or label CTA `Pick a part to place` and disable until selection.

### Schematic remaining buttons (catalogued, not click-verified)

Toggle parts panel, New (circuit), AI Generate (needs API key), Push to PCB (disabled correctly), Toggle ERC panel, Parts/Power/Sheets/Sim tabs, Search components, ATtiny85 group, all 6 toolbar tools (Select/Pan/Net/Component/Power/Annotation), Snap, Grid, 3 angle radios, Fit view, Toggle net browser, Zoom controls, Mini Map.

---

