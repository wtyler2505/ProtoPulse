---
description: "Four BLDC controllers at five signals each (EL, Z/F, CT, STOP, SC) plus ground totals 20 unique GPIOs — more than the 14 unrestricted ESP32 pins — so any 4-motor design MUST spend some pin budget on strapping pins and input-only pins"
type: claim
source: "docs/parts/wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# ESP32 4WD rover consumes 20 of 34 GPIOs for motor control, forcing use of strapping and input-only pins

A ZS-X11H-per-motor 4WD design needs five control signals per controller: EL (PWM speed), Z/F (direction), CT (brake), STOP (enable), and SC (speed feedback). Four motors × 5 signals = 20 GPIOs, with ground shared. The ESP32 has 34 total GPIOs, but [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] — meaning a 4-motor design must claim 6 more pins from the restricted set. There is no way around this arithmetic.

The assignment problem forces choices the designer cannot avoid:

- **20 pins > 14 safe pins** — so the first 14 signals take the safe pins and the remaining 6 spill into strapping or input-only pins.
- **Only 4 input-capable pins are truly free of boot restrictions for interrupts** — the SC feedback inputs want interrupt capability, which makes GPIOs 34, 35, 36, 39 (input-only, see [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]]) the natural home for three or four SC signals.
- **Strapping pins (GPIO 0, 2, 5, 12, 15) become outputs for STOP/CT/Z-F signals** on whichever controller ended up last in the allocation — this is where [[74hc14-schmitt-trigger-buffer-isolates-esp32-strapping-pins-from-external-loads-during-boot]] becomes non-optional.

The structural implication: a 4-motor ESP32 rover is at the upper bound of what a single ESP32 DevKit can drive without peripheral expansion. Adding a 5th motor, or adding any significant additional IO (encoder, display, sensors on I2C, etc.), crosses the boundary from "tight but feasible" to "needs an IO expander or a second MCU." This is not a datasheet limit like current per pin — it is a topology limit imposed by the interaction of pin count, boot constraints, and input-only restrictions.

Therefore if a future ProtoPulse bench-coach flow suggests 4 motors on an ESP32, it must also surface the strapping-pin buffering requirement and the SC voltage-divider-plus-pull-up requirement as mandatory accessories, because the pin budget has already consumed the margin that would normally absorb these as optional.

---

Source: [[wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover]]

Relevant Notes:
- [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] — the numerator that makes 20 pins problematic
- [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]] — where three of the four SC inputs necessarily land
- [[74hc14-schmitt-trigger-buffer-isolates-esp32-strapping-pins-from-external-loads-during-boot]] — the mandatory accessory once strapping pins become outputs
- [[pico-12ma-per-pin-50ma-total-is-strictest-gpio-budget-among-maker-mcus]] — a different dimension of pin scarcity on a different MCU
- [[all-in-one-dev-boards-trade-gpio-freedom-for-integrated-peripheral-convenience]] — general principle behind the pin budget squeeze

Topics:
- [[microcontrollers]]
- [[actuators]]
- [[eda-fundamentals]]
