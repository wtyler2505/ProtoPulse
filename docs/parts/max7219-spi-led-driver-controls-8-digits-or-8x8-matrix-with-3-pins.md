---
description: "THE driver IC for LED displays — controls 8 seven-segment digits or an 8x8 matrix over SPI with just 3 pins. Daisy-chainable via DOUT, built-in BCD decoder, 16-level PWM brightness"
topics: ["[[displays]]", "[[shields]]"]
status: needs-test
quantity: 1
voltage: [4, 5, 5.5]
interfaces: [SPI]
logic_level: "5V"
manufacturer: "Maxim Integrated (Analog Devices)"
part_number: "MAX7219CNG"
pinout: |
  24-pin DIP package:
  Pin 1  → DIN (serial data in from MCU MOSI)
  Pin 2  → DIG 0 (digit/column 0 sink driver)
  Pin 3  → DIG 4
  Pin 4  → GND
  Pin 5  → DIG 6
  Pin 6  → DIG 2
  Pin 7  → DIG 3
  Pin 8  → DIG 7
  Pin 9  → GND
  Pin 10 → DIG 5
  Pin 11 → DIG 1
  Pin 12 → LOAD/CS (latch data on rising edge)
  Pin 13 → CLK (serial clock, 10MHz max)
  Pin 14 → SEG A (segment source driver)
  Pin 15 → SEG F
  Pin 16 → SEG B
  Pin 17 → SEG G
  Pin 18 → ISET (connect RSET resistor to V+)
  Pin 19 → V+ (4.0-5.5V supply)
  Pin 20 → SEG C
  Pin 21 → SEG E
  Pin 22 → SEG DP (decimal point)
  Pin 23 → SEG D
  Pin 24 → DOUT (serial data out — daisy chain to next MAX7219 DIN)
i2c_address: ""
compatible_with: ["[[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]]", "[[5161as-single-digit-7-segment-led-display-red-common-cathode]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]"]
used_in: []
warnings: ["Common-cathode displays ONLY — will not work with common-anode", "RSET resistor sets segment current for ALL segments — use 9.53k for ~40mA (max brightness), higher values for less current", "Both GND pins (4 and 9) must be connected", "100nF + 10uF caps required between V+ and GND close to the chip"]
datasheet_url: "Datasheets/max7219cng.pdf"
---

# MAX7219 SPI LED driver controls 8 digits or 8x8 matrix with 3 pins

## Specifications

| Spec | Value |
|------|-------|
| Supply Voltage (V+) | 4.0 - 5.5V |
| Supply Current | 330mA max (all segments on) |
| Shutdown Current | 150uA |
| Segment Current | Set by RSET resistor (9.53k = 40mA) |
| SPI Clock | 10MHz max |
| Digits/Columns | 8 |
| Segments/Rows | 8 (A-G + DP) |
| Brightness Control | 16 levels (PWM) |
| BCD Decoder | Built-in (0-9, H, E, L, P, -, blank) |
| Daisy Chain | Via DOUT → next DIN |
| Package | 24-pin narrow DIP or SO |
| Temp Range | 0 to +70C (CNG) |

## Pinout

```
         +---[MAX7219]---+
   DIN  [1]            [24] DOUT
 DIG 0  [2]            [23] SEG D
 DIG 4  [3]            [22] SEG DP
   GND  [4]            [21] SEG E
 DIG 6  [5]            [20] SEG C
 DIG 2  [6]            [19] V+
 DIG 3  [7]            [18] ISET
 DIG 7  [8]            [17] SEG G
   GND  [9]            [16] SEG B
 DIG 5 [10]            [15] SEG F
 DIG 1 [11]            [14] SEG A
LOAD/CS[12]            [13] CLK
         +---------------+
```

## Wiring to Arduino (3 pins)

| MAX7219 | Arduino | Function |
|---------|---------|----------|
| DIN (1) | Any digital (e.g. D11) | Serial data |
| CLK (13) | Any digital (e.g. D13) | Clock |
| LOAD/CS (12) | Any digital (e.g. D10) | Chip select |
| V+ (19) | 5V | Power |
| GND (4, 9) | GND | Both must connect |
| ISET (18) | 9.53k resistor to V+ | Sets LED current |

## RSET Resistor Selection

| RSET | Segment Current | Use Case |
|------|----------------|----------|
| 9.53k | ~40mA | Max brightness (large displays) |
| 20k | ~20mA | Standard brightness |
| 40k | ~10mA | Low brightness (small LEDs) |

## Daisy Chaining

Connect DOUT (pin 24) of the first MAX7219 to DIN (pin 1) of the next. Share CLK and LOAD/CS lines. Each chip in the chain adds 16 bits to the shift register. The LedControl library handles addressing automatically.

## Warnings

- **Common-cathode ONLY** — the DIG pins sink current (pull to GND). Common-anode displays need a different driver.
- **RSET is critical** — wrong value means wrong LED current. Too low = dead LEDs. The 9.53k value from the datasheet gives 40mA which is the absolute max for most LEDs.
- **Decoupling caps** — 100nF ceramic + 10uF electrolytic between V+ and GND, close to the chip. Without them, display flickers and SPI communication gets unreliable.
- **Both GND pins** must be connected — they're not internally bridged.

---

Related Parts:
- [[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]] -- the display this driver is made for
- [[5161as-single-digit-7-segment-led-display-red-common-cathode]] -- can drive up to 8 of these
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] -- 3 digital pins is all you need

Categories:
- [[displays]]
- [[shields]]
