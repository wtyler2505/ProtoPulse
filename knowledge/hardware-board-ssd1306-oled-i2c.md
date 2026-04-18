---
description: "Exact physical and electrical specifications for SSD1306 0.96" OLED I2C Display."
type: domain-knowledge
category: hardware-components
status: verified
tags: [board, hardware, generic]
topics:
  - "[[hardware-components-displays]]"
  - "[[hardware-components]]"
  - "[[eda-hardware-components]]"
---

# SSD1306 0.96" OLED I2C Display Specifications

This note is the canonical Ars Contexta source of truth for the SSD1306 0.96" OLED I2C Display, used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** Generic
- **MPN:** SSD1306-096-I2C
- **Aliases:** 0.96 oled, i2c oled, ssd1306 display
- **Family:** board-module
- **Description:** 0.96-inch monochrome OLED display with 128x64 resolution, driven by the SSD1306 controller over I2C.
- **Breadboard Fit:** `native`
- **Breadboard Notes:** 4-pin header easily fits into a breadboard.

## Exact Physical Dimensions
- **Width:** 27.3 mm
- **Height:** 27.8 mm
- **Thickness:** 4 mm
- **Pin Pitch:** 2.54 mm

## Visual Characteristics
- **PCB Color (Hex):** `#1e3a8a`
- **Silkscreen Color (Hex):** `#172554`

## Electrical Constraints
- **Operating Voltage:** 3.3V
- **Input Voltage Range:** 3.3V - 5V
- **Max Current Per Pin:** 20 mA
- **Max Total Current:** 50 mA

## Headers & Pinout
### main Header (top side, 4 pins)
- **GND** (ground, 0V): 
- **VCC** (power, 5V): Usually accepts 3.3V to 5V due to onboard regulator
- **SCL** (communication, 3.3V): 
- **SDA** (communication, 3.3V): 

## Critical Safety & Verification Notes
- **WARNING:** Double-check VCC and GND positions before powering.
- Some variants swap GND and VCC pins. Always check silkscreen.
- [SSD1306 Datasheet](https://cdn-shop.adafruit.com/datasheets/SSD1306.pdf) (Confidence: high)

---
Related: [[hardware-components]], [[architecture-decisions]]
