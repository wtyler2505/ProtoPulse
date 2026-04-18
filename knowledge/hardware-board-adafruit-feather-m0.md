---
description: "Exact physical and electrical specifications for Adafruit Feather M0 Basic Proto."
type: domain-knowledge
category: hardware-components
status: verified
tags: [board, hardware, adafruit]
topics:
  - "[[hardware-components-mcu]]"
  - "[[hardware-components]]"
  - "[[eda-arm-constraints]]"
---

# Adafruit Feather M0 Basic Proto Specifications

This note is the canonical Ars Contexta source of truth for the Adafruit Feather M0 Basic Proto, used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** Adafruit
- **MPN:** 2772
- **Aliases:** Feather M0, Feather SAMD21, Adafruit Feather, ATSAMD21 Feather
- **Family:** board-module
- **Description:** ATSAMD21G18 Cortex-M0+ at 48MHz with Feather form factor: 20 GPIO, 8 PWM, 10 ADC (12-bit), 1 DAC, native USB, LiPo charging. 51×23mm.
- **Breadboard Fit:** `native`
- **Breadboard Notes:** Feather form factor (23mm wide) fits across the center channel of a standard breadboard. 16 pins left, 12 pins right at 0.1" pitch.

## Exact Physical Dimensions
- **Width:** 23 mm
- **Height:** 51 mm
- **Thickness:** 8 mm
- **Pin Pitch:** 2.54 mm

## Visual Characteristics
- **PCB Color (Hex):** `#0f172a`
- **Silkscreen Color (Hex):** `#1e293b`

## Electrical Constraints
- **Operating Voltage:** 3.3V
- **Input Voltage Range:** 3.4V - 6V
- **Max Current Per Pin:** 7 mA
- **Max Total Current:** 50 mA

## Headers & Pinout
### left Header (left side, 16 pins)
- **RST** (control, 3.3V): 
- **3V** (power, 3.3V): Max 500mA from regulator when USB powered
- **AREF** (control, 3.3V): 
- **GND** (ground, 0V): 
- **A0** (analog, 3.3V): 
- **A1** (analog, 3.3V): 
- **A2** (analog, 3.3V): 
- **A3** (analog, 3.3V): 
- **A4** (analog, 3.3V): 
- **A5** (analog, 3.3V): 
- **SCK** (communication, 3.3V): 
- **MOSI** (communication, 3.3V): 
- **MISO** (communication, 3.3V): 
- **RX** (communication, 3.3V): 
- **TX** (communication, 3.3V): 
- **GND** (ground, 0V): 

### right Header (right side, 12 pins)
- **BAT** (power, 4.2V): LiPo battery voltage — do not exceed 6V
- **EN** (control, 3.3V): Pull LOW to disable 3.3V regulator
- **USB** (power, 5V): USB 5V — only available when USB connected
- **13** (digital, 3.3V): Connected to red on-board LED
- **12** (digital, 3.3V): 
- **11** (digital, 3.3V): 
- **10** (digital, 3.3V): 
- **9** (digital, 3.3V): 
- **6** (digital, 3.3V): 
- **5** (digital, 3.3V): 
- **SDA** (communication, 3.3V): 
- **SCL** (communication, 3.3V): 

## Critical Safety & Verification Notes
- **WARNING:** 3.3V logic ONLY — not 5V tolerant on any pin
- **WARNING:** Max 7mA per GPIO pin (much lower than Arduino AVR boards)
- **WARNING:** LiPo connector is JST-PH 2-pin — check polarity before connecting
- **WARNING:** A0 is the ONLY true analog output pin (DAC)
- Pin data from Adafruit Learn guide pinouts page
- A0 has true 10-bit DAC output (not just PWM)
- Native USB support — no separate USB-to-serial chip
- SAMD21 SERCOM system allows flexible peripheral remapping
- All digital pins support PWM output
- [undefined](https://learn.adafruit.com/adafruit-feather-m0-basic-proto/pinouts) (Confidence: high)
- [undefined](https://www.adafruit.com/product/2772) (Confidence: high)

---
Related: [[hardware-components]], [[architecture-decisions]]
