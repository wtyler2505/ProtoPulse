---
description: "A 10S lithium-ion pack's voltage swings from 42V (full) to 30V (cutoff) -- a 12V range where the 'nominal 36V' only exists briefly during discharge, confusing voltage-dependent calculations"
type: claim
source: "docs/parts/hoverboard-10s-lithium-ion-battery-pack-36v-with-bms.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "hoverboard-10s-battery-pack"
---

# 10S lithium-ion pack voltage range spans 30V to 42V and the usable window is narrower than beginners expect

A "36V" lithium-ion battery pack (10 cells in series) is only at 36V for a brief moment during its discharge curve. The actual operating voltage spans a 12V range:

| State | Per Cell | Pack (10S) | What it means |
|-------|----------|------------|---------------|
| Full charge | 4.20V | 42.0V | Maximum -- exceeding this causes thermal runaway |
| Just off charger | 4.10V | 41.0V | Settles here after resting |
| Nominal | 3.70V | 37.0V | Mid-discharge, the "rated" voltage |
| Performance drops | 3.30V | 33.0V | Motor speed noticeably reduced |
| BMS cutoff | 3.00V | 30.0V | BMS disconnects load |
| Damaged | <2.50V | <25.0V | Irreversible capacity loss, unsafe to recharge |

**Why this matters for system design:**
1. **Motor speed varies with voltage.** At 42V the motors run ~17% faster than at 36V nominal, and ~17% slower at 30V. If speed-critical, the MCU needs to read battery voltage and compensate PWM duty cycle.
2. **Voltage regulators must handle the full range.** A buck converter stepping down to 5V must accept 30-42V input -- the LM2596 handles this (4.5-40V input, marginal at 42V; the XL4015 extends to 36V input making it insufficient for a fully charged 10S pack).
3. **Runtime calculations at "36V" are optimistic.** The pack spends most of its discharge time between 37V and 34V. Below 33V the remaining capacity drops off quickly.
4. **Storage voltage matters.** Storing at 42V accelerates electrolyte degradation. Storing at 30V risks overdischarge from self-discharge. The sweet spot is 3.7V/cell (37V pack) -- roughly 40-50% state of charge.

**ProtoPulse implications:** The power analysis tools should model battery voltage as a range, not a single number. BOM power budgets calculated at nominal voltage understate the regulator input range and overstate the motor performance at low battery.

---

Relevant Notes:
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- the high-power tier (6-60V) where this voltage swing lives
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] -- the BMS that enforces the low-voltage cutoff

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
