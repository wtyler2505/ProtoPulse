---
description: "4-digit multiplexed 7-segment LED display — common cathode, needs a driver (MAX7219 or TM1637) or manual multiplexing with 12 pins"
topics: ["[[displays]]"]
status: needs-test
quantity: 1
voltage: [5]
interfaces: [Digital]
logic_level: "5V"
manufacturer: "Generic"
part_number: "HS420561K-32"
pinout: |
  12-pin package (top, L-R): 1  A  F  2  3  B
  12-pin package (bot, L-R): E  D  DP C  G  4
  Digits: 1, 2, 3, 4 (common cathode per digit)
  Segments: A-G + DP (shared across all digits)
compatible_with: ["[[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]"]
used_in: []
warnings: ["Common cathode — will NOT work with common-anode driver circuits", "Without a driver IC, needs 12 pins and software multiplexing — use a MAX7219 or TM1637 instead", "Current limiting resistors required on each segment line (220-330 ohm)"]
datasheet_url: ""
---

# 4-Digit 7-Segment Display HS420561K — Common Cathode

A 4-digit multiplexed 7-segment LED display. Each digit shares the same segment lines (A-G + DP) but has its own common cathode pin. To show different numbers on each digit, you rapidly cycle through the digits, turning one on at a time (multiplexing). At >100Hz refresh, persistence of vision makes them look steady.

Driving this directly eats 12 I/O pins and requires constant multiplexing in your code. Much better to use a MAX7219 driver (already in inventory) which handles the multiplexing in hardware and only needs 3 SPI pins.

## Specifications

| Spec | Value |
|------|-------|
| Digits | 4 |
| Segments | 7 + decimal point per digit |
| Type | Common cathode |
| Color | Red |
| Forward Voltage | ~2V per segment |
| Max Segment Current | 20mA |
| Pin Count | 12 |

## Wiring with MAX7219 Driver

The MAX7219 handles all multiplexing. Connect segment lines to SEG A-G/DP, digit commons to DIG 0-3. See [[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]] for full wiring.

---

Related Parts:
- [[max7219-spi-led-driver-controls-8-digits-or-8x8-matrix-with-3-pins]] — the driver IC to use with this display; handles multiplexing in hardware, only 3 SPI pins
- [[5161as-single-digit-7-segment-led-display-red-common-cathode]] — single-digit version
- [[74hc595-8-bit-shift-register-serial-to-parallel-dip16]] — alternative driver approach: chain two 595s for manual multiplexing with 3 GPIO pins, but you handle timing in software
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — 5V compatible host board (use MAX7219 driver to save pins)
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — 5V compatible host board with pins to spare
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — Mega clone, same compatibility
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — 5V compatible, use MAX7219 to conserve limited pins

Categories:
- [[displays]]
