---
name: E2E walkthrough — PCB — meticulous
description: Frontend E2E findings for 'PCB — meticulous' chunk from 2026-04-18 walkthrough. 9 E2E IDs; 2 🔴, 4 🟡, 1 🟢, 2 ✅.
captured_date: 2026-04-18
parent_source: 2026-04-18-frontend-e2e-walkthrough
extraction_status: pending
triage_status: pending
severity_counts:
  p1_bug: 2
  ux: 4
  idea: 1
  works: 2
  e2e_ids: 9
source_type: e2e-walkthrough
topics:
  - protopulse-frontend
  - e2e-audit
---

## PCB — meticulous

URL `/projects/30/pcb`. Tools (each with hotkey label): Select(1), Trace(2), Delete(3), Via(4), Pour(P), Keepout(K), Keepin (no hotkey), Cutout(X), Diff Pair(D), Comment(C). Layer: "Active layer: Front Copper. Click to toggle." (toggle hotkey F). Trace width slider 0.5-8 (current 2.0mm) + presets 0.15/0.25/0.5/1/2. Zoom in/out/reset. Board width/height spinbuttons (10-500mm, current 50x40). View in 3D button. Layer Stack panel: Top 1oz 1.4mil / Core FR4 59.2mil / Bottom 1oz 1.4mil = Total 62 mil. Surface: HASL. Layer presets 2/4/6/8/10/16/32-layer with descriptive aria-descriptions. Empty PCB Board with helpful hint about Trace tool + F to toggle layers.

- **E2E-226 ✅ EXCELLENT** — PCB tool buttons all have hotkeys in label + aria-description. Layer preset buttons have informative aria-descriptions (e.g. "8-layer: Sig-Gnd-Sig-Pwr-Pwr-Sig-Gnd-Sig"). Industry-quality EDA UX.
- **E2E-227 🟡 UX** — `Keepin` button has NO hotkey label (others do). Inconsistent. Either give it K2 or document why.
- **E2E-228 🔴 BUG (board size mismatch)** — PCB tab shows board 50×40 mm. 3D View tab default board 100×80 mm. **Two different defaults for same project's board.**
- **E2E-229 🟡 UX** — Trace width slider default 2.0mm — that's a chunky power trace, not a signal default. Better default: 0.25mm for signal.
- **E2E-230 🟢 IDEA** — Layer Stack panel shows Top/Core/Bottom — but doesn't list dielectric thickness for inner layers when 4+ layers selected. Verify when changing preset.
- **E2E-231 🟡 UX** — `Active layer: Front Copper. Click to toggle.` aria-label is verbose; visible text just says "F.Cu (Front)". Aria differs from visible. OK if they convey same meaning, but redundancy potential.

### PCB remaining buttons (catalogued)

10 tool buttons + layer toggle + 5 trace presets + 7 layer presets (2/4/6/8/10/16/32) + zoom×3 + width spinbutton + height spinbutton + "View in 3D" + Layer Stack collapse + 1 Design Suggestions.

### Baby step: click 4-layer preset

Layer stack updated to: Top (Signal) / Prepreg 1 / Inner 1 (Ground) / Core / Inner 2 (Power) / Prepreg 2 / Bottom (Signal). Total 61.6 mil. **Stack updates correctly.**

- **E2E-232 ✅ WORKS** — 4-layer preset properly applies signal-ground-power-signal stackup with descriptive layer roles.
- **E2E-233 🔴 BUG** — After switching to 4-layer, the right-side "Layers" visibility panel **still shows only F.Cu / B.Cu / Board Outline**. The 2 new inner layers (Ground, Power) are not toggleable. User can't visualize/hide internal layers.
- **E2E-234 🟡 UX** — `Top (Signal)` in stack panel — should match the visibility panel's `F.Cu (Front Copper)` naming. Two terminologies for same thing within one tab.

---

