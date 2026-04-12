---
description: "When daisy-chaining 74HC595 shift registers, QH' of chip N feeds SER of chip N+1 while SRCLK and RCLK run parallel to all chips — you shift N*8 bits total then one latch pulse updates all N*8 outputs simultaneously, still using only 3 MCU pins regardless of chain length"
type: knowledge
topics:
  - "[[passives]]"
source: "[[74hc595-8-bit-shift-register-serial-to-parallel-dip16]]"
---

# Daisy-chained 74HC595s share clock and latch lines so N chips update simultaneously from one latch pulse

The 74HC595 daisy-chain topology:

```
MCU SER ──→ [595 #1 SER → QH'] ──→ [595 #2 SER → QH'] ──→ [595 #3 SER]
MCU SRCLK ──→ All SRCLK pins (parallel)
MCU RCLK  ──→ All RCLK pins (parallel)
```

**Key principles:**

1. **Serial data cascades**: QH' (pin 9) is the serial overflow output. As bits shift through chip #1, they spill into chip #2's SER input.

2. **Clock and latch are shared**: All chips receive the same SRCLK and RCLK signals. This means shifting N*8 bits takes N*8 clock pulses, but the latch update is instantaneous and simultaneous across all chips.

3. **MCU pin count is constant**: Whether you have 1 chip (8 outputs) or 10 chips (80 outputs), you still use exactly 3 GPIO pins.

4. **Propagation delay accumulates**: Each chip adds gate propagation delay (~15ns at 5V). For very long chains (10+), ensure the total propagation doesn't exceed the clock period. At typical MCU bit-bang speeds (1-5 MHz), this is never a practical issue.

5. **Data order matters**: The first byte shifted out ends up in the last chip in the chain. For 3 chips, shift chip_3_data first, then chip_2_data, then chip_1_data.

This is superior to having multiple independent shift registers (which would consume 3 pins each) or I2C expanders (which have address limits and bus capacitance constraints).

---

Topics:
- [[passives]]

Related:
- [[74hc595-trades-3-gpio-pins-for-n-times-8-digital-outputs-via-serial-shift-and-parallel-latch]]
- [[74hc595-latch-separates-data-shifting-from-output-update-preventing-glitches-during-serial-load]]
- [[direct-driving-an-8x8-led-matrix-consumes-16-io-pins-and-locks-the-cpu-to-display-refresh]]
