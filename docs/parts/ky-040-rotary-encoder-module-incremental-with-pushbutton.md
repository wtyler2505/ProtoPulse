---
description: "Incremental rotary encoder with pushbutton — 20 detents per revolution, A/B quadrature output for direction detection, built-in 10K pull-ups"
topics: ["[[input-devices]]"]
status: needs-test
quantity: 2
voltage: [3.3, 5]
interfaces: [GPIO]
logic_level: "3.3V/5V"
manufacturer: "Generic"
part_number: "KY-040"
pinout: |
  CLK → Channel A (digital pin, interrupt-capable preferred)
  DT  → Channel B (digital pin)
  SW  → Pushbutton (active-LOW, 10K pull-up onboard)
  +   → VCC (3.3-5V)
  GND → GND
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
used_in: []
warnings: ["Mechanical encoder — generates contact bounce. Use interrupts + debounce (2-5ms) or a dedicated encoder library", "CLK should be on an interrupt-capable pin for reliable counting at speed", "Not an absolute encoder — only detects relative rotation (no position memory across power cycles)"]
datasheet_url: "https://playground.arduino.cc/Main/RotaryEncoders/"
---

# KY-040 Rotary Encoder Module — Incremental with Pushbutton

A mechanical rotary encoder with 20 detent positions per revolution. Outputs two square waves (A and B) in quadrature — the phase relationship tells you which direction the knob is turning. Press the shaft for a built-in pushbutton. Perfect for menu navigation (scroll + select), volume control, or position input.

Not a potentiometer — there's no analog voltage output. This is a digital device that generates pulses.

## Specifications

| Spec | Value |
|------|-------|
| Type | Incremental mechanical encoder |
| Detents | 20 per revolution |
| Pulses | 20 per revolution |
| Output | A/B quadrature (digital) |
| Button | Momentary pushbutton (active-LOW) |
| Pull-ups | 10K onboard on CLK, DT, SW |
| Operating Voltage | 3.3-5V |
| Pin Count | 5 |

## Wiring

| KY-040 | Arduino |
|--------|---------|
| CLK | D2 (interrupt pin) |
| DT | D3 |
| SW | D4 |
| + | 5V |
| GND | GND |

**Library:** `Encoder` by Paul Stoffregen (uses interrupts for reliable counting)

```cpp
#include <Encoder.h>
Encoder enc(2, 3); // CLK, DT on interrupt-capable pins
long position = enc.read();
```

---

Related Parts:
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via digital GPIO at 5V, use interrupt-capable pins (D2, D3) for CLK
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via digital GPIO at 5V, 6 interrupt pins available
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via digital GPIO at 5V, use interrupt-capable pins (D2, D3) for CLK
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via digital GPIO at 5V, 6 interrupt pins available
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible via digital GPIO at 3.3V, all GPIO pins support interrupts
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible via digital GPIO at 3.3V, all GPIO pins support interrupts (except GPIO16)
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] — compatible via digital GPIO at 3.3V, all GPIO pins support interrupts
- [[analog-joystick-module-xy-axes-plus-pushbutton]] — alternative input (proportional analog vs incremental digital)
- [[membrane-switch-keypad-module-tactile-button-array]] — complementary input (keypad for data entry, encoder for scrolling/selection)

Categories:
- [[input-devices]]
