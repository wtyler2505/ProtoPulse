---
description: "Common cathode displays are active HIGH (segments set HIGH to light), common anode are active LOW -- mixing them with the wrong driver or firmware produces total display failure, not partial output"
type: knowledge-note
source: "docs/parts/4-digit-7-segment-display-hs420561k-common-cathode.md, docs/parts/5161as-single-digit-7-segment-led-display-red-common-cathode.md"
topics:
  - "[[displays]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Common cathode and common anode 7-segment displays are electrically incompatible and swapping them silently breaks firmware

Common cathode displays share a ground pin per digit and light segments by driving them HIGH. Common anode displays share a VCC pin per digit and light segments by driving them LOW. The failure mode when you use the wrong type is total: nothing displays at all, or every segment that should be on is off and vice versa. There is no partial-working state to diagnose from.

**Why this trips up beginners:**
- Part numbers encode the difference but not obviously. The 5161AS is common cathode; the 5161BS is common anode. The only visual difference on the physical part may be a letter.
- The MAX7219 driver IC is common-cathode only (DIG pins sink current). Connecting a common-anode display to a MAX7219 produces zero output with no error indication.
- Firmware written for one polarity (e.g., digit encoding table with `0b00111111` for the digit "0" in common-cathode active-HIGH) must be bitwise-inverted for the other polarity. The lookup table is embedded in compiled firmware, so swapping the display requires re-flashing.

**DRC implication:** If a schematic places a 7-segment display, the polarity (cathode vs anode) must match both the driver IC constraints and the firmware encoding table. A mismatch is a hard error, not a warning.

---

Topics:
- [[displays]]
- [[eda-fundamentals]]
