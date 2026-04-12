---
description: "IR obstacle avoidance sensor — emitter+detector pair with adjustable range pot, outputs digital HIGH/LOW when object detected, 3.3V or 5V"
topics: ["[[sensors]]", "[[communication]]"]
status: needs-test
quantity: 2
voltage: [3.3, 5]
interfaces: [GPIO]
logic_level: "3.3V/5V"
manufacturer: "OSEPP"
part_number: "OSEPP-IRD-01"
pinout: |
  G → GND
  V → VCC (3.3-5V)
  S → Signal out (digital — LOW when obstacle detected)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]"]
used_in: []
warnings: ["Output is typically active-LOW — reads LOW when obstacle IS detected", "Detection range varies with surface reflectivity — dark/black surfaces may not be detected", "Sunlight and other strong IR sources can cause false triggers"]
datasheet_url: ""
---

# OSEPP IR Detector IRD-01 — Obstacle Avoidance IR Sensor

An IR emitter+detector pair on a single board for short-range obstacle detection. The onboard potentiometer adjusts detection distance (typically 2-30cm). Outputs a digital signal — LOW when an object is in range, HIGH when clear. Used in line-following robots, obstacle avoidance, and edge detection.

Not the same as an IR receiver for remote control signals — this is a proximity/obstacle sensor.

## Specifications

| Spec | Value |
|------|-------|
| Type | Reflective IR proximity |
| Detection Range | ~2-30cm (adjustable via pot) |
| Output | Digital (active-LOW) |
| Operating Voltage | 3.3-5V |
| Connector | 3-pin (G/V/S) |

## Wiring

| IRD-01 | Arduino |
|--------|---------|
| S | Any digital pin |
| V | 5V |
| G | GND |

```cpp
if (digitalRead(sensorPin) == LOW) {
  // Obstacle detected
}
```

---

Related Parts:
- [[osepp-ir-transmitter-irf01-38khz-led-module]] — different purpose: this is proximity detection, that is communication

Categories:
- [[sensors]]
- [[communication]]
