---
description: "A 4-digit multiplexed 7-segment display needs 8 segment lines + 4 digit cathode lines = 12 GPIO pins, plus constant CPU-driven multiplexing code -- making a driver IC (MAX7219 or TM1637) practically mandatory"
type: knowledge-note
source: "docs/parts/4-digit-7-segment-display-hs420561k-common-cathode.md"
topics:
  - "[[displays]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Direct-driving a 4-digit 7-segment display consumes 12 GPIO pins and requires constant software multiplexing

A 4-digit multiplexed 7-segment display (like the HS420561K) shares 8 segment lines (A-G + DP) across all digits and has 4 individual common cathode pins. Driving it directly requires:

- **12 GPIO pins:** 8 for segments + 4 for digit select (cathode switching)
- **Constant CPU attention:** The firmware must cycle through digits at >100Hz, which means the main loop cannot block for sensor reads, serial communication, or other processing without causing visible flicker.
- **Current-limiting resistors:** 8 resistors on the segment lines (220-330 ohm from 5V).

**Why this is impractical:**
- An Arduino Uno has 20 usable I/O pins. 12 for the display leaves 8 for everything else.
- An Arduino Nano has 22 pins -- still 12 consumed by one display.
- The CPU multiplexing burden means `delay()` calls anywhere in the code cause visible display artifacts.

**The alternatives:**
- **MAX7219 (SPI, 3 pins):** Handles all multiplexing in hardware, supports 8 digits, daisy-chainable. The recommended approach.
- **TM1637 (custom 2-wire, 2 pins):** Cheaper, simpler, but limited to 6 digits and no cascading.
- **74HC595 shift registers (3 pins):** Chain two for 16 outputs. Recovers GPIO but timing is still in software -- you trade pin count for CPU burden.

---

Topics:
- [[displays]]
- [[eda-fundamentals]]
