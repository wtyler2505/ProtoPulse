---
description: "Multi-pole latching switch for mode selection — 6-pole, 18-pin, self-locking mechanism. Each button stays pressed until another is pressed (radio-button behavior)"
topics: ["[[input-devices]]"]
status: needs-test
quantity: 1
voltage: [5, 12]
interfaces: [Digital]
manufacturer: "Toneluck"
compatible_with: ["[[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]]", "[[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]]", "[[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]]", "[[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]]", "[[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]]", "[[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]"]
warnings: ["18 pins — verify pinout before wiring, incorrect connections can short poles together"]
datasheet_url: ""
---

# Toneluck 6-Way Self-Locking Push Button Switch (18-Pin)

A mechanical latching push button assembly with 6 independent buttons sharing 18 pins. When one button is pressed, the previously pressed button releases — classic radio-button behavior. This makes it ideal for mode selection where only one state can be active at a time.

## Key Specs

| Parameter | Value |
|-----------|-------|
| Type | Self-locking push button (radio-button) |
| Poles | 6 |
| Pin Count | 18 (3 pins per pole) |
| Voltage Rating | 5V–12V typical |
| Interface | Digital (mechanical switch) |
| Manufacturer | Toneluck |

## Pin Configuration

18 pins across 6 poles — each pole likely has 3 pins (COM, NO, NC per switch position). Exact pinout needs verification with continuity testing before use.

**Verification procedure:**
1. Use a multimeter in continuity mode
2. Press each button individually and probe all 18 pins
3. Map which pins connect when each button is pressed
4. Identify common, normally-open, and normally-closed for each pole

## Usage Notes

- Radio-button behavior means only one mode is active at a time — no need for software debouncing of mode conflicts
- Each pole is a simple switch contact — pull-up or pull-down resistors needed when connecting to a microcontroller
- Mechanical switch — consider debouncing in software (10-50ms) for clean state transitions
- With 6 modes and only digital connections, you can use 6 GPIO pins (one per pole) or encode the 6 states with fewer pins using a priority encoder

## Typical Applications

- Mode selection panels (6 operating modes)
- Audio channel selection
- Input source switching
- Manual state machines

---

Related Parts:
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] — compatible via digital GPIO with pull-ups, passive switch works at any voltage. 6 poles uses 6 GPIO pins (or fewer with priority encoder)
- [[arduino-mega-2560-is-a-54-io-5v-board-with-4-hardware-uarts]] — compatible via digital GPIO, plenty of pins for all 6 poles
- [[arduino-nano-v3-is-a-22-io-5v-board-with-atmega328p-and-mini-usb]] — compatible via digital GPIO, 6 poles feasible but pin-constrained
- [[elegoo-mega-2560-r3-is-an-arduino-mega-clone-with-ch340-usb]] — compatible via digital GPIO, plenty of pins for all 6 poles
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] — compatible via digital GPIO at 3.3V, passive switch works at any voltage
- [[esp8266-nodemcu-amica-is-a-wifi-mcu-with-11-io-at-3v3]] — compatible but pin-constrained (11 GPIO total, 6 poles = tight). Consider priority encoder to reduce pin count
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] — compatible via digital GPIO at 3.3V, passive switch works at any voltage
- [[membrane-switch-keypad-module-tactile-button-array]] — alternative input (momentary vs latching, matrix scanning vs individual poles)
- [[ky-040-rotary-encoder-module-incremental-with-pushbutton]] — alternative for mode selection (encoder with software states vs hardware radio-button)

Categories:
- [[input-devices]]
