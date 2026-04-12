---
description: "The Arrhenius rule for aluminum electrolytics: a cap rated 2000 hours at 105C lasts ~4000 hours at 95C, ~8000 hours at 85C, ~16000 hours at 75C -- placement near heat sources (regulators, power resistors, MOSFETs) is a primary reliability killer"
type: knowledge-note
source: "docs/parts/200mxr470m-electrolytic-capacitor-470uf-200v-radial.md"
topics:
  - "[[passives]]"
  - "[[power-systems]]"
confidence: high
verified: false
---

# Every 10C above rated temperature halves aluminum electrolytic capacitor lifespan

Aluminum electrolytic capacitors fail by electrolyte evaporation through the rubber seal. The evaporation rate follows the Arrhenius equation, which for this application simplifies to the "10-degree rule": every 10 degrees Celsius above the rated temperature halves the useful lifespan.

**Practical lifespan calculation for a 2000-hour / 105C rated cap:**

| Operating Temperature | Lifespan Multiplier | Expected Life |
|----------------------|---------------------|---------------|
| 105C (at limit) | 1x | 2,000 hours (~83 days) |
| 95C | 2x | 4,000 hours (~167 days) |
| 85C | 4x | 8,000 hours (~333 days) |
| 75C | 8x | 16,000 hours (~1.8 years) |
| 65C | 16x | 32,000 hours (~3.7 years) |
| 55C | 32x | 64,000 hours (~7.3 years) |
| 45C | 64x | 128,000 hours (~14.6 years) |

**The rule works in reverse too:** A cap rated 2000 hours at 85C (cheaper, more common) only lasts 500 hours at 105C -- roughly 3 weeks of continuous operation.

**Design implications:**
1. Place electrolytic caps as far as practical from heat sources (linear regulators, power resistors, MOSFETs)
2. Choose 105C-rated caps for any location near heat, even if you expect 85C operation (doubles the safety margin)
3. In enclosed designs, airflow over electrolytic caps matters more than over ICs (the ICs can handle the heat; the caps cannot)
4. The combination of high temperature AND high voltage is worst-case -- both mechanisms accelerate independently

**ProtoPulse DRC implication:** When an electrolytic capacitor is placed adjacent to a heat-dissipating component (linear regulator, power MOSFET), flag it as a lifespan concern and suggest either relocation or a 105C-rated cap.

---

Relevant Notes:
- [[electrolytic-capacitor-voltage-derating-to-80-percent-of-rated-voltage-is-mandatory-for-reliability]] -- Voltage derating is the complementary reliability practice
- [[clone-arduino-voltage-regulators-can-overheat-silently-because-there-is-no-thermal-feedback]] -- The heat source most likely to be adjacent to capacitors on Arduino-based designs

Topics:
- [[passives]]
- [[power-systems]]
