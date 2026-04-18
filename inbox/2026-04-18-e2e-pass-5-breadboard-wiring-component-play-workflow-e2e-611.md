---
name: E2E walkthrough — PASS 5 — Breadboard wiring + component play workflow (E2E-611+)
description: Frontend E2E findings for 'PASS 5 — Breadboard wiring + component play workflow (E2E-611+)' chunk from 2026-04-18 walkthrough. 69 E2E IDs; 10 🔴, 5 🟡, 43 🟢, 2 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 10
  ux: 5
  idea: 43
  works: 2
  e2e_ids: 69
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## PASS 5 — Breadboard wiring + component play workflow (E2E-611+)

Per Tyler: focus on the actual interactive sandbox experience — wiring components together, dragging parts on/off the canvas, experimenting, testing, playing. The "learn by tinkering" loop.

### Pass 5 — Wire tool UX

Wire tool is `tool-wire` with hotkey `(2)`, aria-label "Wire (2)", title tooltip "Wire (2)". Click activates it: button gets primary tint (`bg-primary/20 text-primary border border-primary/40`) AND canvas cursor becomes `crosshair`. **This is excellent visual feedback** — better than the Schematic toolbar.

- **E2E-611 ✅ visual** — Wire tool active state is properly styled (cyan tint + bordered) AND canvas cursor changes to crosshair. **Best tool-active feedback in the app.** Other tabs should copy this pattern.
- **E2E-612 ✅ kbd** — Hotkey `2` documented in label. Also Schematic uses 'W' for wire — INCONSISTENCY between tabs. Pick one global convention (KiCad uses W, Wokwi uses click, Tinkercad uses click-drag).
- **E2E-613 🟡 UX** — The wire-tool click → click sequence (click first hole → click second hole) is unconventional. Industry standard is **click-and-drag** (Wokwi/Fritzing/Tinkercad). Click-pair makes it feel like Eagle/KiCad. Beginners coming from Wokwi expect drag.
- **E2E-614 🔴 visual GAP** — When wire tool is active and cursor is over a hole, **no visible "snap target" indicator** (verified via DOM — no `wire-snap-preview` element appeared). Industry-standard: hovered hole gets a glowing ring + shows the rail/column ID. Without this, beginners click wrong holes.
- **E2E-615 🔴 visual GAP** — While dragging mid-wire, no **rubber-band preview line** following the cursor. User can't see where the wire will go until committed.
- **E2E-616 🔴 visual GAP** — After wire created, **no visible color** on the wire to indicate which net it joined. Real breadboards use red=VCC, black=GND, yellow=signal — ProtoPulse should auto-color wires by net role.
- **E2E-617 🟡 UX** — `0 LIVE WIRES` counter visible in toolbar. After my drag-test, this counter unchanged (wire didn't actually create — see E2E-619). When it works, the "LIVE" qualifier is unclear — what makes a wire "not-live"? (broken? deleted? in-progress?)
- **E2E-618 🟡 UX** — Wire tool has no visible cancel/escape state in the UI. After clicking first hole, what gets shown? Need a status pill: "WIRING — click destination hole, Esc to cancel".
- **E2E-619 🔴 BUG** — Synthetic `pointerdown`+`pointerup` events on hole elements did NOT create a wire (wireEls count went up by 1 but `0 LIVE WIRES` text stayed). React handler may require a different event sequence (e.g. native `mousedown`+`mouseup` with PointerEvent isComposing flag, or React's synthetic event dispatcher). Worth verifying real-user clicks work in Playwright e2e.

### Pass 5 — Visualizing connections (the "connectivity" experience)

- **E2E-620 ⚪ tool found** — `tool-connectivity-explainer-toggle` exists in toolbar. Untested behavior — presumably highlights all holes/wires in the same net when toggled. CRITICAL learning aid; needs strong visual.
- **E2E-621 🟢 IDEA** — When connectivity-explainer is ON, hovering ANY hole should highlight ALL tied points (rail strip, terminal column) in cyan + show net name overlay. Like KiCad's "highlight net" but interactive.
- **E2E-622 🟢 IDEA** — Add a **net browser sidebar** (like Schematic has): list every net (VCC, GND, NET3) with click-to-highlight. Currently no per-net visibility on Breadboard.
- **E2E-623 🟢 IDEA** — **Continuity tester mode**: click two holes, app says "Connected via rail left_pos" or "Not connected". Solves the #1 beginner question on real breadboards.
- **E2E-624 🟢 IDEA** — **Probe pin overlay**: dropdown "Pin 13 of ATtiny85 maps to row 7, hole c". Current Pin Inspector is per-component; add a global "where is pin X" search.
- **E2E-625 🔴 a11y** — 830 hole elements with sequential testid (`hole-r:left_pos:0` etc.) but no aria-label on each. Screen reader users can't navigate by position. Add `aria-label="Power rail left_positive, position 5"`.

### Pass 5 — Component drag/drop on canvas

- **E2E-626 🔴 BUG (CONFIRMED again)** — Click on Starter Shelf does NOT add to canvas (E2E-571). Drag is the ONLY way. Beginners using touchpads will struggle.
- **E2E-627 🔴 visual** — When dragging a starter onto the canvas, **no ghost preview** of where it will land. (verified via observation; DOM didn't show preview elements during drag attempt.) Add semi-transparent component preview that snaps to grid.
- **E2E-628 🔴 visual** — During drag, no **legality indicator** — components shouldn't be droppable in the center channel (DIPs straddle it; passives can't go there). Show a red overlay on illegal positions during drag.
- **E2E-629 🟡 UX** — Drag from sidebar to canvas requires careful aim — long horizontal drag. Add a "Pick mode" toggle: click starter → cursor becomes a placeholder → click hole to place. (Wokwi pattern.)
- **E2E-630 🟢 IDEA** — Add **drag-to-canvas hover hint**: as user starts dragging, freeze the rest of the UI and show a tutorial overlay "Drop on a tie-point row to place". First 3 components only.

### Pass 5 — Manipulating components AFTER placement

Need to verify these via DOM probe:

- **E2E-631 ⚪ NEEDS VERIFY** — Once placed, can a component be **dragged to reposition**? Industry standard: yes, but with snap-to-grid. ProtoPulse likely supports this via React Flow node drag.
- **E2E-632 ⚪ NEEDS VERIFY** — **Rotation**: keyboard `R` to rotate 90°. Verified in Schematic kbd shortcuts (E2E-221) but not confirmed for Breadboard.
- **E2E-633 ⚪ NEEDS VERIFY** — **Mirror/flip**: keyboard `M`. Same as above — Schematic has it; Breadboard needs verifying.
- **E2E-634 ⚪ NEEDS VERIFY** — **Delete**: select + Delete key OR right-click menu. Tool button `tool-delete` exists but not the same as keyboard delete.
- **E2E-635 🟢 IDEA** — **Multi-select**: drag a marquee around components to select group, then move/delete/rotate as one. Standard in Figma/KiCad.
- **E2E-636 🟢 IDEA** — **Component swap**: select an LED, press `S` → modal "Replace with…" → swap with same-footprint alternate. Preserves wires.
- **E2E-637 🟢 IDEA** — **Component value edit inline**: double-click resistor → opens 220Ω → 1kΩ inline editor without leaving canvas.

### Pass 5 — Off-canvas play (the "stash" + "tray")

- **E2E-638 🟡 UX** — "Manage stash" button visible but not deeply explored. Should be a side-tray that user can leave open while building, like a "parts cart" (modeled on real shop carts).
- **E2E-639 🟢 IDEA** — **Trash zone**: drag a component OFF the breadboard onto a "trash" outside the canvas to remove. Currently delete is keyboard/menu-based; trash zone is more discoverable.
- **E2E-640 🟢 IDEA** — **Bench tray** beside the breadboard: components removed from board sit in a tray (visible row of unused components) ready to drag back. Mirrors real-world workflow.
- **E2E-641 🟢 IDEA** — **"Recently removed"** list — undoable for accidental deletes (like Gmail "Undo send").

### Pass 5 — Live sim and experimentation

- **E2E-642 🔴 visual GAP** — `LIVE SIMULATION` toggle is in canvas header but tiny. When ON, what changes visually? Currents flow? LEDs glow? Verified untested. If it really runs Arduino sketches like Wokwi, this is a HUGE feature buried under a 14px label.
- **E2E-643 🟢 IDEA** — When live sim ON, components should animate: LEDs glow at appropriate brightness, motors spin (visual indicator), buzzers emit a small audio beep, displays show actual content.
- **E2E-644 🟢 IDEA** — **Pause/Step/Speed controls** for sim — slow it down to learn timing, step single µs to debug, speed up to test long-running behavior.
- **E2E-645 🟢 IDEA** — **Time-travel scrubber**: drag back in time to replay any past state. Like a TiVo for circuits.

### Pass 5 — Undo/Redo for experimentation

- **E2E-646 🔴 NEEDS VERIFY** — Undo/Redo for breadboard actions (place / move / wire / delete). Schematic has Ctrl+Z/Y. Breadboard needs same + verified to work cross-action.
- **E2E-647 🟢 IDEA** — **Branching history** — like Photoshop history palette but with screenshots. "Try variant A vs B" without committing.
- **E2E-648 🟢 IDEA** — **Auto-snapshot every N changes** — never lose work to a misclick.

### Pass 5 — Learning / pedagogical aids

- **E2E-649 🟢 IDEA** — **Hover any pin → "What does this pin do?"** — auto-tooltip from Vault. ESP32 GPIO12 hover → "STRAPPING PIN — MUST BE LOW AT BOOT (vault: esp32-gpio12...)".
- **E2E-650 🟢 IDEA** — **Wire color guide** — sidebar legend explaining "Red = VCC, Black = GND…" with click to filter wires by role.
- **E2E-651 🟢 IDEA** — **"Why didn't this work?"** mode — after a failed audit, AI walks user through every connection one at a time, explaining the issue.
- **E2E-652 🟢 IDEA** — **Mistake catalog** — when user makes a common mistake (no current limiter on LED, no decoupling cap, etc.), pop a learning card BEFORE they hit Audit. Proactive teaching.
- **E2E-653 🟢 IDEA** — **"Build along" challenges** — daily/weekly puzzles ("build a 555 timer at 1Hz") with leaderboard. Gamifies the play loop.
- **E2E-654 🟢 IDEA** — **In-canvas annotations** — sticky notes on the breadboard ("This is the I2C bus", "Don't change this wire"). Great for teachers + collaborators.

### Pass 5 — Visualization wins/gaps

- **E2E-655 🟢 IDEA** — **Voltage probe ghost-meter** — hover any hole during sim → shows live voltage reading. Like a virtual multimeter.
- **E2E-656 🟢 IDEA** — **Power-tree view** — toggle to see VCC/GND distribution as a tree visualization. Helps with grounding bugs.
- **E2E-657 🟢 IDEA** — **Net-color heatmap** — color the entire breadboard background by net occupancy — busy nets glow, untouched stay dim.
- **E2E-658 🟢 IDEA** — **Animated wire pulse on data buses** — I2C/SPI/UART nets pulse when transmitting during sim.
- **E2E-659 🟢 IDEA** — **Photo-realistic mode** — toggle between "schematic abstract" view and "looks like a real breadboard with photo-textures" — for documentation export.

### Pass 5 — Wire-specific creative ideas

- **E2E-660 🟢 INNOVATION** — **Auto-route wire**: hold Shift while clicking second hole → app picks the visually cleanest path (avoiding crossings). Like Eagle's auto-routing for breadboards.
- **E2E-661 🟢 INNOVATION** — **Wire segments mode**: hold Alt → wire follows a 90° L-shape with intermediate corner. Click corner to set bend point.
- **E2E-662 🟢 INNOVATION** — **Bundle wires**: select multiple wires → group as a "ribbon" that moves together. Reflects real-world ribbon cables.
- **E2E-663 🟢 INNOVATION** — **Wire length budget** — show total wire mm used per net so users learn signal-integrity (long wires = noise/crosstalk).
- **E2E-664 🟢 INNOVATION** — **Color-by-rule**: red = unsafe (short), yellow = unverified, green = DRC-clean. Live as you wire.
- **E2E-665 🟢 INNOVATION** — **Wire-to-component AI suggester**: hover a partial wire → AI proposes "did you mean to connect to GPIO5? click to complete".

### Pass 5 — Component-play creative ideas

- **E2E-666 🟢 INNOVATION** — **Component "personality" tooltips**: hover ATmega328P → "Hi! I'm Arduino's brain. I've got 14 digital pins and 6 analog. Watch out for pins 0/1 — they're for Serial." Anthropomorphize for engagement.
- **E2E-667 🟢 INNOVATION** — **Drag-to-replace** — drag a new component on top of an existing one → ask to swap. Preserves wires where pin map matches.
- **E2E-668 🟢 INNOVATION** — **"Twin" components** — drag-with-shift creates a linked twin. Adjusting one updates both. For symmetric circuits (motor pairs, LED arrays).
- **E2E-669 🟢 INNOVATION** — **Component "sound test"**: tap a buzzer on canvas → audible beep. Tap an LED → it lights up. Tactile / immediate feedback.
- **E2E-670 🟢 INNOVATION** — **Interactive datasheet overlay**: double-click any component → semi-transparent overlay shows the official datasheet pinout aligned with the rendered component. Best of both worlds.

### Pass 5 — Sandbox / play-mode ideas

- **E2E-671 🟢 INNOVATION** — **"Sandbox" tab variant**: a no-save, no-validation, infinite-undo mode for free-form experimentation. Reduce psychological barrier to messing around.
- **E2E-672 🟢 INNOVATION** — **"Random circuit" generator**: button "Surprise me!" generates a random viable circuit (LED + resistor + button) — for inspiration / learning by example.
- **E2E-673 🟢 INNOVATION** — **Time-lapse export**: record entire build session as a sped-up MP4 to share on Twitter/YouTube. Maker community gold.
- **E2E-674 🟢 INNOVATION** — **Co-build session**: Tyler invites a friend → both see same breadboard, take turns placing parts. Built-in voice chat.
- **E2E-675 🟢 INNOVATION** — **Hardware "challenge mode"** — daily prompt ("build a 60Hz blinker without using delay()") with shareable solutions.

### Pass 5 — TL;DR Wiring + play

**Critical wiring UX gaps:**
- No snap-target indicator on hovered hole when wire-tool active
- No rubber-band preview line during wire creation
- No auto-color wires by net role
- "0 LIVE WIRES" counter unclear semantically
- Click-pair vs click-drag is unconventional vs Wokwi/Fritzing

**Critical play UX gaps:**
- Click on Starter Shelf does nothing (drag-only)
- No ghost-preview during drag
- No legality overlay during drag
- No multi-select / marquee select
- No swap-component / value-inline-edit
- Live Sim toggle buried as tiny pill

**Top-10 highest-impact innovations for the wiring/play loop:**
1. AR guided wiring (point phone at real breadboard)
2. Animated current-flow on wires during sim
3. Hover-pin → "What does this pin do?" auto-tooltip from Vault
4. Photo-of-real-board → digital reconstruction
5. Voltage-probe ghost-meter on hover
6. Mistake catalog (proactive teaching before audit)
7. Auto-route wire on Shift+click
8. Trash-zone for drag-to-delete
9. Bench tray beside canvas (parts not yet placed)
10. Sandbox tab variant (no-save free-play mode)

---

