---
description: "Exact physical and electrical specifications for Arduino Nano."
type: domain-knowledge
category: hardware-components
status: verified
tags: [board, hardware, arduino]
---

# Arduino Nano Specifications

This note is the canonical Ars Contexta source of truth for the Arduino Nano, used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** Arduino
- **MPN:** A000005
- **Aliases:** Nano, Nano V3, Nano 3.0, ATmega328P Nano
- **Family:** board-module
- **Description:** Compact ATmega328P board (45×18mm) with 14 digital I/O (6 PWM), 8 analog inputs, and Mini-B USB. Breadboard-friendly DIP form factor.
- **Breadboard Fit:** `native`
- **Breadboard Notes:** DIP form factor fits directly across the center channel of a standard breadboard. 15 pins per side at 0.1" pitch. One of the most breadboard-friendly Arduino boards.

## Exact Physical Dimensions
- **Width:** 18 mm
- **Height:** 45 mm
- **Thickness:** 19 mm
- **Pin Pitch:** 2.54 mm

## Visual Characteristics
- **PCB Color (Hex):** `#00979C`
- **Silkscreen Color (Hex):** `#006468`

## Electrical Constraints
- **Operating Voltage:** 5V
- **Input Voltage Range:** 7V - 12V
- **Max Current Per Pin:** 40 mA
- **Max Total Current:** 200 mA

## Headers & Pinout
### left Header (left side, 15 pins)
- **D1** (communication, 5V): Shared with USB-to-serial
- **D0** (communication, 5V): Shared with USB-to-serial
- **RST** (control, 5V): 
- **GND** (ground, 0V): 
- **D2** (digital, 5V): 
- **D3** (digital, 5V): 
- **D4** (digital, 5V): 
- **D5** (digital, 5V): 
- **D6** (digital, 5V): 
- **D7** (digital, 5V): 
- **D8** (digital, 5V): 
- **D9** (digital, 5V): 
- **D10** (digital, 5V): 
- **D11** (digital, 5V): 
- **D12** (digital, 5V): 

### right Header (right side, 15 pins)
- **VIN** (power, 7V): Input voltage 7-12V recommended
- **GND** (ground, 0V): 
- **RST** (control, 5V): 
- **5V** (power, 5V): 
- **A7** (analog, 5V): 
- **A6** (analog, 5V): 
- **A5** (analog, 5V): 
- **A4** (analog, 5V): 
- **A3** (analog, 5V): 
- **A2** (analog, 5V): 
- **A1** (analog, 5V): 
- **A0** (analog, 5V): 
- **AREF** (control, 5V): 
- **3V3** (power, 3.3V): Max 50mA from on-board regulator
- **D13** (digital, 5V): Connected to on-board LED

## Critical Safety & Verification Notes
- **WARNING:** Total current across all I/O pins must not exceed 200mA
- **WARNING:** 5V logic — level shifting required for 3.3V devices
- **WARNING:** D0/D1 shared with USB serial
- **WARNING:** A6/A7 are analog-input only — cannot be used as digital pins
- **WARNING:** Many clones use CH340 USB chip — may need separate driver
- Pin data cross-referenced with official Arduino Nano datasheet
- A6 and A7 are analog-input only (no digital I/O capability)
- Same ATmega328P as Uno R3 — identical peripheral set, different form factor
- [undefined](https://docs.arduino.cc/resources/datasheets/A000005-datasheet.pdf) (Confidence: high)
- [undefined](https://docs.arduino.cc/hardware/nano) (Confidence: high)
- [undefined](https://store.arduino.cc/products/arduino-nano) (Confidence: high)

---
Related: [[hardware-components]], [[architecture-decisions]]
