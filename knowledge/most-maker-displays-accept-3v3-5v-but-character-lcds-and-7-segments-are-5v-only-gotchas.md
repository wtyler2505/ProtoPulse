---
description: "OLED, TFT, NeoPixel, and LED matrix modules all accept 3.3-5V dual voltage, but HD44780 character LCDs need 5V and raw 7-segment LEDs have 2.1V forward voltage requiring 5V current-limited drive -- a gotcha for 3.3V MCUs like ESP32 and Pi Pico"
type: knowledge-note
source: "docs/parts/displays.md"
topics:
  - "[[displays]]"
  - "[[microcontrollers]]"
confidence: high
verified: false
---

# most maker displays accept 3.3-5V but character LCDs and 7-segments are 5V only gotchas

Modern display modules marketed to makers (OLED, TFT, NeoPixel, LED matrix) include onboard voltage regulators and level shifters, making them safe at both 3.3V and 5V logic levels. Two common display types break this pattern:

**The 5V-only gotchas:**

1. **HD44780 16x2/20x4 character LCD** -- Designed for 5V TTL logic. At 3.3V, the display genuinely WILL NOT work — the contrast mechanism requires a 5V VDD-VSS span, and the V0 sweet spot is unreachable at 3.3V (not just faint — completely invisible). The backlight is typically 5V as well. Using an I2C backpack (PCF8574) helps with logic (some backpacks accept 3.3V I2C signals with 5V power, but results vary by manufacturer), but the LCD module itself absolutely requires 5V power for both logic and contrast.

2. **Raw 7-segment LED displays** (5161AS, HS420561K) -- These are bare LED packages with ~2.1V forward voltage per segment. Each segment needs a current-limiting resistor calculated from the supply voltage. The resistor formula is `R = (Vsupply - Vf) / If`:
   - At 5V: `(5V - 2.1V) / 20mA = 145 ohm minimum`. Use 220 ohm (~13mA, plenty bright) or 330 ohm (~8.8mA, dimmer but extends LED life).
   - At 3.3V: `(3.3V - 2.1V) / 20mA = 60 ohm minimum`. Only 1.2V across the resistor halves the available current compared to 5V. Brightness drops significantly. More importantly, driving 7 segments + DP from GPIO requires HIGH output well above the LED Vf -- a 3.3V MCU driving a 2.1V LED leaves almost no headroom for the current-limiting resistor.

**Displays that work fine at 3.3V:**
- SH1106/SSD1306 OLED (onboard regulator accepts 3.3-5V on VCC, but logic pins are 3.3V native — safe for direct ESP32 connection; on 5V boards the module's onboard level shifting handles the mismatch)
- ILI9341 TFT (the IC itself is a 3.3V device, but Arduino shield variants include onboard level shifting for 5V Uno/Mega compatibility — bare breakout modules accept 3.3V logic directly)
- MAX7219-driven LED matrices/7-segments (MAX7219 handles the LED driving; you just send SPI commands)
- WS2812B NeoPixels (5V power required; 3.3V data line is technically out of spec -- WS2812B requires logic HIGH > 0.7 * VDD = 3.5V at 5V supply, which exceeds ESP32's 3.3V output. Works intermittently but unreliable in noisy environments or with long wires. Solutions: 74HCT125/245 buffer for proper 3.3V→5V level shifting, or [[txs0108e-8-channel-bidirectional-level-shifter-auto-direction]] as a bidirectional alternative)

**ProtoPulse implication:** When a 3.3V MCU (ESP32, ESP8266, Pi Pico) is in the project and the user adds an HD44780 or raw 7-segment display, the DRC should flag the voltage mismatch and suggest either a 5V MCU, a level shifter, or a MAX7219-based alternative.

---

Topics:
- [[displays]]
- [[microcontrollers]]
