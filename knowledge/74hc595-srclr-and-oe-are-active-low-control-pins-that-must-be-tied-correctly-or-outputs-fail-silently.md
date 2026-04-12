---
description: "SRCLR (pin 10) and OE (pin 13) on the 74HC595 are both active-LOW — SRCLR must be tied HIGH for normal operation (LOW clears register) and OE must be tied LOW for outputs to work (HIGH disables them) — leaving either floating causes confusing silent failures"
type: knowledge
topics:
  - "[[passives]]"
source: "[[74hc595-8-bit-shift-register-serial-to-parallel-dip16]]"
---

# 74HC595 SRCLR and OE are active-LOW control pins that must be tied correctly or outputs fail silently

Two control pins on the 74HC595 that catch beginners:

**SRCLR (pin 10) — Shift Register Clear:**
- Active LOW: pulling this pin LOW clears all bits in the shift register to zero
- Normal operation: tie to VCC (HIGH) so the register is never cleared
- If left floating: CMOS input may drift LOW, randomly clearing your data
- Symptom: outputs intermittently go to all zeros with no software cause

**OE (pin 13) — Output Enable:**
- Active LOW: pulling this pin LOW enables the output drivers
- Normal operation: tie to GND (LOW) for always-on outputs
- If left floating: CMOS input may drift HIGH, disabling all outputs
- Symptom: shift register loads data correctly (you can verify via QH') but output pins stay high-impedance

Both pins are in the same failure class as boot-mode pins on ESP8266/ESP32: active-low configuration pins that produce silent, confusing failures when not explicitly driven. The fix is always to tie them to their "normal operation" rail with a direct connection (not through a resistor — these are not pull-ups, they're hard connections).

---

Topics:
- [[passives]]

Related:
- [[74hc595-oe-pin-on-pwm-enables-hardware-brightness-control-of-all-outputs-simultaneously]]
- [[74hc595-trades-3-gpio-pins-for-n-times-8-digital-outputs-via-serial-shift-and-parallel-latch]]
- [[esp8266-boot-pins-gpio0-gpio2-and-gpio15-must-be-in-specific-states-at-power-on]]
- [[floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot]]
