---
description: "Unknown RGB LED module marked 'LEX-RGB-01' — likely a common-cathode or common-anode RGB LED breakout with onboard resistors. Needs pinout identification"
topics: ["[[unidentified-parts]]"]
status: unidentified
quantity: 1
voltage: []
interfaces: []
logic_level: ""
manufacturer: "Unknown"
part_number: "LEX-RGB-01"
markings: "LEX-RGB-01"
form_factor: "Small PCB module with RGB LED"
physical_notes: "RGB LED visible on module, likely breakout board with current limiting resistors"
compatible_with: []
used_in: []
warnings: ["Unidentified — do not apply power until pin functions are determined"]
datasheet_url: ""
---

# Unidentified RGB LED Module LEX-RGB-01

An unknown RGB LED module with the marking "LEX-RGB-01". Most likely a small breakout board with a through-hole or SMD RGB LED and onboard current-limiting resistors. Common configurations:

- **4-pin common cathode**: GND, R, G, B (PWM each color channel independently)
- **4-pin common anode**: VCC, R, G, B (sink current through each channel)
- **3-pin WS2812/NeoPixel style**: VCC, DIN, GND (addressable, single data pin)

## Identification Steps

1. Count the pins and check for labels (S, +, -, R, G, B, DIN, etc.)
2. Look for resistors on the board — their presence suggests analog RGB, not addressable
3. Check for a small IC near the LED — if present, likely WS2812B (addressable)
4. Apply 3.3V between candidate VCC/GND pins and check for any LED response
5. If analog: test each color channel with a 220 ohm resistor to 5V

---

Categories:
- [[unidentified-parts]]
