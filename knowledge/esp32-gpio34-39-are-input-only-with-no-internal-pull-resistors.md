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

**The Positive Case: Ideal First-Choice for Digital Inputs**
Rather than viewing them solely as limited pins, these exact properties make GPIO34-39 the **ideal first-choice allocation** for read-only digital sensors (like Hall effect sensors routed through a level shifter). You should allocate these pins *first* for inputs before consuming scarce bidirectional GPIOs, because:
1. **Input-only matches read-only sensors perfectly**: You cannot accidentally configure them as outputs and cause a short-circuit against an active sensor output.
2. **Upstream drivers negate the missing pull-up**: When driven by an active device (e.g., a TXS0108E level shifter which provides its own 10k/40k pull-ups), the lack of an internal pull-up on the ESP32 side is irrelevant.
3. **No strapping pin conflicts**: Unlike many bidirectional pins, GPIO34-39 are not strapping pins, meaning sensor state during power-on won't crash the ESP32 or alter its boot mode.
4. **ADC1 fallback**: If requirements change, they are ADC1 channels and remain usable for analog reads even while WiFi is active (see [[esp32-adc2-unavailable-when-wifi-active]]).

This complements [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] from the opposite direction: save your "safe 14" for outputs and strict bidirectional needs, and dump your read-only inputs onto 34-39.

**Common beginner mistake:** Connecting a button to GPIO34 with `INPUT_PULLUP` and wondering why it reads randomly. On an Arduino Uno, `INPUT_PULLUP` enables the internal 20-50k pull-up. On ESP32 GPIO34-39, it does nothing -- you must add an external 10k resistor.

**The 5V-feedback voltage-divider combo** (from [[wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover]]): when these pins must accept a 5V pulse signal — like the ZS-X11H SC speed feedback — the correct network is a voltage divider AND a pull-up stacked together:

```
ZS-X11H SC (5V) ──── 10K ──┬── 20K ──── GND    (divider scales 5V → 3.3V)
                            │
                       10K to 3.3V              (pull-up holds clean HIGH when idle)
                            │
                       ESP32 GPIO34/35/36 (input)
```

The divider alone is insufficient because when the SC line is quiet (motor stopped) the ESP32 input floats through the divider's 30K source impedance and picks up noise. The pull-up alone is insufficient because it clamps the 5V source through the internal ESD diodes and can damage the pin. Both together produce the correct behavior: the divider scales the pulse amplitude to 3.3V, and the pull-up holds the quiescent level HIGH between pulses. This is a specific answer to the more general constraint that the input-only pins need external resistors to define idle state — when the signal source is also higher voltage than the pin can tolerate, the resistor network has to solve both problems at once.

---

Enriched from: [[wiring-nodemcu-esp32-to-4x-zs-x11h-for-4wd-rover]]

Relevant Notes:
- [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] -- GPIO34-39 are excluded from the "safe" list because of the input-only limitation
- [[esp32-adc2-unavailable-when-wifi-active]] -- GPIO34-39 are ADC1 channels and remain usable with WiFi, which partially compensates for the output limitation
- [[esp32-six-flash-gpios-must-never-be-used]] -- a stricter restriction on a different set of pins
- [[esp32-4wd-rover-consumes-20-of-34-gpios-for-motor-control-forcing-use-of-strapping-and-input-only-pins]] — why these pins get pressed into service as feedback inputs when the safe pins run out

Topics:
- [[microcontrollers]]
- [[breadboard-intelligence]]
- [[eda-fundamentals]]
