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

**Wire gauge reference — making the ampacity row concrete:**

The hierarchy is abstract until you can look up a specific circuit and know what gauge to use. For a 36V rover with 4x 16A BLDC controllers, the system decomposes into seven wire classes:

| Circuit | Voltage | Current (typical) | Minimum gauge | Recommended gauge |
|---------|---------|-------------------|---------------|-------------------|
| Battery positive to bus bar (main bus) | 36V | 60-85A peak | #6 AWG | #4 AWG (headroom + voltage-drop) |
| Bus bar to motor controller V+ | 36V | 15-20A per branch | #14 AWG | #12 AWG |
| Motor controller phase wires (U/V/W) | 36V | 15A continuous | #14 AWG | #12 AWG |
| Battery to LM2596 input (12V buck feed) | 36V | 1-2A | #20 AWG | #18 AWG |
| LM2596 output to ESP32 / logic rail | 5-12V | 0.5-1A | #22 AWG | #20 AWG |
| Signal wires (PWM, Hall, level-shifted) | 3.3-5V | <100mA | #24 AWG | #22 AWG |
| GND bus return | — | sum of all loads | #6 AWG | #4 AWG (match battery positive) |

The ground return matches the battery positive gauge because it carries the same total current, not merely the current of the single largest load. A #4 battery positive paired with a #14 ground would violate the hierarchy at the wire-ampacity row on the return path, which is exactly the failure mode [[star-ground-at-distribution-board-prevents-ground-loops-in-multi-circuit-systems|star-ground topology]] assumes is already avoided.

Motor phase wiring is #14 AWG minimum because [[motor-power-wiring-below-14awg-overheats-at-15a-and-creates-fire-risk-so-gauge-is-chosen-by-steady-state-current-not-voltage|gauge follows steady-state current, not voltage]] — a common beginner mistake is using signal-weight wire for phase connections because "the voltage is the same as the logic rail."

---

Relevant Notes:
- [[slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring]] -- the fuse sizing math
- [[individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system]] -- per-circuit fuse sizing follows same hierarchy at smaller scale
- [[main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement]] -- placement of the main fuse

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
