---
description: "An 8x8 LED matrix driven directly needs 8 row + 8 column = 16 GPIO pins, and the MCU must continuously scan rows at >100Hz -- making it a learning exercise, not a production approach"
type: knowledge-note
source: "docs/parts/1088as-8x8-red-led-dot-matrix-common-cathode-3mm.md"
topics:
  - "[[displays]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Direct driving an 8x8 LED matrix consumes 16 I/O pins and locks the CPU to display refresh

Direct-driving an 8x8 LED dot matrix (like the 1088AS) is the same multiplexing problem as multi-digit 7-segments, but at a larger scale. Three independent failure modes make it impractical for real projects:

**1. Pin consumption:**
- 8 row anodes + 8 column cathodes = 16 GPIO pins.
- An Arduino Uno has 20 usable pins. 16 for the display leaves 4 for everything else.

**2. CPU burden:**
- Must scan all 8 rows at >100Hz total (>12.5Hz per row, ~1.5ms per row).
- The main loop cannot block for sensor reads, serial communication, or computations without causing visible flicker or ghosting.

**3. Duty cycle dimming:**
- Each row is active 1/8 of the time (12.5% duty cycle).
- Perceived brightness is significantly lower than a continuously-lit LED, even with pulsed current compensation.

**The MAX7219 solution:**
The MAX7219 was designed for exactly this task -- driving 8x8 matrices (or 8 digits of 7-segments) with 3 SPI pins while handling all multiplexing, current limiting, and brightness control in hardware. Direct driving is valuable only as a learning exercise to understand how multiplexing works.

---

Topics:
- [[displays]]
- [[eda-fundamentals]]
