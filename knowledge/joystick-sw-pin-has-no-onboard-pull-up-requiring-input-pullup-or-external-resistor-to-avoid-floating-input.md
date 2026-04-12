---
description: "Most KY-023 joystick modules ship without a pull-up resistor on the SW (pushbutton) line — the pin must be configured as INPUT_PULLUP in software or connected to VCC through a 10K resistor, otherwise it floats and reads random state"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[analog-joystick-module-xy-axes-plus-pushbutton]]"
---

# Joystick SW pin has no onboard pull-up requiring INPUT_PULLUP or external resistor to avoid floating input

The joystick's pushbutton is a simple normally-open switch contact between the SW pin and GND. When pressed, SW is pulled to GND. When released, the pin is disconnected — floating.

Without a pull-up (either software `INPUT_PULLUP` or external 10K to VCC):
- The pin voltage drifts unpredictably (CMOS inputs are high-impedance)
- `digitalRead()` returns random 0/1 values
- Symptom: "button randomly triggers" or "button never registers"

The fix is trivial:
```cpp
pinMode(SW_PIN, INPUT_PULLUP);   // Internal ~20-50K pull-up
bool pressed = !digitalRead(SW_PIN);  // Active-LOW: pressed = LOW
```

This is the same class of problem as any bare mechanical switch: no pull-up = floating input = unreliable readings. The joystick module just happens to be one of the most common places beginners encounter it because the module looks like it should "just work" out of the box.

Note: Some premium joystick breakout boards (Adafruit, SparkFun) do include an onboard 10K pull-up. Check the schematic or measure resistance between SW and VCC with a multimeter.

---

Topics:
- [[input-devices]]

Related:
- [[joystick-module-is-two-potentiometers-on-a-spring-return-gimbal-consuming-two-analog-pins-plus-one-digital-pin]]
- [[floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot]]
