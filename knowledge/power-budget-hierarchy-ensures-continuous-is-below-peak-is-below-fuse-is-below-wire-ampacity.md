---
description: "A properly designed power system stacks four limits: continuous load < peak load < fuse rating < wire ampacity -- violating any ordering creates either nuisance tripping or unprotected wiring"
type: insight
source: "docs/parts/power-distribution-board-fused-terminal-block-for-36v-system.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
---

# Power budget hierarchy ensures continuous is below peak is below fuse is below wire ampacity

Every power system has four numbers that must be in strict ascending order. Violating the ordering creates specific, predictable failure modes:

```
Continuous load (69A) < Peak load (85A) < Fuse rating (100A) < Wire ampacity (~95A for #4 AWG)
```

**What each number means for the OmniTrek rover:**
- **Continuous load (69A):** 4 motors at sustained full speed (64A) plus electronics (5A). This is what the system draws minute after minute during normal operation.
- **Peak load (85A):** 4 motors at maximum acceleration (80A) plus electronics (5A). Brief surges during startup, hill climbing, or direction changes. Lasts seconds.
- **Fuse rating (100A):** The ANL-100 time-delay fuse. Holds indefinitely at 100A, blows in ~60s at 200A.
- **Wire ampacity (~95A for #4 AWG):** The maximum current the wire can carry without overheating its insulation. Temperature-dependent.

**What happens when the ordering is violated:**
- Fuse < Peak → fuse blows during normal peak operation (nuisance trip)
- Wire < Fuse → fuse doesn't blow before wire overheats (fire hazard)
- Peak < Continuous → math error (continuous can't exceed peak by definition)
- Fuse < Continuous → fuse eventually blows during normal sustained operation

**The derating gap:** Note that the fuse (100A) slightly exceeds the wire ampacity (95A). This is common and acceptable because: (1) wire ampacity has a large thermal time constant (minutes), (2) the slow-blow fuse will trip at sustained overcurrent before the wire reaches damage temperature, and (3) NEC sizing rules account for this gap.

**ProtoPulse implication:** The power budget calculator should enforce this 4-number hierarchy and flag violations. When a user adds a motor to the BOM, the tool should automatically recalculate continuous/peak loads and verify they remain below the fuse and wire ratings.

---

Relevant Notes:
- [[slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring]] -- the fuse sizing math
- [[individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system]] -- per-circuit fuse sizing follows same hierarchy at smaller scale
- [[main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement]] -- placement of the main fuse

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
