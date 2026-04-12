---
description: "Handheld gaming dev board from Adafruit — ATSAMD51J19 with 1.8\" TFT, d-pad, buttons, speaker, accelerometer, and light sensor. Runs CircuitPython, Arduino, or Microsoft MakeCode Arcade out of the box"
topics: ["[[microcontrollers]]", "[[displays]]"]
status: needs-test
quantity: 1
voltage: [3.3]
interfaces: [GPIO, I2C, SPI, UART, USB, STEMMA, Analog, PWM]
logic_level: "3.3V"
manufacturer: "Adafruit"
mcu: "ATSAMD51J19 (ARM Cortex-M4F)"
clock_mhz: 120
flash_kb: 512
sram_kb: 192
part_number: "4242"
dimensions_mm: "83 x 57 x 15"
pinout: |
  Buttons: D-pad (Up/Down/Left/Right), A, B, Start, Select
  Display: 1.8" ST7735R TFT 160x128 (SPI, internal)
  Speaker: Class D amplifier, analog out
  Light sensor: analog
  Accelerometer: LIS3DH (I2C, 0x18)
  NeoPixel: 5x WS2812B on board
  STEMMA QT: I2C connector (JST SH 4-pin)
  Expansion: 8 GPIO pads on back (analog/digital)
  microSD: SPI card slot
  Audio out: 3.5mm headphone jack
  Battery: JST connector for 3.7V LiPo (onboard charger)
  USB: Micro-USB (native USB, no FTDI/CH340)
compatible_with: ["[[adafruit-monster-m4sk-dual-tft-display-board-for-animated-eyes]]", "[[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]]", "[[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]]"]
used_in: []
warnings: ["3.3V logic — NOT 5V tolerant", "Display and NeoPixels use significant SPI/GPIO — check which pins are free before adding peripherals", "STEMMA QT is 3.3V I2C only — no 5V I2C devices without level shifting", "Battery connector is JST PH 2-pin — polarity matters, check before connecting"]
datasheet_url: "https://www.adafruit.com/product/4242"
---

# Adafruit PyGamer SAMD51 handheld gaming board with TFT

The Adafruit PyGamer is a self-contained handheld gaming development board. It packs a lot into one PCB: ATSAMD51J19 running at 120MHz (ARM Cortex-M4F with hardware floating point), a 1.8" color TFT display, directional pad, A/B/Start/Select buttons, a speaker with Class D amp, an LIS3DH accelerometer, a light sensor, 5 NeoPixels, a microSD card slot, a headphone jack, and a LiPo battery connector with onboard charging.

It's designed for Microsoft MakeCode Arcade (drag-and-drop game creation), CircuitPython, and Arduino. The MakeCode Arcade support is the standout — you can build and deploy retro-style games from a browser IDE in minutes.

For general-purpose MCU development, the PyGamer is overkill — most of its I/O is consumed by the onboard peripherals. But for anything involving a display, buttons, sound, or motion sensing, it's an all-in-one package that saves you wiring 6 breakout boards together.

## Specifications

| Spec | Value |
|------|-------|
| MCU | ATSAMD51J19 (ARM Cortex-M4F, 32-bit) |
| Clock | 120MHz |
| Flash | 512KB |
| SRAM | 192KB |
| Operating Voltage | 3.3V |
| Input | USB 5V or 3.7V LiPo battery |
| Display | 1.8" ST7735R TFT, 160x128, 18-bit color |
| Audio | Class D amplifier + 3.5mm headphone jack |
| Accelerometer | LIS3DH (I2C, address 0x18) |
| Light Sensor | Analog phototransistor |
| NeoPixels | 5x WS2812B (onboard) |
| Buttons | D-pad (4-way), A, B, Start, Select |
| Storage | microSD card slot (SPI) |
| Battery | JST PH for 3.7V LiPo, onboard charger |
| Expansion | 8 GPIO pads on back, STEMMA QT I2C |
| USB | Micro-USB (native USB on SAMD51) |
| Dimensions | ~83 x 57mm |

## Onboard Peripherals

| Peripheral | Interface | Pin/Address | Notes |
|-----------|-----------|-------------|-------|
| TFT Display | SPI | Internal | ST7735R, 160x128, uses dedicated SPI pins |
| LIS3DH Accel | I2C | 0x18 | 3-axis, tap detection, free-fall |
| NeoPixels (5) | GPIO | Internal | WS2812B, individually addressable |
| Speaker | DAC/PWM | Internal | Class D amp, surprisingly loud |
| Light Sensor | ADC | Internal | Analog phototransistor |
| microSD | SPI | Internal | Shares SPI bus with display |
| Buttons | GPIO | Internal | All active-low with pull-ups |

## Expansion — What's Left for You

After all onboard peripherals claim their pins, you get:

- **STEMMA QT connector** — I2C (3.3V), connect any Adafruit STEMMA QT / Qwiic sensor
- **8 GPIO pads on the back** — some analog-capable, some digital-only. Check the Adafruit pinout diagram for your specific revision.
- **I2C bus** — shared with accelerometer (0x18), available for additional devices at non-conflicting addresses

## Programming

- **MakeCode Arcade** — browser-based, drag-and-drop game creation. UF2 deployment.
- **CircuitPython** — Adafruit's Python. Drag `.py` files to the CIRCUITPY drive. Best library support for all onboard peripherals.
- **Arduino IDE** — install Adafruit SAMD board package. Full C++ control.
- **UF2 bootloader** — double-tap reset to enter bootloader. Board appears as USB drive. Drag firmware onto it.

## Wiring Notes

- **STEMMA QT** is the easiest expansion — plug in any Qwiic/STEMMA QT I2C sensor, no soldering needed
- **GPIO pads on the back** require soldering or pogo pins for prototyping
- **3.3V only** — no 5V tolerance. The SAMD51 is directly connected to GPIO with no buffering.
- **Battery** — use a 3.7V LiPo with JST PH 2-pin connector. Check polarity against the silkscreen — some batteries have reversed polarity connectors.
- **Native USB** — the SAMD51 has built-in USB, so no FTDI/CH340 chip. Can appear as a keyboard, mouse, MIDI device, or serial port.

## Warnings

- **3.3V logic only** — not 5V tolerant on any pin
- **Limited free GPIO** — most pins are used by onboard peripherals. Don't expect to connect 10 sensors.
- **Battery polarity** — JST PH connectors have no universal polarity standard. Connecting a reversed battery can damage the charger circuit.
- **Speaker can be loud** — the Class D amp outputs enough volume to be surprising. Set volume in software before powering on.
- **SAMD51 is different from ATmega** — not all Arduino libraries are SAMD51-compatible. Check before assuming a library works.

---

Related Parts:
- [[adafruit-monster-m4sk-dual-tft-display-board-for-animated-eyes]] -- same SAMD51 MCU family, different form factor (wearable)
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] -- simpler MCU, no onboard peripherals, more GPIO
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] -- external I2C display, connectable via STEMMA QT
- [[nodemcu-esp32s-is-a-dual-core-wifi-bt-mcu-with-34-gpio-at-3v3]] -- WiFi MCU, no display/buttons but more I/O
- [[arduino-uno-r3-is-a-14-io-5v-board-with-atmega328p-and-usb-b]] -- Arduino ecosystem, SAMD51 supports Arduino IDE (CircuitPython preferred)

Categories:
- [[microcontrollers]]
- [[displays]]
