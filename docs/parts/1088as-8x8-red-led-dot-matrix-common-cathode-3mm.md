---
description: "64-LED grid for scrolling text and simple graphics — drive with MAX7219 for easy SPI control or direct multiplex for learning"
topics: ["[[displays]]"]
status: needs-test
quantity: 1
voltage: [3.3, 5]
interfaces: [SPI, Digital]
logic_level: "5V"
manufacturer: "Generic"
pinout: |
  16-pin DIP package
  Rows: pins 9,14,8,12,1,7,2,5 (accent anodes)
  Cols: pins 13,3,4,10,6,11,15,16 (common cathodes)
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
used_in: []
warnings: ["Each LED needs current limiting — 20mA per segment max", "Direct driving requires multiplexing — MAX7219 handles this automatically"]
datasheet_url: ""
---

# 1088AS 8x8 Red LED Dot Matrix (Common Cathode, 3mm)

A 64-LED grid in a compact DIP-16 package. Each LED sits at the intersection of a row (anode) and column (cathode) — set a row HIGH and a column LOW to light that pixel. Direct driving requires multiplexing 8 rows fast enough to avoid visible flicker, which burns through 16 I/O pins. The practical approach is pairing it with a MAX7219 driver IC, which reduces the interface to 3 SPI pins and handles all the multiplexing and current limiting internally.

## Specifications

| Spec | Value |
|------|-------|
| Display type | LED dot matrix |
| LED color | Red (625nm typical) |
| LED size | 3mm |
| Matrix size | 8 rows x 8 columns (64 LEDs) |
| Package | DIP-16 (1.2" x 1.2" grid) |
| Configuration | Common cathode (columns are cathodes) |
| Forward voltage | 2.0V typical per LED |
| Forward current | 20mA max per LED |
| Peak current | 100mA (1/10 duty cycle) |
| Operating voltage | 3.3V - 5V (with current limiting resistors) |
| Viewing angle | ~60 degrees |
| Luminous intensity | 40mcd typical at 20mA |

## Pinout

```
1088AS 16-pin DIP (top view, dot/notch at pin 1):

          Pin 1  ●──────────── Pin 16
          Pin 2  │            │ Pin 15
          Pin 3  │            │ Pin 14
          Pin 4  │   8 x 8   │ Pin 13
          Pin 5  │   LED     │ Pin 12
          Pin 6  │   Matrix  │ Pin 11
          Pin 7  │            │ Pin 10
          Pin 8  └────────────┘ Pin 9

Row anodes (accent HIGH to select row):
  Row 1 → Pin 9
  Row 2 → Pin 14
  Row 3 → Pin 8
  Row 4 → Pin 12
  Row 5 → Pin 1
  Row 6 → Pin 7
  Row 7 → Pin 2
  Row 8 → Pin 5

Column cathodes (pull LOW to light LED in selected row):
  Col 1 → Pin 13
  Col 2 → Pin 3
  Col 3 → Pin 4
  Col 4 → Pin 10
  Col 5 → Pin 6
  Col 6 → Pin 11
  Col 7 → Pin 15
  Col 8 → Pin 16
```

## Wiring Notes

### Direct Drive (Learning Exercise)

Direct multiplexing teaches you how LED matrices work but eats all your pins and requires constant CPU attention.

**Wiring (Arduino Uno):**
- 8 row pins → 8 digital outputs (through 220 ohm resistors each)
- 8 column pins → 8 digital outputs (or via transistors for higher current)
- Total: 16 I/O pins consumed
- Must scan rows at >100Hz to avoid flicker (>12.5ms per full frame, ~1.5ms per row)

**Why this is impractical for real projects:**
- Uses 16 out of 20 available I/O pins on an Uno
- CPU spends most of its time refreshing the display
- Brightness is limited (each row only on 1/8 of the time at 12.5% duty cycle)

### MAX7219 Driver (Recommended)

The MAX7219 was designed for exactly this — driving 8x8 matrices or 8-digit 7-segment displays with just 3 wires.

**Wiring (Arduino Uno with MAX7219):**
- DIN → pin 11 (MOSI / any digital pin)
- CS → pin 10 (any digital pin)
- CLK → pin 13 (SCK / any digital pin)
- VCC → 5V
- GND → GND
- RSET → 10k resistor to GND (sets segment current)

**Library:** `LedControl`
```cpp
LedControl lc = LedControl(11, 13, 10, 1);  // DIN, CLK, CS, numDevices
lc.setLed(0, row, col, true);               // device 0, row, col, on
```

**Chaining:** Multiple MAX7219 modules daisy-chain via DOUT → DIN of next module, sharing CLK and CS. Up to 8 modules on one CS line.

### Current Limiting

- Each LED: 20mA max continuous, 2.0V forward drop
- At 5V supply: R = (5V - 2.0V) / 20mA = 150 ohm minimum per LED
- Use 220 ohm for comfortable margin (13.6mA per LED)
- MAX7219 RSET resistor controls current globally — 10k ohm gives ~40mA peak at 1/8 duty (equivalent to ~5mA average per LED)

### Orientation

The 1088AS pin numbering starts at the bottom-left (pin 1) with the part number text readable. If your display is upside down, the row/column mapping inverts. Test with a single LED (one row HIGH, one column LOW) to verify orientation before coding the full display.

## Verification Status

Status confirmed as needs-test. The part record accurately describes the 1088AS matrix capabilities — pinout, current limits, and driver options are all documented. No additional enrichment needed at this time. Physical testing with a MAX7219 driver module will confirm the specific unit is functional.

## Related Parts

- [[5161as-single-digit-7-segment-led-display-red-common-cathode]] — simpler single-digit numeric display, same LED technology
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] — higher resolution graphical alternative
- [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]] — text-based alternative with built-in character ROM

---

Categories:
- [[displays]]
