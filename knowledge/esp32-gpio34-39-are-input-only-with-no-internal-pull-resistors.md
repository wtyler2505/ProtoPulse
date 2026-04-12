---
description: "Six pins (GPIO 34, 35, 36/VP, 39/VN) cannot be used as outputs and have no pull-up or pull-down -- external resistors are mandatory for defined idle state"
type: claim
source: "docs/parts/nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3.md"
confidence: proven
topics:
  - "[[microcontrollers]]"
  - "[[breadboard-intelligence]]"
  - "[[eda-fundamentals]]"
related_components: []
---

# ESP32 GPIO34-39 are input-only with no internal pull resistors

GPIO 34, 35, 36 (VP), and 39 (VN) on the ESP32 are physically different from the other GPIO pins -- they are hardwired as inputs with no output driver and no internal pull-up or pull-down resistors. This means:

1. **No output capability**: `pinMode(34, OUTPUT)` compiles but does nothing. `digitalWrite(34, HIGH)` is silently ignored.
2. **No internal pulls**: `pinMode(34, INPUT_PULLUP)` compiles but has no effect. The pin floats unless an external resistor is added.
3. **External resistors mandatory**: Any digital input on these pins (button, switch, interrupt) requires an external pull-up or pull-down resistor to define the idle state. Without one, the pin picks up noise and reads randomly.

These pins are excellent for analog input (they're all ADC1 channels, so they work even with WiFi active) because pull resistors are rarely needed for analog sensing. GPIO36 and GPIO39 are often labeled VP and VN (Voltage Positive/Negative) because they double as the input pair for the built-in hall effect sensor.

**Common beginner mistake:** Connecting a button to GPIO34 with `INPUT_PULLUP` and wondering why it reads randomly. On an Arduino Uno, `INPUT_PULLUP` enables the internal 20-50k pull-up. On ESP32 GPIO34-39, it does nothing -- you must add an external 10k resistor.

---

Relevant Notes:
- [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] -- GPIO34-39 are excluded from the "safe" list because of the input-only limitation
- [[esp32-adc2-unavailable-when-wifi-active]] -- GPIO34-39 are ADC1 channels and remain usable with WiFi, which partially compensates for the output limitation
- [[esp32-six-flash-gpios-must-never-be-used]] -- a stricter restriction on a different set of pins

Topics:
- [[microcontrollers]]
- [[breadboard-intelligence]]
- [[eda-fundamentals]]
