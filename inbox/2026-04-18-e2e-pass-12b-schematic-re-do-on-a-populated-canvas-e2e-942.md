---
name: E2E walkthrough — PASS 12B — SCHEMATIC RE-DO (ON A POPULATED CANVAS) (E2E-942+)
description: Frontend E2E findings for 'PASS 12B — SCHEMATIC RE-DO (ON A POPULATED CANVAS) (E2E-942+)' chunk from 2026-04-18 walkthrough. 41 E2E IDs; 2 🔴, 6 🟡, 7 🟢, 5 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_BL-0807-0808
severity_counts:
  p1_bug: 2
  ux: 6
  idea: 7
  works: 5
  e2e_ids: 41
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## PASS 12B — SCHEMATIC RE-DO (ON A POPULATED CANVAS) (E2E-942+)

**Confession:** Passes 10-12 were authored against an EMPTY schematic. Tyler called this out. This pass re-runs against a populated schematic (drag-placed an ATtiny85 via real DevTools `drag` tool). Screenshot: `40-schematic-with-attiny85.png`.

### Real component placement observations

The drag from sidebar ATtiny85 → canvas WORKED on real DevTools `drag` (not synthetic JS). Result was a beautifully rendered DIP-8 schematic symbol. **Earlier "drag-only is broken" critique partly retracted** — drag works; the broken one is the click-to-place fallback (E2E-883).

What actually rendered:
- White DIP-8 rectangle body
- 8 pin handles (cyan dots) at 4 left + 4 right
- Pin numbers (1-8) just outside the body
- Pin function names INSIDE the body adjacent to each pin: `VCC` `PB0` `PB1` `PB2` (left) and `PB5` `GND` `PB4` `PB3` (right)
- Component reference "ATtiny85" centered in body
- Component label "ATtiny85" below body
- Toast notification "Add U1 to BOM? Place 'ATtiny85' in your bill of materials." with `Add to BOM` button
- `Push to PCB` button immediately enabled (was disabled when empty — verified the dynamic gate)

### Pass 12B — Visual findings on populated schematic

- **E2E-942 ✅ visual** — Pin labeling is industry-quality: pin number outside, pin function inside. Matches IEEE 315 / IEC 60617. Better than Eagle defaults.
- **E2E-943 ✅ visual** — Cyan pin handles are clearly visible (~10px wide rectangles, not the smaller dots in Architecture). Easier to grab than Architecture's handles (E2E-779).
- **E2E-944 🟡 visual** — Reference designator inside body is "ATtiny85" — should be "U1" (per the toast which suggests "Add U1 to BOM"). Industry: refs are R1/C1/U1, NOT the part name. Clash between display label and BOM ref.
- **E2E-945 🟡 visual** — Component label "ATtiny85" below body duplicates body-text "ATtiny85". One should be the value (e.g. nothing for IC, or 220Ω for resistor) and the other the reference (U1).
- **E2E-946 🟡 visual** — Pins on RIGHT side show pin function FIRST then number ("PB5 [box] 8") whereas pins on LEFT show "1 [box] VCC". Asymmetric reading order. Verify this is by-design (it actually is industry-standard for IC schematics, but worth confirming).
- **E2E-947 🔴 visual** — No power-symbol annotation on VCC/GND pins. Standard schematics show a `▲` "5V" or `⏚` ground symbol next to the pin. Missing visual cue makes new users confused which pins are power.
- **E2E-948 🟡 visual** — Toast notification "Add U1 to BOM?" assumes user wants the BOM auto-populated — great UX. But sits in bottom-right and doesn't auto-dismiss. After 30s if ignored, what happens?
- **E2E-949 🟢 visual** — The `Add to BOM` toast button is inline in the toast, not requiring user to navigate to BOM. Excellent integration pattern (cf. Calculator → Add to BOM).
- **E2E-950 🟡 visual** — Empty-state heading "Empty Schematic" is STILL VISIBLE in the snapshot tree even though component placed. **Bug: empty-state didn't dismiss after first component.** Screenshot confirms heading IS gone visually so it's hidden but still in DOM — minor a11y leak (screen reader will announce "Empty Schematic" misleadingly).
- **E2E-951 🟡 visual** — Two sets of "ATtiny85" metadata text appear in DOM (uid 62_148 + uid 62_156) — the rendered placement + a hover-tooltip remnant from sidebar. Verify single rendering source.

### Pass 12B — Functional findings on populated schematic

- **E2E-952 ✅ WORKS** — Drag-from-sidebar to canvas creates a real schematic instance with full IC body + pins.
- **E2E-953 ✅ WORKS** — Push to PCB button enables when ≥1 component placed (dynamic gate works correctly).
- **E2E-954 ✅ WORKS** — Toast offers BOM auto-population — closed-loop schematic→BOM workflow.
- **E2E-955 ⚪ NEEDS VERIFY** — Drawing a wire from pin VCC to another component's VCC pin. Wire tool active state confirmed earlier (E2E-611) but actual wire creation needs real pointer-event drag.
- **E2E-956 ⚪ NEEDS VERIFY** — Right-click on placed component → context menu (rotate, mirror, delete, edit value).
- **E2E-957 🔴 GAP** — Coordinate readout "X: 750 Y: 400" appeared at canvas bottom — useful for power users but unlabeled (px? grid units?). Add unit suffix.
- **E2E-958 🟢 IDEA** — When user drags second instance of same part, auto-name to U2 (R2, C2, etc.). Verify this happens.

### Pass 12B — Real wiring/play findings (now possible with components)

- **E2E-959 🟢 IDEA** — Pin handles should accept **drag-from-pin to start a wire** (Eagle/KiCad pattern). Verify this works without explicit wire-tool activation — current state is wire-tool-then-click but pins should auto-enter wire-mode on hover-and-drag.
- **E2E-960 🟢 IDEA** — When dragging a wire from a power pin (VCC/GND), auto-suggest creating a power symbol at the end if user releases over empty canvas.
- **E2E-961 🟢 IDEA** — Hover a pin → tooltip shows "PIN 1 (VCC), 2.7-5.5V, recommended decoupling 100nF". Per-pin pedagogical context from Vault.
- **E2E-962 🟢 IDEA** — Pin handles should have **directional arrows** indicating signal flow direction (input/output/bidirectional/power). Industry standard for high-quality schematics.
- **E2E-963 🟢 IDEA** — Click a pin name (PB0, PB1) → opens MCU pin-detail dialog with alternate functions ("PB0 also serves as: AIN0, MOSI, OC0A, PCINT0").

### Pass 12B — Validation/correction of earlier Pass 10-12 findings

- **E2E-964 ⚠ CORRECTION** to E2E-883 — Drag from sidebar to canvas WORKS via real pointer events (DevTools drag tool). The "drag-only" complaint stands but the "drag is broken" insinuation was wrong. Drag is functional; click-fallback is missing.
- **E2E-965 ⚠ CORRECTION** to E2E-862 — Empty-state copy mentions "import an existing design" — but no import button visible. Re-confirmed even on populated state. Still a gap.
- **E2E-966 ⚠ NEW BUG** to E2E-950 — Empty-state heading remains in DOM after first component placed. Screen-reader users will hear "Empty Schematic" announced as a heading on a non-empty schematic.
- **E2E-967 ⚠ CORRECTION** to E2E-779 — Schematic pin handles are 10px (verified on screenshot) — bigger than Architecture's. Still could be larger. Architecture should match Schematic's handle size.

### Pass 12B — Quick wins re-prioritized

After seeing the populated schematic, prioritized Quick wins for Schematic update:

1. **Click-to-place fallback** (E2E-883/918) — still gap.
2. **Power-symbol annotation on VCC/GND pins** (E2E-947) — better than schematic standards, learning aid.
3. **Reference designator separate from part name** (E2E-944/945) — show "U1" big, "ATtiny85" small.
4. **Empty-state DOM cleanup** (E2E-950/966) — fix screen-reader leak.
5. **Pin tooltip with Vault context** (E2E-961) — already a Pass 5 idea but doubly important here with real pins visible.

### Pass 12B wrap-up

26 new findings (E2E-942 → E2E-967). Total: **967 findings across 13 (sub-)passes**.

**Key correction:** Schematic placement DOES work via real drag — earlier critique was based on synthetic events failing. The real bugs remain:
- Click-to-place fallback missing (drag-only)
- Empty-state stays in DOM
- Reference designator clash with part name
- No power-symbol annotation on VCC/GND
- AI Generate enabled without API key

**Earlier critiques retracted/clarified:** drag works; but it requires a real mouse, which makes it inaccessible to keyboard-only users. The accessibility critique stands.

---

