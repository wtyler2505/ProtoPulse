---
description: "The MAX17113 and similar 'integrated' PMICs contain the switching topology and control logic but every output rail needs external inductors, capacitors, and Schottky diodes sized per the datasheet -- significantly more BOM and PCB layout effort than 'integrated' implies"
type: knowledge-note
source: "docs/parts/max17113-tft-lcd-pmic-generates-all-supply-rails-for-lcd-panels.md"
topics:
  - "[[power-systems]]"
  - "[[passives]]"
confidence: high
verified: false
---

# Multi-rail PMICs still require external inductors capacitors and diodes per rail and are not standalone solutions

The term "integrated PMIC" is misleading for beginners. What is integrated is the control circuitry -- error amplifiers, oscillators, gate drivers, soft-start logic, and sequencing state machines. What is NOT integrated is the power path: every output rail requires external passive components.

**Typical external BOM per rail on a PMIC like the MAX17113:**

| Component | Purpose | Per Rail |
|-----------|---------|----------|
| Inductor (or flying cap) | Energy storage for switching conversion | 1 |
| Output capacitor(s) | Filtering, ripple reduction | 1-3 |
| Input capacitor | Decoupling, switching current path | 1 |
| Schottky diode (boost rails) | Freewheeling / rectification | 0-1 |
| Feedback resistors | Voltage setting (if adjustable) | 2 |

For a 4-rail PMIC (AVDD, VGH, VGL, VCOM), this means roughly 15-25 external components that must be:
1. **Correctly sized** per the datasheet recommendations (inductor value, capacitor ESR, diode forward voltage)
2. **Correctly placed** on the PCB (short loops for switching nodes, ground planes, thermal pads)
3. **Correctly sourced** (the exact inductor value and saturation current matter for efficiency and stability)

**The gap between perception and reality:** A beginner sees "integrated LCD PMIC" and expects a drop-in solution. The actual PCB design effort for a multi-rail PMIC with its external components is substantial -- comparable to designing discrete regulators, but with the advantage of guaranteed sequencing and a single datasheet governing the design.

**Practical alternative for makers:** Salvaging an intact LCD driver board preserves the PMIC + all external passives + correct PCB layout already working together (see [[salvaged-lcd-driver-boards-are-practical-pmic-sources-for-driving-recovered-tft-panels]]).

---

Relevant Notes:
- [[tft-lcd-panels-require-four-distinct-voltage-rails-serving-different-panel-subsystems]] -- The four rails this PMIC serves
- [[78xx-regulators-require-input-and-output-capacitors-close-to-pins-for-stability]] -- Even simple linear regulators need external passives; multi-rail PMICs multiply this requirement

Topics:
- [[power-systems]]
- [[passives]]
