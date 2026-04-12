---
description: "Matrix membrane keypad — row/column scanning over GPIO, supports 4x3 or 4x4 layouts, thin flexible overlay for panel mounting"
topics: ["[[input-devices]]"]
status: needs-test
quantity: 2
voltage: [3.3, 5]
interfaces: [GPIO]
logic_level: "mixed"
logic_notes: "Passive switch matrix with no active logic. Row and column voltages simply follow the MCU pull-ups and scan voltage you apply."
manufacturer: "Generic"
part_number: "MEM-SW"
pinout: |
  7 or 8 pins depending on 4x3 or 4x4 layout
  4x4: R1 R2 R3 R4 C1 C2 C3 C4 (8 pins)
  4x3: R1 R2 R3 R4 C1 C2 C3 (7 pins)
  Rows → OUTPUT (scan one row LOW at a time)
  Columns → INPUT_PULLUP (read which column goes LOW)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
used_in: []
warnings: ["Uses 7-8 GPIO pins — consider I2C I/O expander (PCF8574) for pin-constrained projects", "Membrane keys wear out with heavy use — not for high-cycle applications", "No debouncing built in — use Keypad library which handles debounce in software"]
datasheet_url: ""
---

# Membrane Switch Keypad Module — Tactile Button Array

A thin, flexible matrix keypad for numeric or menu input. Uses row/column scanning — set one row LOW, read columns to detect which key in that row is pressed. The Arduino `Keypad` library handles the scanning and debouncing automatically.

## Specifications

| Spec | Value |
|------|-------|
| Layout | 4x3 (12 keys) or 4x4 (16 keys) |
| Keys | 0-9, *, # (4x3) or 0-9, A-D, *, # (4x4) |
| Interface | Matrix scanning (GPIO) |
| Pin Count | 7 (4x3) or 8 (4x4) |
| Operating Voltage | 3.3-5V (passive — no power needed) |
| Mounting | Self-adhesive backing |

## Wiring (4x4 example)

| Keypad Pin | Arduino | Function |
|-----------|---------|----------|
| 1-4 | D9-D6 | Rows |
| 5-8 | D5-D2 | Columns |

**Library:** `Keypad` by Mark Stanley

```cpp
#include <Keypad.h>
char keys[4][4] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[4] = {9, 8, 7, 6};
byte colPins[4] = {5, 4, 3, 2};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, 4, 4);
```

---

Related Parts:
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via 7-8 digital GPIO pins, passive matrix scanning works at any voltage
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via digital GPIO, plenty of pins (54 I/O) for 4x4 keypad + other peripherals
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via digital GPIO, but 4x4 keypad uses 8 of 22 I/O pins
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via digital GPIO, plenty of pins
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible via digital GPIO at 3.3V, passive switch matrix works fine
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible but pin-constrained (11 GPIO total, 4x4 keypad needs 8) — consider I2C I/O expander (PCF8574)
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] — compatible via digital GPIO at 3.3V, plenty of pins
- [[analog-joystick-module-xy-axes-plus-pushbutton]] — complementary input (joystick for navigation, keypad for data entry)
- [[ky-040-rotary-encoder-module-incremental-with-pushbutton]] — complementary input (encoder for scrolling/selection, keypad for data entry)

Categories:
- [[input-devices]]
