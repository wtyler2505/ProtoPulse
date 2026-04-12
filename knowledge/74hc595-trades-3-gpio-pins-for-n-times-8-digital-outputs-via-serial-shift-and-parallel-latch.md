---
description: "Three MCU pins (data, clock, latch) produce 8 parallel digital outputs per 74HC595 chip, and daisy-chaining extends this to 16, 24, or 80+ outputs from the same 3 pins — the canonical IO expansion solution when you're running out of GPIO"
type: knowledge
topics:
  - "[[passives]]"
source: "[[74hc595-8-bit-shift-register-serial-to-parallel-dip16]]"
---

# 74HC595 trades 3 GPIO pins for N times 8 digital outputs via serial shift and parallel latch

The 74HC595 is the classic IO expander for digital outputs. It uses a serial-in, parallel-out architecture:

- **SER** (pin 14): Serial data input — one bit per clock pulse
- **SRCLK** (pin 11): Shift register clock — shifts data into the internal register
- **RCLK** (pin 12): Storage register clock / latch — pulses HIGH to update all 8 outputs simultaneously

Three MCU GPIO pins control an arbitrary number of outputs. Daisy-chaining connects QH' (serial out, pin 9) of chip N to SER of chip N+1. For N chips, you shift N*8 bits total, then pulse RCLK once to update all N*8 outputs.

This makes it fundamentally different from I2C GPIO expanders (which use addressed communication and have bus limits). The 74HC595 is simpler, faster (25 MHz clock), and has no address conflicts — but it's output-only and unidirectional.

The typical use case is "I have 14 digital I/O on an Uno and need to drive 8+ LEDs without consuming all my pins." One chip gives you 8 outputs from 3 pins, leaving 11 pins for other functions.

---

Topics:
- [[passives]]

Related:
- [[74hc595-output-current-is-6ma-per-pin-and-70ma-total-making-it-led-capable-but-not-actuator-capable]]
- [[74hc595-latch-separates-data-shifting-from-output-update-preventing-glitches-during-serial-load]]
- [[daisy-chained-74hc595s-share-clock-and-latch-lines-so-n-chips-update-simultaneously-from-one-latch-pulse]]
- [[direct-driving-a-4-digit-7-segment-display-consumes-12-gpio-pins-and-requires-constant-software-multiplexing]]
- [[pico-12ma-per-pin-50ma-total-is-strictest-gpio-budget-among-maker-mcus]]
