---
description: "Exact physical and electrical specifications for Raspberry Pi Pico."
type: domain-knowledge
category: hardware-components
status: verified
tags: [board, hardware, raspberry pi]
topics:
  - "[[hardware-components-mcu]]"
  - "[[hardware-components]]"
  - "[[eda-arm-constraints]]"
---

# Raspberry Pi Pico Specifications

This note is the canonical Ars Contexta source of truth for the Raspberry Pi Pico, used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** Raspberry Pi
- **MPN:** SC0915
- **Aliases:** Pico, RPi Pico, RP2040 Pico, Raspberry Pi Pico
- **Family:** board-module
- **Description:** RP2040-based board with dual-core Cortex-M0+ at 133MHz, 264KB SRAM, 2MB flash, 26 GPIO, 3 ADC, 2 UART, 2 SPI, 2 I2C, 16 PWM channels. DIP form factor with castellated pads.
- **Breadboard Fit:** `native`
- **Breadboard Notes:** DIP form factor (21mm wide) fits across the center channel of a standard breadboard. 20 pins per side at 0.1" pitch. Castellated pads allow soldering as a module.

## Exact Physical Dimensions
- **Width:** 21 mm
- **Height:** 51 mm
- **Thickness:** 3.8 mm
- **Pin Pitch:** 2.54 mm

## Visual Characteristics
- **PCB Color (Hex):** `#1b5e20`
- **Silkscreen Color (Hex):** `#14532d`

## Electrical Constraints
- **Operating Voltage:** 3.3V
- **Input Voltage Range:** 1.8V - 5.5V
- **Max Current Per Pin:** 12 mA
- **Max Total Current:** 50 mA

## Headers & Pinout
### left Header (left side, 20 pins)
- **GP0** (digital, 3.3V): 
- **GP1** (digital, 3.3V): 
- **GND** (ground, 0V): 
- **GP2** (digital, 3.3V): 
- **GP3** (digital, 3.3V): 
- **GP4** (digital, 3.3V): 
- **GP5** (digital, 3.3V): 
- **GND** (ground, 0V): 
- **GP6** (digital, 3.3V): 
- **GP7** (digital, 3.3V): 
- **GP8** (digital, 3.3V): 
- **GP9** (digital, 3.3V): 
- **GND** (ground, 0V): 
- **GP10** (digital, 3.3V): 
- **GP11** (digital, 3.3V): 
- **GP12** (digital, 3.3V): 
- **GP13** (digital, 3.3V): 
- **GND** (ground, 0V): 
- **GP14** (digital, 3.3V): 
- **GP15** (digital, 3.3V): 

### right Header (right side, 20 pins)
- **VBUS** (power, 5V): USB 5V — only available when USB connected
- **VSYS** (power, 5V): Main system power input 1.8-5.5V
- **GND** (ground, 0V): 
- **3V3_EN** (control, 3.3V): Pull LOW to disable 3.3V regulator
- **3V3(OUT)** (power, 3.3V): Max 300mA output from on-board regulator
- **ADC_VREF** (control, 3.3V): 
- **GP28** (analog, 3.3V): 
- **AGND** (ground, 0V): 
- **GP27** (analog, 3.3V): 
- **GP26** (analog, 3.3V): 
- **RUN** (control, 3.3V): Reset pin — pull LOW to reset RP2040
- **GP22** (digital, 3.3V): 
- **GND** (ground, 0V): 
- **GP21** (digital, 3.3V): 
- **GP20** (digital, 3.3V): 
- **GP19** (digital, 3.3V): 
- **GP18** (digital, 3.3V): 
- **GND** (ground, 0V): 
- **GP17** (digital, 3.3V): 
- **GP16** (digital, 3.3V): 

## Critical Safety & Verification Notes
- **WARNING:** 3.3V logic ONLY — do NOT apply 5V to GPIO pins
- **WARNING:** Max 12mA per GPIO pin (not 40mA like Arduino)
- **WARNING:** Total GPIO current should not exceed ~50mA
- **WARNING:** BOOTSEL button must be held during power-on to enter USB mass storage mode for flashing
- **WARNING:** No EEPROM — use flash storage for persistent data
- Pin data cross-referenced with official Pico-R3-A4-Pinout.pdf
- RP2040 has flexible IO: nearly all GPIO functions are remappable via PIO
- 3 ADC channels on GP26-GP28 (12-bit), plus internal temperature sensor on ADC4
- USB 1.1 with device and host support
- [undefined](https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf) (Confidence: high)
- [undefined](https://datasheets.raspberrypi.com/pico/Pico-R3-A4-Pinout.pdf) (Confidence: high)
- [undefined](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html) (Confidence: high)

---
Related: [[hardware-components]], [[architecture-decisions]]
