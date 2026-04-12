---
description: "The workhorse text display for Arduino — 16 chars x 2 lines, HD44780 controller, use I2C backpack adapter to reduce pin count from 16 to 4"
topics: ["[[displays]]"]
status: needs-test
quantity: 2
voltage: [5]
interfaces: [Parallel, I2C]
logic_level: "5V"
manufacturer: "Generic"
pinout: |
  VSS → GND
  VDD → 5V
  V0  → Contrast (potentiometer wiper)
  RS  → Register select (digital pin)
  RW  → Read/Write (usually GND for write-only)
  E   → Enable (digital pin)
  D4-D7 → Data pins (4-bit mode)
  A   → Backlight anode (5V through resistor)
  K   → Backlight cathode (GND)
i2c_address: "0x27"
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
used_in: []
warnings: ["Without I2C backpack, uses 6+ digital pins — use I2C adapter to save pins", "Contrast pot (V0) is required or screen appears blank"]
datasheet_url: ""
---

# HD44780 1602A 16x2 LCD Character Display

The most common character display in the Arduino ecosystem. The HD44780 controller is a de facto standard — every manufacturer clones it, every tutorial covers it, and the `LiquidCrystal` library is built into the Arduino IDE. In parallel mode it eats pins (6 minimum in 4-bit mode), so get an I2C backpack adapter (PCF8574-based) and use `LiquidCrystal_I2C` to drop it down to 2 data pins.

## Specifications

| Spec | Value |
|------|-------|
| Display type | Transmissive STN LCD |
| Controller IC | HD44780 (or compatible clone) |
| Characters | 16 columns x 2 rows |
| Character size | 5x8 dot matrix per character |
| Operating voltage | 5V (4.7V-5.3V) |
| Logic level | 5V |
| Interface | 4-bit/8-bit parallel (native), I2C (with backpack) |
| I2C address | 0x27 (PCF8574) or 0x3F (PCF8574A) |
| Backlight | LED, yellow-green or blue |
| Current draw | ~1mA (logic) + ~80mA (backlight) |
| Custom characters | 8 user-definable (CGRAM) |
| Operating temp | 0C to +50C |
| Contrast control | Analog via potentiometer on V0 pin |

## Pinout

```
16-pin header (directly on LCD):
  Pin 1  VSS → GND
  Pin 2  VDD → 5V
  Pin 3  V0  → Contrast pot wiper (10k pot between VDD and VSS)
  Pin 4  RS  → Register select (digital pin)
  Pin 5  RW  → Read/Write (tie to GND for write-only)
  Pin 6  E   → Enable (digital pin)
  Pin 7  D0  → Data bit 0 (not used in 4-bit mode)
  Pin 8  D1  → Data bit 1 (not used in 4-bit mode)
  Pin 9  D2  → Data bit 2 (not used in 4-bit mode)
  Pin 10 D3  → Data bit 3 (not used in 4-bit mode)
  Pin 11 D4  → Data bit 4 (digital pin)
  Pin 12 D5  → Data bit 5 (digital pin)
  Pin 13 D6  → Data bit 6 (digital pin)
  Pin 14 D7  → Data bit 7 (digital pin)
  Pin 15 A   → Backlight anode (+5V through 100-220 ohm resistor)
  Pin 16 K   → Backlight cathode (GND)

I2C Backpack (4-pin, soldered to LCD):
  GND → GND
  VCC → 5V
  SDA → I2C data (A4 on Arduino Uno, GPIO21 on ESP32)
  SCL → I2C clock (A5 on Arduino Uno, GPIO22 on ESP32)
```

## Wiring Notes

### 4-Bit Parallel Mode (Direct Wiring)

The minimum-pin direct connection uses 4-bit mode (data sent in two nibbles). You need 6 Arduino pins: RS, E, D4, D5, D6, D7 — plus V0 contrast pot and power.

**Wiring (Arduino Uno example):**
- RS → pin 12
- E → pin 11
- D4 → pin 5
- D5 → pin 4
- D6 → pin 3
- D7 → pin 2
- RW → GND
- V0 → 10k pot wiper (ends to 5V and GND)
- A → 5V through 220 ohm resistor
- K → GND

**Library:** `LiquidCrystal` (built-in)
```cpp
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);  // RS, E, D4, D5, D6, D7
```

### I2C Mode (with PCF8574 Backpack)

The I2C backpack solders directly to the LCD's 16-pin header and exposes 4 pins. This is the recommended approach — 2 data pins instead of 6, and the backpack handles contrast via an onboard pot.

**Wiring (Arduino Uno example):**
- SDA → A4
- SCL → A5
- VCC → 5V
- GND → GND

**Library:** `LiquidCrystal_I2C`
```cpp
LiquidCrystal_I2C lcd(0x27, 16, 2);  // address, cols, rows
```

**I2C address detection:**
- PCF8574 backpack defaults to 0x27
- PCF8574A backpack defaults to 0x3F
- Three solder jumpers (A0, A1, A2) let you set 8 addresses per chip variant
- Run an I2C scanner sketch if the display doesn't respond at the default address

### Contrast Troubleshooting

If the screen powers on but shows blank or solid rectangles:
- Adjust the contrast potentiometer (V0 pin or onboard pot on I2C backpack)
- Solid dark rectangles = contrast too high, turn pot down
- Completely blank = contrast too low, turn pot up
- The sweet spot is narrow — adjust slowly

### 3.3V Board Compatibility

This is a 5V display. On 3.3V boards (ESP32, Raspberry Pi Pico):
- The display WILL NOT work at 3.3V — insufficient contrast voltage
- Use a logic level shifter on data lines and power from 5V
- Some I2C backpacks work at 3.3V logic with 5V power, but results vary

## Related Parts

- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] — alternative graphical display, lower power, higher contrast
- [[5161as-single-digit-7-segment-led-display-red-common-cathode]] — simpler numeric-only display

---

Categories:
- [[displays]]
