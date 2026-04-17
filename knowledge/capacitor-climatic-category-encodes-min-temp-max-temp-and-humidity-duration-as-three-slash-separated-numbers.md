---
description: "The three-number climatic category code on a capacitor (e.g. 40/100/21) encodes minimum temperature, maximum temperature, and damp-heat test duration in days — a part-identification rule you need to read spec sheets correctly"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[passives]]"
---

# Capacitor climatic category encodes min-temp, max-temp, and humidity duration as three slash-separated numbers

The IEC 60068-1 climatic category mark "40/100/21" decodes as:
- **40** — minimum operating temperature in °C (negative sign implied) → -40°C
- **100** — maximum operating temperature in °C → +100°C
- **21** — damp-heat test duration in days → 21 days at 93% RH, 40°C

This is a part-identification rule family — same role as three-digit ceramic codes and electrolytic voltage/capacitance encoding. If you see three slash-separated numbers on a cap, they are almost always climatic category, not a voltage or capacitance value.

Typical codes:
- **25/085/21** — consumer electronics grade
- **40/085/21** — standard industrial
- **40/100/21** — automotive / harsh industrial
- **55/125/56** — military / extreme

The damp-heat duration matters for humid-environment applications (outdoor, marine, greenhouse). A 21-day spec is the common commercial grade; 56 days is the severe grade.

---

Source: docs_and_data

Relevant Notes:
- [[three-digit-ceramic-capacitor-codes-encode-picofarads-as-two-significant-digits-times-a-power-of-ten-multiplier]] — same genre of part-identification rule
- [[electrolytic-capacitor-part-numbers-encode-voltage-series-capacitance-tolerance-in-sequential-segments]] — same genre

Topics:
- [[passives]]
