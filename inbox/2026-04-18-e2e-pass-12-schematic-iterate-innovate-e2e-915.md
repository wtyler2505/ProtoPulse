---
name: E2E walkthrough — PASS 12 — SCHEMATIC ITERATE & INNOVATE (E2E-915+)
description: Frontend E2E findings for 'PASS 12 — SCHEMATIC ITERATE & INNOVATE (E2E-915+)' chunk from 2026-04-18 walkthrough. 59 E2E IDs; 0 🔴, 0 🟡, 2 🟢, 0 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 0
  ux: 0
  idea: 2
  works: 0
  e2e_ids: 59
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## PASS 12 — SCHEMATIC ITERATE & INNOVATE (E2E-915+)

Mirroring Pass 6/9. Deeper iterations + wild moonshots + practical packaging for Schematic.

### (A) ITERATE — micro-interactions deeper

- **E2E-915 ⤴ E2E-849** — Vestigial disabled `Place Component` / `Place Power` buttons should either:
  (a) become click-to-enter-place-mode (cursor → "click on a part in placer to begin", then click canvas), OR
  (b) be removed entirely. Current state is a UX trap.
- **E2E-916 ⤴ E2E-876** — Net naming dropdown during wire draw: smart auto-suggestions in priority — (1) "VCC/GND" if connecting to obvious power, (2) signal-name from connected pin function ("SDA", "SCL", "TX"), (3) numeric "NET17" fallback. Also `+ Add to project nets…` for explicit naming.
- **E2E-917 ⤴ E2E-878** — Active angle constraint: highlight the chosen radio with a cyan border + show a tiny example diagram beside the radio ("Free = any angle, 45 = bend at 45°, 90 = right-angle only").
- **E2E-918 ⤴ E2E-883** — Click-to-place fallback for Schematic: same pattern as Architecture's `+ button` per part. Eliminates the drag-only requirement.
- **E2E-919 ⤴ E2E-885** — Group header click should toggle filter to that category. Add a `+` button on the group header to add a new part of that family inline.
- **E2E-920 ⤴ E2E-892** — Reference designators: auto-name with smart-skip ("R1, R2, R5" if R3/R4 deleted) AND allow batch-renumber ("Renumber R1..Rn left-to-right").
- **E2E-921 ⤴ E2E-893** — Resistor visual variants: render with appropriate color bands (220Ω = Red-Red-Brown), capacitor with electrolytic vs ceramic body shapes.
- **E2E-922 ⤴ E2E-896** — Live ERC "spell-checker": yellow squiggle under floating pins, red under shorts. Hover shows fix suggestion. Updates as user wires.
- **E2E-923 ⤴ E2E-897** — Net spotlight: click net → also shows in a tooltip the net's voltage during sim, current draw, list of all connected pins ("VCC: 4 pins, 12mA").
- **E2E-924 ⤴ E2E-898** — Net browser dual-pane (left = nets, right = pins on selected net) + filter "Floating", "Multi-driver", "VCC", "GND", custom regex.
- **E2E-925 🟢 NEW** — **"Cleanup" action**: select messy section → "Auto-arrange" reflows components left-to-right with minimum wire crossings.
- **E2E-926 🟢 NEW** — **Visual hierarchy import**: drop a sketched whiteboard PNG behind the canvas as a tracing template; place components over the sketch.

### (B) INNOVATE — wild moonshots (Schematic)

- **E2E-927 🚀** — **Schematic karaoke mode**: highlight components in sequence as the AI explains them. ("Now we have R1 a current-limiting resistor… now we add C1 a decoupling cap…"). Self-paced learning.
- **E2E-928 🚀** — **Time-travel scrubber for sim**: slider at top of canvas to scrub through the last 10 ms of simulation. See LED brightness pulse, debounce ringing, etc.
- **E2E-929 🚀** — **Schematic "lint as you type"**: like ESLint for circuits — fires rules in real-time. "I2C without pull-ups", "Unused MCU pin", "Missing decoupling cap on IC1".
- **E2E-930 🚀** — **Schematic-to-narrative**: paste a schematic image → AI describes it as a paragraph for documentation.
- **E2E-931 🚀** — **Schematic-to-code**: AI generates Arduino sketch starter code from the schematic's pin assignments.
- **E2E-932 🚀** — **Schematic A/B testing**: maintain two schematic variants; toggle between them; compare BOM cost / parts count / signal integrity.
- **E2E-933 🚀** — **AI design review session**: chat with AI persona that critiques your schematic decisions in real-time. "Why did you choose 220Ω here? With Vf=2V on a 3.3V rail you'd get 5.9mA, not 20mA."
- **E2E-934 🚀** — **Lab-bench stream integration**: connect a real oscilloscope/multimeter via USB-Serial → live readings overlay onto schematic probe icons.
- **E2E-935 🚀** — **Schematic VR mode**: "fly through" a 3D rendering of your schematic — components float in space connected by glowing nets. Cool factor + spatial debugging.
- **E2E-936 🚀** — **Schematic time-machine** (cf. Architecture E2E-833): replay how the schematic evolved over time.
- **E2E-937 🚀** — **Schematic-as-LaTeX**: export schematic as TikZ / CircuiTikZ for academic papers. Nobody currently makes this easy.
- **E2E-938 🚀** — **Auto-fault-injection**: AI introduces a deliberate failure (open R1, short C2) and asks "What will happen?" — Socratic teaching tool.
- **E2E-939 🚀** — **Schematic mood**: theme entire Schematic in retro Tek green-on-black, vintage Tektronix, blueprint, modern dark, etc. Skin packs (cf. E2E-738).
- **E2E-940 🚀** — **Multi-modal AI**: speak "add a low-pass filter at 1kHz between OUT and AMP_IN" → AI generates the RC pair + wires it.
- **E2E-941 🚀** — **Smart hierarchical sheets**: auto-detect repeating patterns (e.g. 4 identical motor-driver branches) → suggest collapse to a sub-sheet.

### (C) PRACTICAL PACKAGING — Schematic roadmap

**Quick wins (<2 weeks):**
1. **Click-to-place fallback** (E2E-883/918) — fix drag-only requirement.
2. **Net-name autocomplete during wire draw** (E2E-876/916).
3. **Live ERC squiggles** (E2E-896/922).
4. **Auto-name reference designators** (E2E-892/920).
5. **Vestigial Place Component / Place Power buttons** (E2E-849/915) — fix or remove.

**1-month investments:**
6. **Net browser dual-pane + filters** (E2E-898/924).
7. **Net spotlight + sim voltage tooltip** (E2E-897/923).
8. **Resistor color-band rendering + capacitor body variants** (E2E-893/921).
9. **Auto-tidy / Cleanup action** (E2E-905/925).
10. **Multi-select marquee + align tools** (E2E-889/890).

**Quarter investments (changes the product):**
11. **Schematic-to-Arduino code AI** (E2E-931).
12. **Schematic karaoke / narrative AI** (E2E-927/906).
13. **Live oscilloscope/multimeter USB integration** (E2E-934).
14. **Schematic A/B testing** (E2E-932).
15. **Multi-modal AI ("add a low-pass filter at 1kHz")** (E2E-940).

### Pass 12 wrap-up

Schematic passes (10-12) added **97 findings (E2E-845 → E2E-941)**. Total now: **941 findings across 12 passes**.

**Schematic top P0/P1:**
- Add Component empty-state CTA broken without preselected part (E2E-856)
- Vestigial Place Component / Place Power perma-disabled buttons (E2E-849)

**Schematic top UX gaps:**
- No net-name autocomplete during wire
- No bus wire visualization
- No live ERC
- W vs 2 hotkey inconsistency
- Sim sub-panel ambiguous

**Schematic top wins:**
- Hotkey-in-label pattern (Select(V), Pan(H), Draw Net(W), Annotation(T)) — best-in-class
- Hierarchical sheets sub-panel
- Net browser toggle present
- Push to PCB hover-tooltip excellent
- Empty state with prominent Add Component button

**Top innovations:**
- Schematic karaoke mode (sequenced AI explainer)
- Schematic-to-Arduino code AI
- Schematic-to-LaTeX (TikZ/CircuiTikZ academic export)
- Live oscilloscope integration via USB
- Schematic VR fly-through
- Multi-modal AI ("speak the circuit")
- Schematic A/B variant comparison
- Auto-fault-injection (Socratic teaching)

---

