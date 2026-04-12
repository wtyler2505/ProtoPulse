---
description: "10K linear taper rotary potentiometer — variable resistor for analog input, LCD contrast adjustment, or voltage divider circuits"
topics: ["[[passives]]", "[[input-devices]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [Analog]
logic_level: "N/A"
manufacturer: "Generic"
part_number: "B10K"
pinout: |
  Pin 1 → One end of resistive element (connect to GND or VCC)
  Pin 2 → Wiper (output — connect to analog input)
  Pin 3 → Other end of resistive element (connect to VCC or GND)
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]]"]
used_in: []
warnings: ["B-taper is linear — A-taper (logarithmic) is different and used for audio volume", "Rotation range is ~300 degrees — mechanical stops at both ends"]
datasheet_url: ""
---

# Potentiometer 10K Rotary — B10K Linear Taper

A basic 10K ohm variable resistor. Turn the shaft and the wiper moves along the resistive element, varying the resistance between 0 and 10K. Connect it as a voltage divider (VCC-wiper-GND) to get an analog voltage for `analogRead()`. Also used for LCD contrast adjustment (V0 pin on HD44780 displays).

## Specifications

| Spec | Value |
|------|-------|
| Resistance | 10K ohm |
| Taper | B (linear) |
| Rotation | ~300 degrees |
| Power Rating | 0.5W typical |
| Tolerance | +/-20% |
| Mounting | Panel mount (6mm shaft) |

## Wiring as Analog Input

| Pot Pin | Connection |
|---------|------------|
| Pin 1 | GND |
| Pin 2 (wiper) | Analog input (A0) |
| Pin 3 | 5V |

```cpp
int value = analogRead(A0); // 0-1023
```

---

Related Parts:
- [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]] — use as contrast pot on V0 pin

Categories:
- [[passives]]
- [[input-devices]]
