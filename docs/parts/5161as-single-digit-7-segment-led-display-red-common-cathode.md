---
description: "Standard numeric indicator — 0.56-inch red digit, 640nm, 2.1V forward drop, 20mA per segment. Use for counters, clocks, simple numeric readouts"
topics: ["[[displays]]"]
status: needs-test
quantity: 1
voltage: [2.1]
interfaces: [Digital]
logic_level: "5V"
manufacturer: "Generic"
pinout: |
  10-pin package
  Pin 3,8: Common cathode (GND)
  Pin 7: A (top)
  Pin 6: B (upper right)
  Pin 4: C (lower right)
  Pin 2: D (bottom)
  Pin 1: E (lower left)
  Pin 9: F (upper left)
  Pin 10: G (middle)
  Pin 5: DP (decimal point)
compatible_with: ["[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]"]
used_in: []
warnings: ["Each segment needs a current-limiting resistor (220-330 ohm at 5V)", "Common cathode — active HIGH segments"]
datasheet_url: ""
---

# 5161AS Single-Digit 7-Segment LED Display (Red, Common Cathode)

The simplest numeric display — 7 bar-shaped LEDs arranged as a figure-8 pattern, plus a decimal point. Each segment is an individual LED that you drive independently through a current-limiting resistor. Common cathode means the shared ground pin is common, and you set segments HIGH to light them. For multi-digit displays, you either multiplex multiple 5161AS units or step up to a TM1637/MAX7219 driver module.

## Specifications

| Spec | Value |
|------|-------|
| Display type | 7-segment LED |
| Digit count | 1 |
| Digit height | 0.56 inches (14.2mm) |
| LED color | Red (640nm) |
| Configuration | Common cathode |
| Forward voltage | 2.1V typical per segment |
| Forward current | 20mA per segment (max) |
| Peak current | 100mA (1/10 duty, pulsed) |
| Segments | 7 + decimal point (8 total) |
| Package | 10-pin DIP |
| Viewing angle | ~40 degrees |
| Luminous intensity | 7mcd typical at 10mA |

## Pinout

```
5161AS 10-pin package (front view, decimal point at bottom-right):

        ──A──
       |     |
       F     B
       |     |
        ──G──
       |     |
       E     C
       |     |
        ──D──  DP

Pin layout (front view):
  Top:     1(E)  2(D)  3(CC)  4(C)  5(DP)
  Bottom:  6(B)  7(A)  8(CC)  9(F)  10(G)

Segment-to-pin mapping:
  Segment A (top)         → Pin 7
  Segment B (upper right) → Pin 6
  Segment C (lower right) → Pin 4
  Segment D (bottom)      → Pin 2
  Segment E (lower left)  → Pin 1
  Segment F (upper left)  → Pin 9
  Segment G (middle)      → Pin 10
  DP (decimal point)      → Pin 5
  Common cathode (GND)    → Pin 3 and Pin 8 (both connected internally)
```

## Wiring Notes

### Direct Drive (Single Digit)

Each segment gets its own digital output pin through a current-limiting resistor. For a single digit this is straightforward — 8 pins for segments + DP, and the common cathode to GND.

**Wiring (Arduino Uno example):**
- Pin 7 (A) → 220 ohm → Arduino pin 2
- Pin 6 (B) → 220 ohm → Arduino pin 3
- Pin 4 (C) → 220 ohm → Arduino pin 4
- Pin 2 (D) → 220 ohm → Arduino pin 5
- Pin 1 (E) → 220 ohm → Arduino pin 6
- Pin 9 (F) → 220 ohm → Arduino pin 7
- Pin 10 (G) → 220 ohm → Arduino pin 8
- Pin 5 (DP) → 220 ohm → Arduino pin 9
- Pin 3, Pin 8 (CC) → GND

**Resistor calculation:**
- R = (Vsupply - Vf) / If = (5V - 2.1V) / 20mA = 145 ohm minimum
- Use 220 ohm for comfortable margin (~13mA, still plenty bright)
- Use 330 ohm for dimmer operation (~8.8mA, extends LED life)

### Digit Encoding (Common Cathode)

To display a number, set the corresponding segments HIGH:

```
Digit  A  B  C  D  E  F  G
  0    1  1  1  1  1  1  0
  1    0  1  1  0  0  0  0
  2    1  1  0  1  1  0  1
  3    1  1  1  1  0  0  1
  4    0  1  1  0  0  1  1
  5    1  0  1  1  0  1  1
  6    1  0  1  1  1  1  1
  7    1  1  1  0  0  0  0
  8    1  1  1  1  1  1  1
  9    1  1  1  1  0  1  1
```

As byte values (bit order: DP-G-F-E-D-C-B-A):
```cpp
byte digits[] = {
  0b00111111,  // 0
  0b00000110,  // 1
  0b01011011,  // 2
  0b01001111,  // 3
  0b01100110,  // 4
  0b01101101,  // 5
  0b01111101,  // 6
  0b00000111,  // 7
  0b01111111,  // 8
  0b01101111   // 9
};
```

### Multi-Digit Multiplexing

To display multiple digits (e.g., building a clock):
- Use multiple 5161AS units, each with its own common cathode connection
- Rapidly cycle through digits, enabling one cathode at a time via transistors (NPN for common cathode)
- Cycle rate must be >100Hz total (~25Hz per digit for 4 digits) to avoid visible flicker
- For 4+ digits, use a TM1637 or MAX7219 driver instead — manual multiplexing gets unwieldy fast

### Common Cathode vs Common Anode

This is a **common cathode** display — segments are active HIGH:
- To light a segment: set its pin HIGH (through resistor)
- Common cathode pins go to GND
- If you accidentally buy a common anode version (5161BS), the logic inverts: common anode to VCC, segments active LOW

## Related Parts

- [[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]] — more LEDs in a grid pattern, same drive approach
- [[hd44780-1602a-16x2-lcd-character-display-runs-at-5v-parallel-or-i2c]] — full text display, easier for multi-character output
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] — graphical display, can render custom digit styles

---

Categories:
- [[displays]]
