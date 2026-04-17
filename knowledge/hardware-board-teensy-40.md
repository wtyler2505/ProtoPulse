---
description: "Exact physical and electrical specifications for Teensy 4.0."
type: domain-knowledge
category: hardware-components
status: verified
tags: [board, hardware, pjrc]
---

# Teensy 4.0 Specifications

This note is the canonical Ars Contexta source of truth for the Teensy 4.0, used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** PJRC
- **MPN:** DEV-15583
- **Aliases:** Teensy 4, Teensy4.0, PJRC Teensy 4.0, iMXRT1062
- **Family:** board-module
- **Description:** NXP iMXRT1062 ARM Cortex-M7 at 600MHz with 1MB RAM, 2MB flash. DIP form factor (35.6×17.8mm), same size as Teensy 3.2. USB native, 40 digital I/O, 14 analog, multiple serial/SPI/I2C.
- **Breadboard Fit:** `native`
- **Breadboard Notes:** DIP form factor (17.8mm wide) fits across the center channel of a standard breadboard. 14 pins per side at 0.1" pitch. Castellated pads on bottom for additional I/O.

## Exact Physical Dimensions
- **Width:** 17.78 mm
- **Height:** 35.56 mm
- **Thickness:** 4.6 mm
- **Pin Pitch:** 2.54 mm

## Visual Characteristics
- **PCB Color (Hex):** `#166534`
- **Silkscreen Color (Hex):** `#14532d`

## Electrical Constraints
- **Operating Voltage:** 3.3V
- **Input Voltage Range:** 3.6V - 5.5V
- **Max Current Per Pin:** 10 mA
- **Max Total Current:** 100 mA

## Headers & Pinout
### left Header (left side, 14 pins)
- **GND** (ground, 0V): 
- **0** (communication, 3.3V): 
- **1** (communication, 3.3V): 
- **2** (digital, 3.3V): 
- **3** (digital, 3.3V): 
- **4** (digital, 3.3V): 
- **5** (digital, 3.3V): 
- **6** (digital, 3.3V): 
- **7** (communication, 3.3V): 
- **8** (communication, 3.3V): 
- **9** (digital, 3.3V): 
- **10** (digital, 3.3V): 
- **11** (digital, 3.3V): 
- **12** (digital, 3.3V): 

### right Header (right side, 14 pins)
- **VIN** (power, 5V): 3.6V to 5.5V input
- **GND** (ground, 0V): 
- **3.3V** (power, 3.3V): 250mA max from on-board regulator
- **23** (analog, 3.3V): 
- **22** (analog, 3.3V): 
- **21** (analog, 3.3V): 
- **20** (analog, 3.3V): 
- **19** (communication, 3.3V): 
- **18** (communication, 3.3V): 
- **17** (analog, 3.3V): 
- **16** (analog, 3.3V): 
- **15** (analog, 3.3V): 
- **14** (analog, 3.3V): 
- **13** (digital, 3.3V): Connected to on-board LED

## Critical Safety & Verification Notes
- **WARNING:** 3.3V logic ONLY — NOT 5V tolerant on ANY pin
- **WARNING:** Max 10mA per GPIO pin (lower than most Arduino boards)
- **WARNING:** VIN accepts 3.6-5.5V — do not exceed 5.5V
- **WARNING:** No on-board voltage regulator for barrel jack — must use regulated supply
- **WARNING:** Bottom pads require soldering for access — not available via breadboard
- Pin data from PJRC official pinout page and tech specs
- Header pins only (28 edge pins) — bottom pads (10 additional) and program header (6) not included
- 600MHz ARM Cortex-M7 — fastest Arduino-compatible board
- All digital pins capable of PWM via FlexPWM or QuadTimer
- USB is native (not FTDI/CH340) — appears as HID/Serial/MIDI natively
- [undefined](https://www.pjrc.com/store/teensy40.html) (Confidence: high)
- [undefined](https://www.pjrc.com/teensy/pinout.html) (Confidence: high)
- [undefined](https://www.pjrc.com/teensy/techspecs.html) (Confidence: high)

---
Related: [[hardware-components]], [[architecture-decisions]]
