---
description: "Dual-axis analog joystick with pushbutton — two potentiometers (X/Y) output 0-1023 on analog pins, center press is digital input"
topics: ["[[input-devices]]"]
status: needs-test
quantity: 2
voltage: [3.3, 5]
interfaces: [Analog, GPIO]
logic_level: "mixed"
logic_notes: "Passive potentiometer outputs and switch contacts follow whatever VCC you supply. Run it at 3.3V for 3.3V MCUs or 5V for 5V ADC ranges."
manufacturer: "Generic"
part_number: "KY-023"
pinout: |
  GND → GND
  +5V → VCC (3.3 or 5V)
  VRx → Analog pin (X axis)
  VRy → Analog pin (Y axis)
  SW  → Digital pin (pushbutton, active-LOW with pull-up)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]"]
used_in: []
warnings: ["SW pin needs INPUT_PULLUP — no onboard pull-up on most modules", "Center position reads ~512 but varies — calibrate in software", "At 3.3V VCC, analog range scales proportionally (0-675 instead of 0-1023 on 5V ADC)"]
datasheet_url: ""
---

# Analog Joystick Module — XY Axes + Pushbutton

Also sold as the **KY-023** module. Two potentiometers on a spring-return self-centering gimbal — push the stick and get analog X/Y readings (0-1023 on a 10-bit ADC). Press down on the stick for a digital button. The standard input device for pan/tilt control, menu navigation, or simple game controllers. The spring mechanism returns the stick to center when released, with the center position reading approximately 512 on each axis (calibrate in software — it varies per unit).

## Specifications

| Spec | Value |
|------|-------|
| Axes | 2 (X, Y) — analog potentiometers |
| Button | 1 (center press) — active-LOW |
| Output Range | 0-1023 (at 5V with 10-bit ADC) |
| Center Position | ~512 (varies per unit) |
| Operating Voltage | 3.3-5V |
| Pin Count | 5 |

## Wiring

| Joystick | Arduino |
|----------|---------|
| GND | GND |
| +5V | 5V |
| VRx | A0 |
| VRy | A1 |
| SW | D2 (use INPUT_PULLUP) |

```cpp
pinMode(2, INPUT_PULLUP);
int x = analogRead(A0);
int y = analogRead(A1);
bool pressed = !digitalRead(2);
```

---

Related Parts:
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via analog inputs (A0-A5) + digital GPIO at 5V, direct connection
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via analog inputs (A0-A15) + digital GPIO at 5V, direct connection
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via analog inputs (A0-A7) + digital GPIO at 5V, direct connection
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via analog inputs + digital GPIO at 5V, direct connection
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible at 3.3V with ADC attenuation. Analog range scales to 0-675 instead of 0-1023. Use ADC1 pins to avoid WiFi conflict on ADC2
- [[ky-040-rotary-encoder-module-incremental-with-pushbutton]] — alternative input device (digital incremental vs analog proportional)
- [[membrane-switch-keypad-module-tactile-button-array]] — complementary input (keypad for data entry, joystick for navigation)

Categories:
- [[input-devices]]
