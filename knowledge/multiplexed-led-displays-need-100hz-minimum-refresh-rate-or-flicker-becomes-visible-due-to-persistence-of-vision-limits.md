---
description: "Multi-digit 7-segment and LED matrix displays share segment/row lines and rapidly switch between digits/rows -- the total scan rate must exceed 100Hz or human persistence of vision fails and flicker becomes visible"
type: knowledge-note
source: "docs/parts/4-digit-7-segment-display-hs420561k-common-cathode.md, docs/parts/5161as-single-digit-7-segment-led-display-red-common-cathode.md, docs/parts/1088as-8x8-red-led-dot-matrix-common-cathode-3mm.md"
topics:
  - "[[displays]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# Multiplexed LED displays need 100Hz minimum refresh rate or flicker becomes visible due to persistence of vision limits

Multiplexed LED displays (multi-digit 7-segment and LED dot matrices) work by time-sharing: all digits/rows share the same segment/column lines, and only one digit/row is active at any instant. The controller rapidly cycles through each digit/row, relying on human persistence of vision to perceive a steady image.

**The 100Hz threshold:**
- Total scan rate (all digits/rows combined) must exceed 100Hz.
- For a 4-digit 7-segment display: 100Hz total means ~25Hz per digit. Each digit is on for ~10ms per cycle.
- For an 8x8 matrix: 100Hz total means ~12.5Hz per row. Each row is on for ~1.5ms per cycle.
- Below this threshold, flicker becomes visible, especially in peripheral vision where flicker sensitivity is higher.

**The duty cycle brightness tradeoff:**
- A 4-digit display has 25% duty cycle per digit (each on 1/4 of the time).
- An 8x8 matrix has 12.5% duty cycle per row (each on 1/8 of the time).
- This reduces perceived brightness proportionally. However, pulsed LED current ratings allow 5x the continuous rating (e.g., 100mA peak at 1/10 duty vs 20mA continuous), which partially compensates.
- The MAX7219 driver IC handles all timing internally, guaranteeing flicker-free operation without consuming CPU cycles.

**Why this matters for the bench coach:**
- Any project using software-multiplexed displays must dedicate CPU time to the refresh loop. Delays from sensor reads, serial communication, or other processing cause visible flicker.
- Driver ICs (MAX7219, TM1637) exist specifically to offload this timing-critical task from the MCU.

---

Topics:
- [[displays]]
- [[eda-fundamentals]]
