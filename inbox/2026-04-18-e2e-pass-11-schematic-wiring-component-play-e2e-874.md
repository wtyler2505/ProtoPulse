---
name: E2E walkthrough — PASS 11 — SCHEMATIC WIRING + COMPONENT PLAY (E2E-874+)
description: Frontend E2E findings for 'PASS 11 — SCHEMATIC WIRING + COMPONENT PLAY (E2E-874+)' chunk from 2026-04-18 walkthrough. 47 E2E IDs; 9 🔴, 2 🟡, 16 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 9
  ux: 2
  idea: 16
  works: 0
  e2e_ids: 47
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## PASS 11 — SCHEMATIC WIRING + COMPONENT PLAY (E2E-874+)

Mirroring Pass 5 for Schematic. Focus: actually wiring components on schematic, the experimentation loop.

### Pass 11 — Wire (net) creation UX

- **E2E-874 🟡 UX** — Wire tool hotkey is `W` on Schematic but `2` on Breadboard. Inconsistency (E2E-612 again, but explicit).
- **E2E-875 ⚪ NEEDS VERIFY** — Click pin handle to start wire → drag to next pin → click to commit. Industry standard.
- **E2E-876 🔴 GAP** — When wire tool active, no visible **net-name dropdown** above cursor. KiCad shows "VCC" / "GND" / "NET-NAME" autocomplete for naming the net being drawn.
- **E2E-877 🔴 GAP** — Wire color: schematic wires are typically uniform colored (industry standard: thin black line). But during sim should color-by-signal-state (high=red, low=blue). Verify.
- **E2E-878 🟡 UX** — Angle constraint (Free/45/90) — what angle is currently in use? Verify visual indicator on the active radio.
- **E2E-879 🔴 GAP** — Schematic doesn't visualize **bus** wires (multiple parallel signals as a single fat line). Industry standard for ribbon/SPI/data buses.
- **E2E-880 🟢 IDEA** — **Net auto-name**: when wire connects to a power pin, auto-name VCC/GND. When connects to MCU GPIO, auto-name "GPIO5_NET" with renaming dialog.
- **E2E-881 🟢 IDEA** — **Net validator**: warn when 2 wires have same auto-name but different topology (split nets that should be one).
- **E2E-882 🟢 IDEA** — **Wire as art**: support gentle arcs / 90°-rounded corners as cosmetic options. Cf. KiCad's curved wires for vintage-feel schematics.

### Pass 11 — Component placement

- **E2E-883 🔴 GAP** — Click on Parts placer item (verified by `cursor-grab` class) suggests drag-only. **Same as Breadboard E2E-571** — no click-to-place fallback.
- **E2E-884 🔴 GAP** — During drag of a part, no **ghost preview** of where it will land + no rotation preview.
- **E2E-885 🔴 GAP** — Parts panel's group header "MICROCONTROLLER 1" — clicking should filter list to only that category. Untested.
- **E2E-886 🟢 IDEA** — **Component palette by usage**: top of placer auto-promotes most-used parts in this project. Recently dropped resistor → resistor pinned to top.
- **E2E-887 🟢 IDEA** — **Quick-place hotkey**: `R` for resistor, `C` for capacitor (KiCad pattern). Type → cursor enters place-mode for that part.

### Pass 11 — Manipulating instances

- **E2E-888 ⚪ NEEDS VERIFY** — Rotate `R`, Mirror `M`, Delete `Del` (per kbd dialog). Verify these work on a placed component.
- **E2E-889 🔴 GAP** — No **multi-select marquee** verified. KiCad essential.
- **E2E-890 🔴 GAP** — No **align tools** for components.
- **E2E-891 🟢 IDEA** — **Pin-by-pin labeling**: hover a pin → tooltip shows pin name + net name + voltage in sim.
- **E2E-892 🟢 IDEA** — **Reference-designator auto-numbering**: dropping 3 resistors auto-names R1, R2, R3.
- **E2E-893 🟢 IDEA** — **Per-instance value**: 220Ω vs 1kΩ resistors visually distinct (color band, value label).

### Pass 11 — ERC (Electrical Rule Check)

- **E2E-894 ⚪ NEEDS VERIFY** — `Toggle ERC panel` button exists. Click should open a panel listing all ERC violations (floating pins, multiple drivers, no-connection markers).
- **E2E-895 🔴 GAP** — On empty schematic, ERC presumably says "0 violations" — same false-positive risk as Audit (E2E-572).
- **E2E-896 🟢 IDEA** — **ERC as you wire**: live yellow squiggle under a floating input pin the moment you draw it. (Like a spell-checker for electrical correctness.)

### Pass 11 — Visualizing nets

- **E2E-897 🟢 IDEA** — **Net spotlight**: click a wire → all wires/pins on that net glow. Right-click → "select all instances of this net".
- **E2E-898 🟢 IDEA** — **Net browser sidebar** (verified `schematic-toggle-net-browser` exists): list nets with click-to-highlight + filter "show only nets with errors".
- **E2E-899 🟢 IDEA** — **Cross-probe to Breadboard/PCB**: select a wire on schematic → corresponding wire highlights on Breadboard tab + PCB trace highlights on PCB tab.

### Pass 11 — Live sim experimentation

- **E2E-900 ⚪ NEEDS VERIFY** — Sim sub-panel — what does it do? Run SPICE? Show waveforms? Verify.
- **E2E-901 🟢 IDEA** — **Probe placement**: click a pin during sim → adds a virtual oscilloscope probe → opens a waveform viewer.
- **E2E-902 🟢 IDEA** — **Tweak-and-watch**: change a resistor value → see waveform update in real-time.

### Pass 11 — Off-canvas play

- **E2E-903 🟢 IDEA** — **Tray** for unused parts (cf. Breadboard E2E-640). Stage components beside canvas before committing to canvas placement.
- **E2E-904 🟢 IDEA** — **Drag-to-Architecture**: drag a Schematic instance back to Architecture tab → registers as a new arch node. Cross-tab linkage.

### Pass 11 — Innovation (Schematic-specific)

- **E2E-905 🚀** — **Schematic auto-tidy**: button "Tidy" → app re-flows all components into a clean horizontal layout with crossings minimized. Like `prettier` for circuits.
- **E2E-906 🚀** — **Schematic-to-spoken-narration**: AI reads your schematic aloud — "ATtiny85 with VCC tied to 5V via decoupling cap, OUTPUT pin to LED in series with 220Ω". Accessibility win.
- **E2E-907 🚀** — **Hand-drawn capture**: photograph hand-drawn schematic → AI digitizes to ProtoPulse format.
- **E2E-908 🚀** — **Schematic styles**: render in IEEE 315 (US), IEC 60617 (EU), JIC (industrial), or hand-drawn whiteboard styles. Same circuit, different aesthetics.
- **E2E-909 🚀** — **Animated current-flow on wires** during sim (cf. Breadboard E2E-591). For schematic — flowing dashed pattern.
- **E2E-910 🚀** — **Sim probe scope**: built-in inline waveform viewer attached to every probe. Drop probe → mini Waveform widget renders inline.
- **E2E-911 🚀** — **Schematic diff**: two snapshots side by side with color-coded changes (added wire green, removed red, modified yellow).
- **E2E-912 🚀** — **Schematic → simulator preset**: one-click "Set up SPICE simulation" auto-configures probes + analysis type from schematic intent.
- **E2E-913 🚀** — **Datasheet auto-attach**: every IC instance gets a tiny 📄 icon → click → opens manufacturer datasheet PDF inline.
- **E2E-914 🚀** — **AI net naming**: AI looks at the topology and auto-names cryptic nets ("NET-(R1-Pad1-C2-Pad1)" → "Vout_filtered").

### Pass 11 — TL;DR Schematic wiring + play

**Critical wiring UX gaps:**
- W vs 2 hotkey inconsistency between tabs
- No net-name autocomplete/dropdown during wire draw
- No bus wire visualization
- No live ERC squiggles
- Add Component CTA is broken without preselected part

**Top wins:**
- Hotkey-in-label pattern (best-in-class)
- Net-browser toggle present
- Sub-panels Parts/Power/Sheets/Sim cover full schematic spectrum
- Push to PCB button has hover-tooltip explanation

---

