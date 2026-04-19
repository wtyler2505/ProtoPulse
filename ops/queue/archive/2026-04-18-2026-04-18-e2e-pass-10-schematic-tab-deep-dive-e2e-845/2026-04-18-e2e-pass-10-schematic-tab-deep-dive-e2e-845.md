---
name: E2E walkthrough — PASS 10 — SCHEMATIC TAB DEEP DIVE (E2E-845+)
description: Frontend E2E findings for 'PASS 10 — SCHEMATIC TAB DEEP DIVE (E2E-845+)' chunk from 2026-04-18 walkthrough. 34 E2E IDs; 7 🔴, 8 🟡, 12 🟢, 3 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_BL-0791-0797
severity_counts:
  p1_bug: 7
  ux: 8
  idea: 12
  works: 3
  e2e_ids: 34
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## PASS 10 — SCHEMATIC TAB DEEP DIVE (E2E-845+)

Mirroring Pass 4/7 for Schematic. Screenshot: `39-schematic-fullpage.png`.

### Surface inventory observed

Schematic uses React Flow canvas (separate from Architecture's). Major panels:

1. **Top circuit bar** — Circuit selector (`select-circuit`, value="New Circuit") + New (button) + AI Generate (with description tooltip) + Push to PCB (disabled with hover-tooltip "No components to push…") + circuit name read-out + Toggle ERC panel + Toggle parts panel.
2. **Sub-panel tabs (left)** — Parts / Power / Sheets / Sim (4 panels).
3. **Component placer (Parts panel)** — Search + grouped list ("MICROCONTROLLER 1") + ATtiny85 with DIP / 8 PINS chips + "Drag a component onto the canvas" hint.
4. **Schematic toolbar (canvas top)** — `schematic-tool-select` (V), `schematic-tool-pan` (H), `schematic-tool-draw-net` (W), `schematic-tool-place-component` (disabled — "drag from Parts panel"), `schematic-tool-place-power` (disabled — "drag from Power panel"), `schematic-tool-place-annotation` (T), Undo/Redo (Ctrl+Z/Shift+Z, both disabled), `schematic-tool-snap`, `schematic-tool-grid-visible`, angle-constraint radio group (Free/45°/90°), `schematic-tool-fit`, Keyboard Shortcuts dialog button, `schematic-toggle-net-browser`.
5. **Empty state** — icon + "Empty Schematic" + "Your schematic is empty…" + Add Component CTA.
6. **React Flow controls** — Zoom in / Zoom out / Fit View / Toggle Interactivity at bottom-left.
7. **Mini map** — bottom-right.
8. **Bottom hint** — "Drag a component onto the canvas" in left footer.
9. **Top-right of canvas** — Net browser toggle + circuit-name readout + small "New Circuit" tag.

### Pass 10 — Visual / hierarchy findings

- **E2E-845 ✅ visual** — Two zoom-control sets (top toolbar + React Flow bottom-left controls). Same E2E-336 issue noted before — pick ONE location.
- **E2E-846 🔴 visual** — Sub-panel tabs `Parts / Power / Sheets / Sim` are tiny (text-xs cyan icons) and easy to miss. They control ENTIRE panel content but visually look incidental. Make them prominent like Procurement's sub-tabs.
- **E2E-847 🟡 visual** — `Sim` ambiguous — Simulation? Similar? Add `(Simulation)` parenthetical or use distinct icon.
- **E2E-848 🔴 visual** — Toolbar has 14+ controls (6 tools + undo/redo + snap + grid + 3 angle radios + fit + kbd-shortcuts + net-browser). All cramped into one ~480px row. Group as `[Tools | Edit | View | Help]` separated by visible dividers.
- **E2E-849 🔴 visual** — `Place Component` and `Place Power` buttons appear in toolbar BUT are perma-disabled with description "drag from Parts/Power panel". These are vestigial UI — either wire them up to enter "place mode" or remove from toolbar.
- **E2E-850 🟡 visual** — Angle constraint radio group (`Free / 45 / 90`) uses just numbers; beginner won't grok "what does 45 do?". Add tooltip "Constrain wire bends to 45° angles".
- **E2E-851 ✅ visual** — Empty state with prominent cyan `Add Component` button is the cleanest empty-state in the app.
- **E2E-852 🟡 visual** — "Drag a component onto the canvas" hint sits BELOW the parts panel as small grey text. Should pulse/animate as the user hovers a part to make drag affordance obvious.
- **E2E-853 🟢 visual** — Parts panel groups by category ("MICROCONTROLLER 1") — better hierarchy than Architecture's flat list.
- **E2E-854 🟡 visual** — `Push to PCB` button has hover-tooltip explaining disabled reason — excellent. But the button is `disabled gray` with no other visual cue. Add a small `🔒` icon to make the disabled-with-reason state more obvious.
- **E2E-855 🟢 visual** — Top circuit selector is a real combo with "+ New" button next to it — supports multi-sheet design. Power-user friendly.

### Pass 10 — Functional findings

- **E2E-856 🔴 BUG (E2E-225 confirmed)** — `Add Component` empty-state button enters a click-to-place mode (X:600 Y:400 readout appears) BUT no part is pre-selected, so clicking the canvas places nothing. Confirmed during this pass: clicked part-34 in placer THEN Add Component THEN canvas — still 0 nodes. The "Add Component" CTA is **functionally broken** without a pre-selected part.
- **E2E-857 🔴 GAP** — Component placer has a `cursor-grab` class on each part item — indicates drag IS the intended interaction. But there's no click-to-add fallback like Architecture's `+` button. Inconsistent with Arch.
- **E2E-858 🟢 UX** — Net-browser toggle exists (`schematic-toggle-net-browser`). Untested but present — would visualize all nets in the design. Critical feature for schematic readability.
- **E2E-859 🟡 UX** — `AI Generate` requires API key, button is enabled regardless. Same gating problem (E2E-303).
- **E2E-860 🟡 UX** — Sub-panel `Sheets` implies multi-sheet hierarchical schematics. Not verified. If real, a major pro feature should be highlighted.
- **E2E-861 🟢 UX** — `Parts` placer search has placeholder "Search components" — works incrementally.
- **E2E-862 🔴 GAP** — No way to **import existing schematic** from the Schematic tab itself. Empty state suggests "or import an existing design" but no import button visible.
- **E2E-863 🟡 UX** — `New` button creates a new circuit. But what happens to the current circuit? Saved automatically? Confirmation needed if unsaved changes.

### Pass 10 — Toolbar critique

- **E2E-864 🟡 visual** — Tool icons: `Select (V)` arrow, `Pan (H)` hand, `Draw Net (W)` zigzag — all standard. `Annotation (T)` text-T — clear. `Snap` magnet, `Grid` dots. Active tool shows cyan tint (consistent with Breadboard).
- **E2E-865 🟢 ✅** — Keyboard shortcut hotkey-in-label pattern (`Select (V)`, `Pan (H)`, `Draw Net (W)`) is best-in-class. Other tabs (Architecture, PCB) should adopt.

### Pass 10 — Audience

- **E2E-866 🔴 newbie** — Beginners hitting Schematic for first time face: "Drag a component", but can't tell which icon means draw-wire. Add a callout "Pull pins out into wires by dragging from the pin handles" for first-time visitors.
- **E2E-867 🟢 newbie** — `AI Generate` empty-state CTA is the magic shortcut. Promote with "✨ Skip the manual: let AI generate" copy.
- **E2E-868 🟢 expert** — Hotkey-in-label means experts can learn shortcuts naturally. Add `?` overlay showing all shortcuts in a single keymap diagram.
- **E2E-869 🟢 expert** — Sub-panel `Sheets` is a pro feature. Verify Eagle/KiCad-class hierarchy depth.

### Pass 10 — Competitive (vs KiCad / Eagle / EasyEDA)

- **E2E-870 🟢 STRATEGIC vs KiCad 9** — KiCad 9 has Selection Filter (filter what's clickable on dense schematics). ProtoPulse Schematic has none.
- **E2E-871 🟢 STRATEGIC vs KiCad** — KiCad has "highlight net" via right-click → all wires of that net glow. ProtoPulse has net-browser toggle but unverified depth.
- **E2E-872 🟢 STRATEGIC vs Eagle** — Eagle has explicit ground/power symbol library with auto-routing to nearest power rail. ProtoPulse Power sub-panel may have this; verify.
- **E2E-873 🟢 STRATEGIC vs EasyEDA** — EasyEDA renders 3D model preview from schematic. ProtoPulse has separate 3D View tab (cf. E2E-364).

---

