---
description: "Unlike the 3-digit ceramic code (104 = 100nF), electrolytic part numbers use multi-segment alphanumeric encoding: 200MXR470M = 200V voltage + MXR series + 470uF capacitance + M (20% tolerance) -- structurally different and requires manufacturer documentation to decode"
type: knowledge-note
source: "docs/parts/200mxr470m-electrolytic-capacitor-470uf-200v-radial.md"
topics:
  - "[[passives]]"
confidence: medium
verified: false
---

# Electrolytic capacitor part numbers encode voltage-series-capacitance-tolerance in sequential segments

Aluminum electrolytic capacitors use a multi-segment alphanumeric part number system that is structurally different from the 3-digit ceramic capacitor code:

**Example: 200MXR470M (Rubycon)**

| Segment | Value | Meaning |
|---------|-------|---------|
| 200 | 200 | Voltage rating in volts |
| MXR | MXR | Manufacturer series designation |
| 470 | 470 | Capacitance in microfarads |
| M | M | Tolerance code (M = ±20%) |

**Common tolerance codes:**
- M = ±20% (standard for electrolytics)
- K = ±10% (tighter, premium)
- J = ±5% (rare for electrolytics)

**Key differences from ceramic capacitor codes:**
1. The capacitance value is in **microfarads**, not picofarads (no multiplier math needed)
2. The voltage is explicit in the part number, not a separate specification
3. The series designation identifies the manufacturer's product line, which determines ESR, ripple current, lifespan, and temperature rating
4. There is no universal encoding -- each manufacturer (Rubycon, Nichicon, Panasonic, Nippon Chemi-Con) uses different series naming conventions

**Second example: 381383 (Cornell Dubilier)**

CDE uses a different encoding for their 381LX series:

| Segment | Value | Meaning |
|---------|-------|---------|
| 381 | 381 | Product series (381LX high-voltage long-life) |
| 383 | 383 | Catalog entry within series (maps to specific C/V combination) |

Unlike Rubycon's human-readable encoding (voltage-series-capacitance), CDE uses a catalog index system where the trailing digits require a cross-reference lookup to determine the exact capacitance and voltage. This reinforces that **there is no universal electrolytic part number encoding** -- each manufacturer requires its own documentation.

**Practical inventory use:** The part number printed on the sleeve is the most reliable identification. Physical size, lead spacing, and capacitor markings (printed on the sleeve) provide secondary confirmation. Unlike small ceramics, electrolytic caps are always labeled. When only a partial part number is readable, distributor cross-reference tools (Mouser, Digi-Key, Octopart) can often resolve the fragment to a full specification.

---

Relevant Notes:
- [[three-digit-ceramic-capacitor-codes-encode-picofarads-as-two-significant-digits-times-a-power-of-ten-multiplier]] -- The contrasting encoding scheme for ceramic caps
- [[unmarked-small-ceramic-capacitors-are-a-practical-inventory-hazard-requiring-physical-separation-or-labeling]] -- Electrolytics avoid this problem because they are always labeled

Topics:
- [[passives]]
