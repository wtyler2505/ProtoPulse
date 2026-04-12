---
description: "TI TXS0108E 8-channel auto-direction-sensing level shifter — TSSOP-20 package on breakout board. Faster than BSS138-based shifters (up to 110Mbps push-pull, 1.2Mbps open-drain). Used for Hall sensor signals between 5V BLDC controllers and 3.3V ESP32"
topics: ["[[shields]]", "[[passives]]"]
status: verified
quantity: 1
voltage: [1.2, 3.3, 5]
interfaces: [Digital]
logic_level: "mixed"
logic_notes: "Bridge-style shifter. A-side follows the low-voltage rail and B-side follows the high-voltage rail. Best for push-pull digital signals, not open-drain I2C."
manufacturer: "Texas Instruments"
part_number: "TXS0108E"
pinout: |
  TXS0108E breakout (TSSOP-20):
  VCCA  → Low-voltage side (1.2-3.6V, typically 3.3V from ESP32)
  VCCB  → High-voltage side (1.65-5.5V, typically 5V from controller)
  GND   → Common ground (shared between both sides)
  OE    → Output enable (active HIGH, connect to VCCA for always-on)
  A1-A8 → Low-voltage side channels (connect to 3.3V MCU)
  B1-B8 → High-voltage side channels (connect to 5V device)
compatible_with: ["[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]]", "[[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]]", "[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
alternative_to: ["[[hw-221-8-channel-bidirectional-level-shifter-bss138-based]] (BSS138-based — slower but more robust for I2C pull-up lines)"]
used_in: []
warnings: ["Does NOT work well with I2C — the auto-direction sensing conflicts with I2C open-drain pull-ups. Use BSS138-based shifter (HW-221) for I2C instead", "MUST have 0.1uF decoupling capacitors on BOTH VCCA and VCCB, as close to pins as possible — without them, signal integrity degrades badly", "OE pin must be connected to VCCA or driven HIGH — if left floating, outputs are disabled", "NEVER connect 36V motor battery to VCCB — maximum is 5.5V. Use the +5V output from the RioRand controller", "Auto-direction sensing means the direction is determined by which side drives first — works great for push-pull signals, unreliable for open-drain (I2C)"]
datasheet_url: "https://www.ti.com/product/TXS0108E"
---

# TXS0108E 8-Channel Bidirectional Level Shifter — Auto-Direction

The TXS0108E is TI's auto-direction-sensing level shifter. Unlike BSS138-based shifters that use pull-up resistors and are inherently slow, the TXS0108E uses one-shot edge accelerators to detect which side is driving and translates the signal at high speed. It can handle push-pull signals up to 110 Mbps — orders of magnitude faster than BSS138.

**Primary use in the rover:** Shifting the 5V Hall sensor signals (Hall-A, Hall-B, Hall-C, Hall Temp) from the [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] down to 3.3V for the ESP32's input-only GPIOs (34, 35, 36, 39). The Hall signals are push-pull digital outputs from the motor, so the TXS0108E is the right tool here.

**Do NOT use this for I2C.** The auto-direction sensing fights with I2C's open-drain topology and pull-up resistors. Use the [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]] for I2C buses instead.

## Specifications

| Spec | Value |
|------|-------|
| IC | Texas Instruments TXS0108E |
| Channels | 8 bidirectional |
| Direction Sensing | Automatic (one-shot edge detection) |
| VCCA Range | 1.2V to 3.6V (low-voltage side) |
| VCCB Range | 1.65V to 5.5V (high-voltage side) |
| Max Data Rate (push-pull) | 110 Mbps |
| Max Data Rate (open-drain) | 1.2 Mbps |
| Propagation Delay | ~4ns typical |
| Output Drive | +/-50mA |
| Quiescent Current | ~100uA (no switching) |
| Package | TSSOP-20 |
| Operating Temp | -40C to +85C |

## Pin Mapping (from PDF Wiring Diagram)

For Hall sensor interfacing (MC1 Front-Left example):

| TXS0108E Pin | B-Side (5V) | A-Side (3.3V) | Signal |
|-------------|-------------|---------------|--------|
| B1 (pin 2) | — | A1 (pin 18) | (unused or enable) |
| B1 (pin 3) | Hall-A from RioRand | A1 (pin 17) → GPIO 34 | Hall sensor A |
| B2 (pin 4) | Hall-B from RioRand | A2 (pin 16) → GPIO 35 | Hall sensor B |
| B3 (pin 5) | Hall-C from RioRand | A3 (pin 15) → GPIO 36 | Hall sensor C |
| B4 (pin 6) | Hall Temp from RioRand | A4 (pin 12) → GPIO 39 | Temperature sensor |
| VCCB (pin 10) | +5V from RioRand | — | B-side power |
| VCCA (pin 11) | — | 3.3V from ESP32 | A-side power |
| GND (pin 1) | Common GND | Common GND | Ground |
| OE (pin 19) | — | Connect to VCCA (3.3V) | Enable (always on) |

## Critical Wiring Notes

1. **Power the B-side from the RioRand +5V output** — the thin red wire. NEVER from the 36V motor battery.
2. **0.1uF ceramic capacitor on VCCA** — as close to pin 11 as possible
3. **0.1uF ceramic capacitor on VCCB** — as close to pin 10 as possible
4. **OE to VCCA** — enables all channels
5. **Common ground** — ESP32 GND, RioRand GND, and TXS0108E GND must all be connected

## TXS0108E vs BSS138 Level Shifters

| Feature | TXS0108E | BSS138-based (HW-221) |
|---------|----------|----------------------|
| Speed | 110 Mbps (push-pull) | ~400 kHz |
| Direction | Auto-sensing | Auto-sensing (pull-up based) |
| I2C Compatible | NO (fights open-drain) | YES (designed for it) |
| Push-Pull Signals | Excellent | Works but slow |
| Power Consumption | ~100uA | ~0 (passive FETs) |
| Price | ~$2-4 | ~$1-2 |
| Best For | SPI, Hall sensors, fast digital | I2C, UART, slow digital |

---

Related Parts:
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — 3.3V MCU; A-side connects to ESP32 GPIOs for Hall sensor reading
- [[riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input]] — 5V Hall sensor outputs; B-side connects to controller's Hall/Temp signals
- [[hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors]] — Hall sensor source; signals routed through ZS-X11H controller then through this shifter to ESP32
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — 5V MCU; can be on B-side when bridging to 3.3V peripherals for push-pull signals
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — 5V MCU; B-side for fast digital signal shifting
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — 3.3V MCU; A-side for shifting to 5V devices
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] — 3.3V MCU; A-side for shifting to 5V devices
- [[hw-221-8-channel-bidirectional-level-shifter-bss138-based]] — alternative shifter; slower but correct for I2C open-drain buses
- [[ws2812b-neopixel-ring-status-led-array-for-system-feedback]] — can shift 3.3V data line to 5V for reliable NeoPixel communication

Categories:
- [[shields]]
- [[passives]]
