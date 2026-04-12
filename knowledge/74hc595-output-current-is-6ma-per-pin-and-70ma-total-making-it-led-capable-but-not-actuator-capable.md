---
description: "Each 74HC595 output can source or sink approximately 6mA at 5V, with a total package limit of 70mA — sufficient for LEDs with current-limiting resistors but insufficient for motors, relays, or solenoids which require an external driver stage (ULN2003 or MOSFET)"
type: knowledge
topics:
  - "[[passives]]"
source: "[[74hc595-8-bit-shift-register-serial-to-parallel-dip16]]"
---

# 74HC595 output current is 6mA per pin and 70mA total making it LED-capable but not actuator-capable

The 74HC595's output drivers are CMOS push-pull with limited current capacity:

- **Per-pin**: ~6mA source or sink at 5V VCC
- **Total IC**: 70mA maximum (all pins combined)

This creates a hard budget constraint: if driving 8 LEDs simultaneously, each must stay under ~8mA (70mA / 8 = 8.75mA). A 330-ohm resistor at 5V with a red LED (2V Vf) gives (5 - 2) / 330 = ~9mA — right at the limit. Consider 470-ohm or 560-ohm for 8-LED arrays.

The architectural boundary is clear:
- **LED indicators, 7-segment displays**: Direct drive is fine with proper resistors
- **Motors, relays, solenoids, high-power LEDs**: Must use an intermediate driver (ULN2003 Darlington array, individual MOSFETs, or BJTs)

This is distinct from MCU GPIO limits (which vary by platform). The 74HC595 has its own independent current budget regardless of what's driving it.

---

Topics:
- [[passives]]

Related:
- [[74hc595-trades-3-gpio-pins-for-n-times-8-digital-outputs-via-serial-shift-and-parallel-latch]]
- [[330-ohm-resistor-is-the-safe-universal-default-for-any-led-color-at-5v]]
- [[bjt-switching-tops-out-at-600ma-in-to-92-and-the-transition-to-mosfet-is-a-hard-architecture-boundary]]
- [[pico-12ma-per-pin-50ma-total-is-strictest-gpio-budget-among-maker-mcus]]
