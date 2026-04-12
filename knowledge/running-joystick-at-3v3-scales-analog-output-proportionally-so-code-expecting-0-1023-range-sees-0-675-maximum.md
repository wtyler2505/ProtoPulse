---
description: "A joystick module powered at 3.3V instead of 5V produces maximum output of 3.3V — on a 5V-referenced 10-bit ADC this reads as ~675 instead of 1023, silently compressing the range and breaking thresholds/deadzones calibrated for 5V operation"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[analog-joystick-module-xy-axes-plus-pushbutton]]"
---

# Running joystick at 3.3V scales analog output proportionally so code expecting 0-1023 range sees 0-675 maximum

The joystick module's potentiometers output a voltage between 0V and VCC. When VCC is 3.3V instead of 5V:

- **Potentiometer max output**: 3.3V (not 5V)
- **On a 5V-referenced ADC**: max reading = (3.3/5.0) * 1023 ≈ 675
- **On a 3.3V-referenced ADC** (e.g., ESP32 native): max reading = 4095 (12-bit) — full range because reference matches supply

The mismatch scenario matters most when:
1. Powering joystick at 3.3V but reading on Arduino's 5V-referenced ADC
2. Using code/libraries written for 5V that hardcode 1023 as maximum
3. Dead zone calculations as percentage of range (20/1023 vs 20/675 is different sensitivity)

**Correct approaches:**
- **Match VCC to ADC reference**: Run joystick at same voltage as ADC reference (most reliable)
- **Remap in software**: `map(x, 0, 675, 0, 1023)` — but this amplifies noise
- **Use ESP32 properly**: Power joystick at 3.3V, read on ESP32's 3.3V-native ADC — full 0-4095 range with no mismatch

The failure mode is subtle: "joystick works but never reaches full deflection in one direction" or "dead zones feel wrong" — because the code's threshold math assumes a range that doesn't exist at the actual operating voltage.

---

Topics:
- [[input-devices]]

Related:
- [[joystick-module-is-two-potentiometers-on-a-spring-return-gimbal-consuming-two-analog-pins-plus-one-digital-pin]]
- [[esp32-adc-attenuation-setting-determines-input-voltage-range]]
- [[joystick-center-position-reads-approximately-512-but-varies-per-unit-requiring-per-unit-software-calibration]]
