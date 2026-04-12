---
description: "Each RGB color channel has a different Vf (red ~2.0V, green ~3.0V, blue ~3.0V) requiring different resistor values per channel, and color mixing needs PWM on all three pins simultaneously -- consuming 3 PWM pins and up to 60mA"
type: knowledge-note
source: "docs/parts/5mm-led-assortment-through-hole-red-green-blue-yellow-white-rgb.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# RGB common-cathode LEDs need three independent resistors and three PWM pins for color mixing

An RGB LED is three LEDs in one package, sharing a common cathode (or anode). Each color channel has a different forward voltage:

| Channel | Vf | Resistor at 5V / 20mA |
|---------|----|-----------------------|
| Red | ~2.0V | 150 ohm |
| Green | ~3.0V | 100 ohm |
| Blue | ~3.0V | 100 ohm |

This means:
1. **Three separate resistors** are required -- one per channel, each calculated from that channel's Vf. A single shared resistor would produce unequal brightness across channels (red would be brightest, green/blue dimmest).
2. **Three PWM-capable GPIO pins** are consumed for color mixing via `analogWrite()`. This is significant resource consumption:
   - Arduino Uno: 3 of 6 PWM pins (50% of PWM budget)
   - Pi Pico: 3 pins at 12mA each = 36mA minimum, 72% of the 50mA total GPIO budget
   - ESP32: 3 LEDC channels (generous budget, but ESP32 uses `ledcWrite()` not `analogWrite()`)
3. **Peak current at white** (all channels full) is 60mA -- exceeding the Uno's 20mA per-pin limit if driven directly (each pin is fine individually, but the GND return path carries the sum).

**Common-cathode vs common-anode:** Common-cathode (CC) connects the shared pin to GND and drives channels HIGH. Common-anode (CA) connects the shared pin to VCC and drives channels LOW (inverted PWM logic: 255 = off, 0 = full brightness). The resistor values are the same, but the firmware is inverted. Mixing up CC and CA produces inverted colors -- white becomes black, and vice versa.

**DRC implication:** Adding an RGB LED should check PWM pin availability and warn about pin budget impact. If the MCU is an ESP32, remind that `analogWrite()` does not exist and `ledcWrite()` / `ledcAttach()` must be used instead.

---

Relevant Notes:
- [[uno-20ma-per-pin-200ma-total-means-no-direct-led-or-motor-drive]] -- RGB at 20mA x 3 = 60mA total for one LED
- [[pico-12ma-per-pin-50ma-total-is-strictest-gpio-budget-among-maker-mcus]] -- Pico's 50mA total makes RGB LEDs a significant fraction of budget
- [[esp32-replaces-tone-with-ledcwritetone-and-the-api-is-not-a-drop-in-substitution]] -- ESP32 PWM API difference affects RGB code portability
- [[esp8266-pwm-is-software-implemented-at-1khz-unsuitable-for-servo-control]] -- ESP8266 software PWM flicker affects RGB dimming quality

Topics:
- [[passives]]
- [[eda-fundamentals]]
