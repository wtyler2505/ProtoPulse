---
description: "The 74HC595 OE (output enable) pin, normally tied to GND for always-on, can be driven by a PWM-capable GPIO to dim all 8 outputs simultaneously in hardware — a single PWM pin controls global brightness without per-pin software overhead"
type: knowledge
topics:
  - "[[passives]]"
source: "[[74hc595-8-bit-shift-register-serial-to-parallel-dip16]]"
---

# 74HC595 OE pin on PWM enables hardware brightness control of all outputs simultaneously

Pin 13 (OE, output enable) is active-LOW:
- **LOW** = outputs active (normal operation, usually tied to GND)
- **HIGH** = all outputs tri-stated (high-impedance, effectively off)

By connecting OE to a PWM-capable GPIO instead of hardwiring to GND, you get free hardware brightness control:
- 50% duty cycle PWM on OE = all 8 outputs at 50% perceived brightness
- No software overhead per pin, no additional shift operations needed
- Works regardless of what data is in the shift register

This is distinct from software-based dimming approaches:
- **Per-pin PWM** (e.g., on MCU GPIO): Consumes PWM hardware per output
- **Software multiplexing**: CPU-intensive, susceptible to timing jitter
- **OE PWM**: One PWM channel controls global brightness of an entire 74HC595 (or daisy-chain if OE pins are shared)

The limitation: it's all-or-nothing per chip. You cannot dim individual outputs differently using OE alone — for that you need BAM (bit angle modulation) via rapid data shifting, or a dedicated driver like the MAX7219.

---

Topics:
- [[passives]]

Related:
- [[74hc595-trades-3-gpio-pins-for-n-times-8-digital-outputs-via-serial-shift-and-parallel-latch]]
- [[rgb-common-cathode-leds-need-three-independent-resistors-and-three-pwm-pins-for-color-mixing]]
- [[74hc595-srclr-and-oe-are-active-low-control-pins-that-must-be-tied-correctly-or-outputs-fail-silently]]
