---
description: "Two matched caps (one per XTAL pin to GND) form a series combination that, plus 5-10pF stray capacitance, must equal the crystal's specified load capacitance -- for a 20pF load spec, two 22pF caps yield ~11pF + ~5-10pF stray = 16-21pF, matching the target"
type: knowledge-note
source: "docs/parts/22pf-ceramic-capacitor-npo-50v-crystal-load-cap.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Crystal load capacitance equals the series combination of two matched caps plus stray capacitance

The standard crystal oscillator circuit uses two capacitors, one from each XTAL pin to ground:

```
XTAL1 ──┤├── GND     (C1)
         XTAL
XTAL2 ──┤├── GND     (C2)
```

The effective load capacitance seen by the crystal is:

```
CL = (C1 × C2) / (C1 + C2) + Cstray
```

For matched caps (C1 = C2 = C):

```
CL = C/2 + Cstray
```

**Typical calculation for a 16MHz HC49 crystal (CL = 20pF spec):**

| Component | Value | Contribution |
|-----------|-------|-------------|
| C1 = C2 | 22pF | C/2 = 11pF |
| Stray capacitance | 5-10pF (PCB traces, IC pin capacitance) | 5-10pF |
| **Total CL** | **16-21pF** | **Matches 20pF spec** |

This is why 22pF is the most common crystal load cap value in maker projects -- it pairs with the most common crystal load specifications (18-22pF). If the crystal specifies a different load (e.g., 12.5pF for some 32.768kHz RTC crystals), the cap values must be recalculated.

**What happens with wrong load capacitance:**
- CL too low: crystal oscillates slightly fast (frequency pulled high), startup may be unreliable
- CL too high: crystal oscillates slightly slow (frequency pulled low), increased power consumption
- CL way off (>30% error): crystal may fail to start oscillation entirely, or oscillate on an overtone

**The stray capacitance variable** is why some designs use 18pF or 20pF caps instead of 22pF -- they are accounting for higher stray capacitance on their specific PCB layout. Breadboards have higher stray capacitance (~10-15pF per node) than PCBs (~3-5pF), which is why crystals often work fine on breadboards with "wrong" cap values.

---

Relevant Notes:
- [[npo-c0g-dielectric-is-mandatory-for-crystal-load-capacitors-because-temperature-driven-capacitance-drift-shifts-oscillator-frequency]] -- The cap dielectric must be stable for this calculation to hold across temperature
- [[unmarked-small-ceramic-capacitors-are-a-practical-inventory-hazard-requiring-physical-separation-or-labeling]] -- Grabbing the wrong cap value silently shifts oscillator frequency

Topics:
- [[passives]]
- [[eda-fundamentals]]
