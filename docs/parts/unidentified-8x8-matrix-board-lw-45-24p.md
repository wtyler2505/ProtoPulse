---
description: "Unknown 8x8 LED matrix PCB with marking 'LW-45' — 24-pin layout suggests integrated driver or shift register on board. Needs identification and testing"
topics: ["[[unidentified-parts]]"]
status: unidentified
quantity: 1
voltage: []
interfaces: []
logic_level: ""
manufacturer: "Unknown"
part_number: "LW-45"
markings: "LW-45, 24 pins"
form_factor: "PCB with 8x8 LED matrix"
pin_count: 24
physical_notes: "8x8 LED grid visible on board, 24 pins (more than bare matrix 16 pins — likely has onboard driver)"
compatible_with: []
used_in: []
warnings: ["Unidentified — do not apply power until pin functions are determined"]
datasheet_url: ""
---

# Unidentified 8x8 Matrix Board LW-45 24P

An unknown PCB with an 8x8 LED matrix and 24 pins. A bare 8x8 matrix like the [[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]] has only 16 pins (8 rows + 8 columns). This board has 24, which suggests either:

1. An integrated driver chip (MAX7219 or similar) with VCC, GND, DIN, CLK, CS, DOUT, etc.
2. A shift register (74HC595) for reduced pin count but still needing more than 16 pins
3. Additional pins for power, cascading, or configuration

## Identification Steps

1. Examine the board for any IC markings — flip it over, look for a chip under the matrix
2. Check if any of the 24 pins are clearly VCC/GND (trace to decoupling caps)
3. Try applying 3.3V to candidate VCC/GND pins and see if any LEDs light
4. If an IC is present, identify it and look up its datasheet
5. Compare pin layout to known MAX7219 LED matrix modules

## Related Parts

- [[1088as-8x8-red-led-dot-matrix-common-cathode-3mm]] — bare 8x8 matrix for comparison (16 pins, no driver)

---

Categories:
- [[unidentified-parts]]
