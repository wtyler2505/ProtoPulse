---
description: "Compact Arduino board — same ATmega328P as the Uno but in a breadboard-friendly mini form factor with mini-USB. Best for space-constrained projects and breadboard prototyping"
topics: ["[[microcontrollers]]"]
status: verified
quantity: 1
voltage: [5]
interfaces: [GPIO, I2C, SPI, UART, USB, Analog]
logic_level: "5V"
logic_notes: "5V GPIO. Many 3.3V outputs read as HIGH, but Nano outputs drive 5V and are not safe to connect directly to 3.3V-only inputs."
manufacturer: "Arduino (clone)"
mcu: "ATmega328P"
clock_mhz: 16
flash_kb: 32
sram_kb: 2
eeprom_kb: 1
part_number: "A000005"
dimensions_mm: "45.0 x 18.0 (0.70in x 1.70in)"
weight_g: 7
mounting_holes: "4x 1.78mm (0.07in) diameter"
pin_pitch: "2.54mm (0.100in)"
pinout: |
  Digital Pins: D0(RX), D1(TX), D2, D3(PWM), D4, D5(PWM), D6(PWM),
                D7, D8, D9(PWM), D10(PWM/SS), D11(PWM/MOSI), D12(MISO), D13(SCK/LED)
  Analog Pins:  A0, A1, A2, A3, A4(SDA), A5(SCL), A6, A7 (A6-A7 analog input only)
  Power Pins:   Vin, GND, GND, 5V, 3.3V, RESET
  I2C:          A4(SDA), A5(SCL)
  SPI:          D11(MOSI), D12(MISO), D13(SCK), D10(SS)
  UART:         D0(RX), D1(TX)
  PWM:          D3, D5, D6, D9, D10, D11
  Interrupts:   D2(INT0), D3(INT1)
pwm_pins: [3, 5, 6, 9, 10, 11]
interrupt_pins: [2, 3]
i2c_address: ""
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]"]
used_in: []
warnings: ["A6 and A7 are analog INPUT ONLY — cannot be used as digital pins", "Mini-USB connector is fragile — avoid repeated plugging/unplugging", "Some clones use CH340 USB chip instead of FTDI — may need driver install"]
datasheet_url: "Datasheets/arduino-nano-v3-0--atmega328p-.pdf"
---

# Arduino Nano V3 is a 22-I/O 5V board with ATmega328P and mini-USB

## Specifications

| Spec | Value |
|------|-------|
| MCU | ATmega328P (8-bit AVR RISC) |
| Clock | 16MHz |
| Flash | 32KB (2KB bootloader) |
| SRAM | 2KB |
| EEPROM | 1KB |
| Operating Voltage | 5V |
| Input Voltage | 7-12V (Vin pin) |
| Digital I/O | 14 pins (6 PWM) |
| Analog Inputs | 8 pins (A0-A7, 10-bit ADC) |
| I/O Current | 20mA per pin |
| USB | Mini-USB (CH340 or FTDI) |
| Dimensions | ~45mm x 18mm |
| Form Factor | Breadboard-friendly DIP |

## Pinout

```
        +-----[USB]-----+
    D13 |●              | D12
   3.3V |               | D11 (PWM)
   AREF |               | D10 (PWM/SS)
    A0  |               | D9  (PWM)
    A1  |               | D8
    A2  |               | D7
    A3  |               | D6  (PWM)
    A4  | (SDA)         | D5  (PWM)
    A5  | (SCL)         | D4
    A6  | (analog only) | D3  (PWM/INT1)
    A7  | (analog only) | D2  (INT0)
    5V  |               | GND
   RST  |               | RST
   GND  |               | D0  (RX)
   Vin  |               | D1  (TX)
        +---------------+
```

## Wiring Notes

- **Same pinout as Arduino Uno** — code is directly portable between them
- **A6 and A7** are the two extra analog inputs the Uno doesn't have, but they're analog-only — no digitalRead/digitalWrite
- **I2C** on A4(SDA) and A5(SCL) — same as Uno, shared with analog pins
- **SPI** on D10-D13 — same as Uno
- **Power via Vin** accepts 7-12V, regulated down to 5V on-board
- **3.3V output** from on-board regulator, ~50mA max — enough for a sensor, not enough for an ESP module

## Clone Variant: DCCduino Nano

The inventory contains a DCCduino-branded clone, not an official Arduino Nano. Functionally identical, but with one key difference:

- **USB-serial chip:** CH340G instead of FTDI FT232RL
- **Driver requirement:** Install CH340 drivers on your computer (most modern Linux kernels include them, Windows/Mac may need manual install)
- **Identification:** Board silkscreen says "DCCduino" or "Nano V3.0" with a CH340G chip near the USB connector (small SOP-16 package)
- **Compatibility:** All Arduino Nano code, libraries, and shields work identically. Select "Arduino Nano" in the IDE, set processor to "ATmega328P" or "ATmega328P (Old Bootloader)" if upload fails

If uploads fail with "avrdude: stk500_getsync(): not in sync": try switching the Processor setting between "ATmega328P" and "ATmega328P (Old Bootloader)" — clones often ship with the old bootloader.

## Warnings

- A6/A7 analog input only — cannot be used as digital
- Mini-USB connector is mechanically fragile
- Clone boards (including DCCduino) use CH340 USB-serial chip — install CH340 drivers if your OS doesn't recognize it
- 20mA per pin max, same as Uno — don't drive LEDs or motors directly

---

Related Parts:
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] -- same MCU, larger form factor, more robust USB-B connector
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] -- works great on A4/A5 I2C
- [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]] -- compatible via I2C backpack

Categories:
- [[microcontrollers]]
