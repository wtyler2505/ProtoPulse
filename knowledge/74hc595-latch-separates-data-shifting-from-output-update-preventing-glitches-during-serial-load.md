---
description: "The 74HC595 uses a two-stage architecture — a shift register that accepts serial data and a storage register that holds output state — so outputs remain stable while new data is clocked in, only updating simultaneously when RCLK is pulsed"
type: knowledge
topics:
  - "[[passives]]"
source: "[[74hc595-8-bit-shift-register-serial-to-parallel-dip16]]"
---

# 74HC595 latch separates data shifting from output update preventing glitches during serial load

The 74HC595 contains two independent 8-bit registers:

1. **Shift register** (internal, not visible on outputs): Data enters serially via SER, advancing one position per SRCLK pulse
2. **Storage register** (connected to output pins QA-QH): Holds the previous output state until explicitly updated

When RCLK (latch) is pulsed HIGH, the shift register contents are transferred to the storage register and all 8 outputs update simultaneously. During the shifting process, outputs do not change.

This two-stage design prevents the "ripple through" effect where outputs would glitch through intermediate states as bits shift in. Without the latch, driving a 7-segment display would briefly show garbage patterns between updates, causing visible flicker.

The practical consequence: you can shift data at any speed (up to 25 MHz) without worrying about visual artifacts. The latch pulse acts as a synchronization barrier — "commit this frame."

This is architecturally similar to double-buffering in graphics: you write to the back buffer (shift register) while the front buffer (storage register) displays the current frame.

---

Topics:
- [[passives]]

Related:
- [[74hc595-trades-3-gpio-pins-for-n-times-8-digital-outputs-via-serial-shift-and-parallel-latch]]
- [[max7219-is-the-universal-led-display-driver-for-both-matrices-and-7-segments]]
- [[direct-driving-a-4-digit-7-segment-display-consumes-12-gpio-pins-and-requires-constant-software-multiplexing]]
