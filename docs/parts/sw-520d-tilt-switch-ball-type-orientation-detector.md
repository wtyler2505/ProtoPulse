---
description: "Ball-type tilt switch — detects orientation changes by rolling a metal ball onto contacts, dead simple with INPUT_PULLUP, reads LOW when tilted"
topics: ["[[sensors]]", "[[input-devices]]"]
status: needs-test
quantity: 3
voltage: [3.3, 5]
interfaces: [GPIO]
logic_level: "5V"
manufacturer: "Generic"
part_number: "SW-520D"
package: "Cylindrical can, 2 leads"
pinout: |
  Pin 1 → GPIO (with INPUT_PULLUP)
  Pin 2 → GND
  (Non-polarized — either pin works for either connection)
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]"]
used_in: []
warnings: ["Bouncy as hell — debounce in software (20-50ms delay) or you'll get spurious triggers", "Not a precision sensor — detects tilt/orientation change, not angle", "Metal ball can rattle — expect noisy transitions around the tilt threshold", "Mount orientation matters — test which way triggers your desired behavior"]
datasheet_url: ""
---

# SW-520D Tilt Switch — Ball-Type Orientation Detector

A dirt-simple tilt/orientation sensor. A metal ball rolls inside a cylindrical can — when tilted past the threshold angle, the ball touches both contacts and closes the circuit. Wire it to a GPIO with INPUT_PULLUP: it reads HIGH when upright (switch open) and LOW when tilted (switch closed, pulling to GND). No power consumption when upright.

## Specifications

| Spec | Value |
|------|-------|
| Type | Ball-type tilt switch |
| Switching Angle | ~15-45 degrees (varies by unit) |
| Contact Rating | 12V DC, 20mA max |
| Contact Resistance | <1 ohm (closed) |
| Lifecycle | ~100,000 operations |
| Package | Cylindrical metal can, 2 through-hole leads |
| Dimensions | ~6mm diameter x 11mm height |

## Typical Wiring

```
SW-520D pin 1 → Arduino digital pin (configured as INPUT_PULLUP)
SW-520D pin 2 → GND

Code:
  pinMode(TILT_PIN, INPUT_PULLUP);
  if (digitalRead(TILT_PIN) == LOW) {
    // Tilted!
  }
```

## Debouncing

The metal ball bounces when crossing the threshold — you'll get multiple HIGH/LOW transitions from a single tilt event. Always debounce:

```cpp
// Simple software debounce
unsigned long lastTilt = 0;
bool tilted = false;

void loop() {
  bool reading = digitalRead(TILT_PIN) == LOW;
  if (reading != tilted && (millis() - lastTilt > 50)) {
    tilted = reading;
    lastTilt = millis();
    // Act on tilt change here
  }
}
```

## Use Cases

- **Orientation detection** — is the device upright or flipped?
- **Motion alarm** — wake from sleep when the device is moved
- **Tilt-activated LED** — simple interactive project
- **Anti-tamper** — detect when something is picked up

---

Related Parts:
- [[hamlin-59030-reed-switch-magnetic-sensor-dry-contact]] — another simple switch sensor, triggered by magnet instead of gravity
- [[mpu6050-gy521-6dof-imu-accelerometer-gyroscope-i2c-3v3]] — for precise angle measurement instead of binary tilt detection
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — INPUT_PULLUP on any digital pin
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — INPUT_PULLUP on any digital pin

Categories:
- [[sensors]]
- [[input-devices]]
