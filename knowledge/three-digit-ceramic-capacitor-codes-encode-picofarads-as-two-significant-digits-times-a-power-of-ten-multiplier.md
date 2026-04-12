---
description: "The marking '104' means 10 x 10^4 pF = 100,000 pF = 100nF -- the first two digits are significant figures, the third digit is the power-of-ten multiplier applied to the picofarad base unit"
type: knowledge-note
source: "docs/parts/100nf-ceramic-capacitor-104-50v-decoupling-bypass.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: proven
verified: true
---

# Three-digit ceramic capacitor codes encode picofarads as two significant digits times a power-of-ten multiplier

Small ceramic capacitors use a three-digit numeric marking system where the base unit is picofarads (pF):

- **First two digits**: significant figures
- **Third digit**: number of zeros to add (power of 10 multiplier)

| Marking | Calculation | Value | Common Name |
|---------|------------|-------|-------------|
| 104 | 10 x 10^4 pF | 100,000 pF = 100 nF | Decoupling cap |
| 103 | 10 x 10^3 pF | 10,000 pF = 10 nF | Filtering |
| 105 | 10 x 10^5 pF | 1,000,000 pF = 1 uF | Bulk bypass |
| 102 | 10 x 10^2 pF | 1,000 pF = 1 nF | RF filtering |
| 220 | 22 x 10^0 pF | 22 pF | Crystal load |
| 221 | 22 x 10^1 pF | 220 pF | Small signal |
| 471 | 47 x 10^1 pF | 470 pF | Intermediate |

**Unit conversion chain:** pF x 1000 = nF x 1000 = uF x 1000000 = F

**The gotcha for beginners:** "104" looks like it might mean 104 pF (one hundred four picofarads). It does not. It means 10 followed by four zeros in picofarads = 100,000 pF = 100 nF. This misreading is extremely common and leads to ordering or selecting the wrong component by a factor of 1000.

**Two-digit markings** (like "22" on a crystal cap) represent the literal picofarad value -- 22 pF. The three-digit code system only applies when three digits are present.

---

Relevant Notes:
- [[unmarked-small-ceramic-capacitors-are-a-practical-inventory-hazard-requiring-physical-separation-or-labeling]] -- Even with the code system, many small caps are unmarked
- [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]] -- 104 is the marking on the most commonly used cap in electronics

Topics:
- [[passives]]
- [[eda-fundamentals]]
