---
name: E2E walkthrough — PASS 4 — BREADBOARD LAB DEEP DIVE (E2E-562 onwards)
description: Frontend E2E findings for 'PASS 4 — BREADBOARD LAB DEEP DIVE (E2E-562 onwards)' chunk from 2026-04-18 walkthrough. 57 E2E IDs; 10 🔴, 10 🟡, 25 🟢, 1 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: complete_p1_backlog_BL-0713-0771
severity_counts:
  p1_bug: 10
  ux: 10
  idea: 25
  works: 1
  e2e_ids: 57
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## PASS 4 — BREADBOARD LAB DEEP DIVE (E2E-562 onwards)

Per Tyler request: exhaustive Breadboard Lab pass with visual + functional + competitive lens. Existing 2026-04-17 audit covered model + DRC; this pass focuses on UX/visual/workflow/innovation gaps NOT in that audit. Screenshots: `35-breadboard-fullpage.png`, `36-breadboard-with-led.png`.

### Surface inventory observed

Major panels (left column, top→bottom):
1. **Header strip** — "BREADBOARD LAB" + tagline + collapse toggle
2. **Workbench actions row** — 5 buttons: Manage stash / Open schematic / Component editor / Community / Shop missing parts
3. **Stats row** — 9 numeric tiles: PROJECT PARTS / TRACKED / OWNED / PLACED / BENCH-READY / LOW STOCK / MISSING / VERIFIED / STARTER-SAFE
4. **Quick Intake** — Scan + Add buttons, qty + storage inputs
5. **Bench AI card** — 6 AI actions (Resolve exact part / Explain / Diagnose / Find substitutes / Gemini ER stash / Gemini ER layout)
6. **Board Health card** — Audit + Pre-flight Check buttons
7. **Starter Shelf** — 7 starter drops (MCU / DIP IC / LED / Resistor / Capacitor / Diode / Switch)
8. **Component Placer** — search + 5 filter pills (All / Owned / Bench-ready / Verified / Starter) + group-by-category list

Right column (canvas):
9. **Toolbar** — 8 tools (select / wire / delete / zoom in / zoom out / reset view / DRC toggle / connectivity explainer)
10. **Health pill** ("HEALTHY 100") + circuit selector + Live Sim toggle
11. **Breadboard SVG** — 4 power rails (left_pos / left_neg / right_pos / right_neg) labeled top + bottom; columns a-j; rows 1-63 with 5-step labels (1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 63); ~830 tie-point holes rendered as `hole-r:rail:N`

### Pass 4 — Visual / hierarchy findings

- **E2E-562 🔴 visual** — Left workbench column is **9 sections + 8 stat tiles + 7 starter drops + 5 filter pills + parts list** = ~25 distinct UI regions stacked vertically. Vertical scroll required even at 1200px height. Way too dense for one column. Split into 3 collapsible groups: **Build** (Workbench actions / Quick Intake / Starter Shelf / Component Placer) / **AI** (Bench AI card) / **Health** (Stats / Audit / Pre-flight).
- **E2E-563 🔴 visual** — Stats tiles use 3×3 grid in a narrow column = each tile is tiny (~70×70px) with two text lines + number. Borderline unreadable on first glance. Either widen column or reduce to 4 most-important stats with "more" disclosure.
- **E2E-564 🟡 visual** — Stats tiles labels are uppercase semi-abbreviated ("BENCH-READY", "STARTER-SAFE") — beginners won't parse these mid-flow.
- **E2E-565 🔴 visual** — On a fresh project, all stats are 0 except "TRACKED 1", "MISSING 1", "STARTER-SAFE 1". So "1 part is tracked but missing"? Stat semantics overlap and contradict (an item can be both tracked AND missing AND starter-safe simultaneously). Need a single semantic taxonomy.
- **E2E-566 🟡 visual** — Workbench action buttons use cyan + green + purple + outline styling without clear semantic mapping. Unify or document the button-color taxonomy.
- **E2E-567 🟡 visual** — Top-right of canvas shows "HEALTHY 100" pill + "New Circuit" select + Live Sim toggle. Three different shapes in one strip — visually noisy.
- **E2E-568 ✅ visual** — Breadboard canvas itself is **gorgeous** — proper power rails with `+`/`-` color bands, real column letters a-j, real row numbers, and hole grid resembling a physical board. Best canvas in the app.
- **E2E-569 🟡 visual** — Power rail labels say `rail-label-left_pos-top` and `rail-label-left_pos-bottom` — these are RAIL-INDEX labels not user-facing. The actual rendered text is what matters; verify it shows `+` `−` icons.
- **E2E-570 🟢 visual** — Center channel rendered correctly but no DIP IC straddle preview when hovering DIP IC starter. Add ghost-component preview on hover-over-board with snap-to-grid feedback.

### Pass 4 — Functional findings

- **E2E-571 🔴 BUG** — Click on `breadboard-starter-led` registers but **does NOT place a component on canvas**. The "Drag a starter part…" hint persists. Starter Shelf is drag-only with no click-to-place affordance. Add a "click to add at next free position" alternative.
- **E2E-572 🔴 BUG (parallels E2E-091)** — `Audit` button on empty board reports **score 100/100 — Healthy — Board is healthy — no issues detected**. An empty board can't be "healthy" — it's empty. Same false-positive class as Validation tab.
- **E2E-573 🔴 BUG** — `Pre-flight Check` on empty board reports **All clear — ready to build! — Voltage Rail Compatibility: pass / Decoupling Capacitors: pass / USB Power Budget: pass / ESP32 ADC2/WiFi Conflict: pass / Required Pin Connections: pass**. Pre-flight checks pass on a project with NO components. Should report "Cannot pre-flight: no components placed".
- **E2E-574 🟡 UX** — Bench AI buttons are labeled with action names ("Resolve exact part request", "Diagnose likely wiring issues"). All require API key. None show disabled state when no key is configured (verified Bench AI panel exists; gating not visible).
- **E2E-575 🟡 UX** — Component Placer filter pills (All / Owned / Bench-ready / Verified / Starter) don't show count badges (cf. Architecture asset library which DOES). Inconsistency.
- **E2E-576 🟢 IDEA** — Bench AI has 2 "Gemini ER" labelled buttons ("build from my stash", "cleaner layout plan"). "ER" abbreviation unclear — Engineering Review? Expand or rename.

### Pass 4 — Toolbar critique

- **E2E-577 🟡 visual** — Canvas toolbar has 8 icon-only tools with NO visible labels. Zoom in/out/reset are guessable; DRC toggle and Connectivity explainer toggle are NOT. (cf. Schematic which uses `(V)` `(W)` hotkey-in-label pattern — apply here.)
- **E2E-578 🔴 visual** — `tool-drc-toggle` and `tool-connectivity-explainer-toggle` — toggle state (on/off) not visually obvious without aria-pressed.
- **E2E-579 🟢 IDEA** — Add `tool-measure` (click two points on board to show distance in mm + tie-point count). Common need for breadboard layout.

### Pass 4 — Audience-specific (Breadboard)

- **E2E-580 🔴 newbie** — A first-time user sees 9 stats + 6 AI buttons + 5 workbench actions + Starter Shelf BEFORE the actual breadboard. Cognitive overload. Beginner mode should hide everything except Starter Shelf + canvas + Audit.
- **E2E-581 🟡 newbie** — "Stash" terminology (E2E-356 again) — beginner won't grasp that this is "your physical parts at home".
- **E2E-582 🟢 newbie** — Hint text on canvas "Drag a starter part… use the Wire tool (2)…" is excellent. Promote it as the *only* visible thing for empty-board state.
- **E2E-583 🟢 expert** — Power user wants keyboard placement: type `R 220 a5` to place a 220Ω resistor at column a row 5. No CLI mode visible.
- **E2E-584 🟢 expert** — Power user wants saved breadboard "patterns" (e.g. "my standard ESP32 power chain") that drag-place all wires + parts at once. Closest is Patterns tab but no breadboard-specific drop-in.
- **E2E-585 🟢 expert** — Expert wants real-time current/voltage simulation overlays per net, not just "DRC pass/fail". Live ammeter on a wire.

### Pass 4 — Competitive (Breadboard vs Wokwi / Tinkercad / Fritzing)

- **E2E-586 🟢 STRATEGIC vs Wokwi** — Wokwi simulates Arduino + ESP32 firmware running against a virtual breadboard with real GPIO state (LED brightness, sensor readings). ProtoPulse Breadboard tab has "Live Sim" toggle in header but unverified depth. Should be: paste Arduino sketch → see virtual LED blink driven by code.
- **E2E-587 🟢 STRATEGIC vs Tinkercad** — Tinkercad Circuits offers schematic / breadboard / PCB switching with ONE shared component library. ProtoPulse splits these; the cross-tab sync is partly there but no smooth transitions.
- **E2E-588 🟢 STRATEGIC vs Fritzing** — Fritzing's "Welcome / Breadboard / Schematic / PCB" 4-view model with named graphical Sub-parts (with realistic colored body images). ProtoPulse uses generic "DIP-style starter drops" — could ship realistic PNG body images for popular ICs (LM7805 TO-220, ESP32 dev board PCB).
- **E2E-589 🟢 STRATEGIC** — Wokwi has built-in **virtual logic analyzer** + **virtual oscilloscope** that hooks to any breadboard pin. Killer for debugging. Add as a new toolbar tool.
- **E2E-590 🟢 STRATEGIC** — Wokwi's scenarios let you script test sequences ("at t=2s send button press, expect LED toggle"). ProtoPulse breadboard has "scenarios panel" mentioned in BL audit; verify it ships.

### Pass 4 — Innovation (Breadboard-specific)

- **E2E-591 🟢 INNOVATION** — **Animated wire-flow** during simulation: visualize current direction as moving dashes along wires (low-current = grey, normal = cyan, high = red).
- **E2E-592 🟢 INNOVATION** — **Heat map overlay**: color-tint components by power dissipation. Hot resistors = orange/red. Beginner intuition aid.
- **E2E-593 🟢 INNOVATION** — **"Trace this signal"** mode: click a pin → all wires/holes carrying that net light up across the board. (Connectivity explainer toggle may already do this — verify and label.)
- **E2E-594 🟢 INNOVATION** — **Reverse mode**: take a photo of a real breadboard → AI reconstructs digital model. Computer vision applied to the maker workflow.
- **E2E-595 🟢 INNOVATION** — **Print-and-stick template**: 1:1 PDF of board layout that you print on label paper, peel, stick to physical breadboard underneath as a guide. Bridges digital → physical.
- **E2E-596 🟢 INNOVATION** — **Simulated breadboard noise**: model real-world contact resistance (5mΩ-20mΩ per tie-point) so users learn why long jumper chains drop voltage.
- **E2E-597 🟢 INNOVATION** — **Component fatigue counter**: tie-points have a 50,000-insertion lifetime — track how many times a hole has been used in this project so users learn when to rotate components.
- **E2E-598 🟢 INNOVATION** — **Breadboard-to-PCB AI translator**: click "Convert this breadboard to PCB" — AI proposes a PCB layout that preserves the breadboard's intent (component grouping, signal flow).
- **E2E-599 🟢 INNOVATION** — **Multiplayer breadboard sessions**: two users connect to the same breadboard remotely; one places components, other places wires. Coding-bootcamp pair-programming style.
- **E2E-600 🟢 INNOVATION** — **Augmented reality "guided wiring"**: open project on phone, point camera at physical breadboard → AR overlays shows next wire to place per the schematic. Step-by-step build guidance. (Restated from E2E-542 — apply specifically to Breadboard Lab.)

### Pass 4 — Workflow gaps (Breadboard)

- **E2E-601 🔴 workflow** — User flow "I want to build a Blink LED on real hardware": Architecture → add LED + Resistor + MCU → Schematic → wire pins → Breadboard → drag parts → drag wires → Audit → Build. **5 tab transitions** for the simplest project. Need a single "Quick Build" mode that does all of it from a Starter Circuit one-click.
- **E2E-602 🟡 workflow** — Quick Intake (scan + add) is for adding a part to your stash inventory. Workflow position is awkward — should be in Stash modal, not Breadboard top-of-page. Move and reduce visual weight.
- **E2E-603 🟡 workflow** — Breadboard's "Live Sim" toggle (top-right) is critical but tiny + unlabeled. If it really runs Arduino sketch in real-time, that's a huge feature — should be a prominent CTA on the toolbar.

### Pass 4 — Build/expand existing BL audit

- **E2E-604 (expands BL-0150 inventory tracking)** — When user drags a part to the breadboard, deduct from stash inventory immediately + visualize the inventory drain. When wire deleted, return part to stash. Closed-loop inventory.
- **E2E-605 (expands BL-0270 ESP32 ADC2)** — ESP32 ADC2/WiFi Conflict pre-flight check passes on empty board (E2E-573). Wire the check to first detect "is there an ESP32 on the board AND is WiFi being used" — if no, skip the rule (don't fake-pass).
- **E2E-606 (expands BL audit Wave 4 UX depth)** — Empty-state hint should be inline with the canvas drop zone, not a static text below. Use animated "drop-here" zone that pulses when user drags from Starter Shelf.
- **E2E-607 🟢 IDEA** — Starter drops have descriptive subtitle ("Polarized indicator with live-state rendering") — these are GOLD pedagogical moments. Make them clickable to open a 30s explainer video / vault note.
- **E2E-608 🟢 IDEA** — Component Placer "Bench-ready" filter — what does ready mean? (verified pin count? in-stock? has 3D model?) Tooltip needed on each filter.
- **E2E-609 🔴 visual** — Health pill top-right says "HEALTHY 100" in green even after I clicked LED starter (which didn't actually place — but if it had, the score should change). Visual signal is sticky/incorrect.
- **E2E-610 🟢 IDEA** — Add hold-Shift-drag to copy a component (cf. Figma). Common need for repeated parts (5x same resistor).

### Pass 4 — TL;DR for BL

**P0 bugs:**
- Audit reports 100/100 healthy on empty board (E2E-572)
- Pre-flight passes all 5 checks on empty board (E2E-573)
- Starter click does nothing (E2E-571) — drag-only with no fallback

**Top UX wins:** breadboard SVG canvas, hint text, bench AI surface area
**Top UX problems:** vertical density (9 sections in one column), 9 contradictory stat tiles, no labels on canvas toolbar, "Stash" terminology

**Top innovations:** AR guided wiring, animated wire-flow, heat map overlay, print-and-stick template, breadboard-to-PCB AI translator

---

