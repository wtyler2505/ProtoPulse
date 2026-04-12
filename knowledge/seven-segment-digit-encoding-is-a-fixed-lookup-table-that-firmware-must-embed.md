---
description: "Mapping digits 0-9 to 7-segment patterns requires a hardcoded 10-entry byte array in firmware -- there is no formula from digit value to segment pattern, and the bit order depends on wiring"
type: knowledge-note
source: "docs/parts/5161as-single-digit-7-segment-led-display-red-common-cathode.md"
topics:
  - "[[displays]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Seven-segment digit encoding is a fixed lookup table that firmware must embed

Every 7-segment display project needs a lookup table that maps digit values (0-9) to segment patterns. There is no mathematical formula that converts a digit to its segment pattern -- the mapping is purely visual (which bars form a recognizable numeral).

**Standard encoding (common cathode, active HIGH):**
- Bit order convention: DP-G-F-E-D-C-B-A (MSB to LSB)
- `0` = `0b00111111` (A,B,C,D,E,F on, G off)
- `1` = `0b00000110` (B,C on)
- `8` = `0b01111111` (all segments on)
- `9` = `0b01101111` (all except E)

**Why this is a gotcha:**
- The bit order (which bit maps to which segment) depends on how the segments are wired to GPIO pins or to the driver IC. Swapping two segment wires requires changing the lookup table, not the wiring.
- Common anode displays require bitwise-inverting the entire table.
- The MAX7219 has a built-in BCD decoder that eliminates this table for digits 0-9, but only supports a limited character set (0-9, H, E, L, P, -, blank). Custom characters require raw segment addressing, which brings the lookup table back.

---

Topics:
- [[displays]]
- [[eda-fundamentals]]
