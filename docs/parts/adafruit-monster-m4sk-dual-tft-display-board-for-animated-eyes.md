---
description: "Wearable animated eyes board from Adafruit — ATSAMD51G19 with two 240x240 IPS TFT displays, PDM microphone, accelerometer, and light sensor. Built for costumes, masks, and animatronic projects"
topics: ["[[microcontrollers]]", "[[displays]]"]
status: needs-test
quantity: 1
voltage: [3.3]
interfaces: [I2C, SPI, UART, USB, STEMMA, Audio]
logic_level: "3.3V"
manufacturer: "Adafruit"
mcu: "ATSAMD51G19 (ARM Cortex-M4F)"
clock_mhz: 120
flash_kb: 512
sram_kb: 192
part_number: "4343"
pinout: |
  Displays: Two 1.54" ST7789 IPS TFT, 240x240 each (SPI, internal)
  PDM Microphone: onboard, for sound-reactive animations
  Accelerometer: LIS3DH (I2C, 0x18), for motion-reactive eyes
  Light sensor: analog phototransistor, for pupil dilation
  NeoPixel: 1x WS2812B on board
  STEMMA QT: I2C connector (JST SH 4-pin)
  Expansion: 3 GPIO pads (limited)
  Battery: JST PH connector for 3.7V LiPo
  USB: Micro-USB (native USB)
  Audio: onboard speaker connector (class D amp)
compatible_with: ["[[adafruit-pygamer-samd51-handheld-gaming-board-with-tft]]"]
used_in: []
warnings: ["3.3V logic — NOT 5V tolerant", "Very few free GPIO — almost all pins dedicated to the two displays and sensors", "Requires 2MB+ QSPI flash for eye animation bitmaps (onboard)", "Battery connector polarity — check against silkscreen before connecting"]
datasheet_url: "https://www.adafruit.com/product/4343"
---

# Adafruit Monster M4SK dual TFT display board for animated eyes

The Monster M4SK is Adafruit's purpose-built board for animated eyes in costumes, masks, props, and animatronic projects. Two 240x240 IPS TFT displays driven by a SAMD51 create a pair of eyes that track motion (via the LIS3DH accelerometer), react to sound (via the PDM microphone), and adjust pupil size to ambient light (via the phototransistor). Out of the box, it runs Adafruit's Eye of Horus firmware — just power it on and you get realistic animated eyes.

This is NOT a general-purpose development board. Almost all GPIO is consumed by the two SPI displays, the accelerometer, the mic, and the light sensor. You get a STEMMA QT I2C connector and a few expansion pads, but if you need lots of I/O, use the [[adafruit-pygamer-samd51-handheld-gaming-board-with-tft]] or a different board entirely.

## Specifications

| Spec | Value |
|------|-------|
| MCU | ATSAMD51G19 (ARM Cortex-M4F, 32-bit) |
| Clock | 120MHz |
| Flash | 512KB (MCU) + 8MB QSPI (for eye bitmaps) |
| SRAM | 192KB |
| Operating Voltage | 3.3V |
| Input | USB 5V or 3.7V LiPo battery |
| Displays | 2x 1.54" ST7789 IPS TFT, 240x240, 65K color |
| Microphone | PDM MEMS (sound-reactive animations) |
| Accelerometer | LIS3DH (I2C, 0x18) |
| Light Sensor | Analog phototransistor |
| NeoPixel | 1x WS2812B |
| Speaker | Class D amplifier (connector for external speaker) |
| Storage | 8MB QSPI flash (eye bitmap storage) |
| Battery | JST PH for 3.7V LiPo |
| Expansion | STEMMA QT (I2C), 3 GPIO pads |
| USB | Micro-USB (native USB on SAMD51) |

## Dual Display Architecture

Each eye is a separate 1.54" ST7789 IPS TFT running at 240x240 resolution. Both are driven over SPI by the SAMD51 — the Cortex-M4F's floating-point unit and DMA capabilities allow smooth animation at a usable frame rate.

The 8MB QSPI flash stores the eye textures — iris patterns, sclera maps, eyelid shapes. Adafruit provides pre-made eye configurations, and you can create custom ones using their image tools.

## Sensors for Eye Behavior

| Sensor | Function | Behavior |
|--------|----------|----------|
| LIS3DH accelerometer | Motion tracking | Eyes look in the direction the board tilts |
| PDM microphone | Sound detection | Eyes widen or blink in response to noise |
| Light sensor | Ambient brightness | Pupils dilate in darkness, constrict in light |

All sensor-to-eye-behavior mappings are configurable in the firmware. You can disable any sensor channel or remap its effect.

## Programming

- **Pre-loaded firmware** — Eye of Horus runs out of the box. Configure via `config.eye` file on the CIRCUITPY drive.
- **CircuitPython** — Adafruit's displayio library supports both screens. Custom eye animations in Python.
- **Arduino IDE** — Adafruit GFX + ST7789 library. More work but maximum control.
- **UF2 bootloader** — double-tap reset, drag firmware onto the USB drive.

## Wiring Notes

- **STEMMA QT** — the main expansion point. Plug in any 3.3V I2C sensor without soldering.
- **3 GPIO pads** — on the board edge, usable for simple digital I/O or triggering external effects.
- **Battery** — designed for portable/wearable use. A 500mAh LiPo gives a few hours of runtime. Charges from USB.
- **Speaker connector** — solder an 8-ohm speaker for sound effects. The Class D amp drives it directly.
- **Nose bridge** — two Monster M4SK boards can be connected via the nose bridge connector to create a matched pair with synchronized animations.

## Warnings

- **3.3V logic only** — SAMD51 GPIOs are unprotected
- **Almost no free GPIO** — this is an application-specific board, not a general-purpose dev board
- **Battery polarity** — JST PH connectors vary by manufacturer. Verify polarity.
- **QSPI flash** — custom eye textures must be formatted correctly for the firmware. Use Adafruit's tools.
- **Two SPI displays = significant current draw** — backlight LEDs pull meaningful current. Use a battery with sufficient capacity for wearable use.

---

Related Parts:
- [[adafruit-pygamer-samd51-handheld-gaming-board-with-tft]] -- same SAMD51 MCU family, more GPIO, single display, also runs CircuitPython/Arduino
- [[raspberry-pi-pico-is-an-rp2040-mcu-with-26-gpio-at-3v3]] -- general-purpose MCU if you need more I/O
- [[sh1106-1p3-inch-oled-128x64-display-module-runs-on-3v3-or-5v-via-i2c-or-spi]] -- external I2C display, connectable via STEMMA QT

Categories:
- [[microcontrollers]]
- [[displays]]
