---
description: "Exact physical and electrical specifications for Arduino Uno R3."
type: domain-knowledge
category: hardware-components
status: verified
tags: [board, hardware, arduino]
topics:
  - "[[hardware-components-mcu]]"
  - "[[hardware-components]]"
  - "[[eda-avr-constraints]]"
---

# Arduino Uno R3 Specifications

This note is the canonical Ars Contexta source of truth for the Arduino Uno R3, used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** Arduino
- **MPN:** A000066
- **Aliases:** Arduino Uno, Uno R3, Uno Rev3, ATmega328P board
- **Family:** board-module
- **Description:** ATmega328P-based board with 14 digital I/O (6 PWM), 6 analog inputs, 16 MHz resonator, USB-B, and power jack. The most popular Arduino board for beginners.
- **Breadboard Fit:** `not_breadboard_friendly`
- **Breadboard Notes:** At 68.6mm wide, the Uno is too wide for a standard breadboard. Use jumper wires from the female headers to the breadboard.

## Exact Physical Dimensions
- **Width:** 68.6 mm
- **Height:** 53.4 mm
- **Thickness:** 15 mm
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
### power Header (left side, 7 pins)
- **IOREF** (power, 5V): Reference voltage for shields
- **RESET** (control, 5V): 
- **3.3V** (power, 3.3V): Max 50mA from on-board regulator
- **5V** (power, 5V): 
- **GND** (ground, 0V): 
- **GND** (ground, 0V): 
- **VIN** (power, 7V): Input voltage 7-12V recommended, 6-20V absolute max

### analog Header (left side, 6 pins)
- **A0** (analog, 5V): 
- **A1** (analog, 5V): 
- **A2** (analog, 5V): 
- **A3** (analog, 5V): 
- **A4** (analog, 5V): 
- **A5** (analog, 5V): 

### digital Header (right side, 8 pins)
- **0** (communication, 5V): Shared with USB-to-serial — avoid for general I/O when using Serial Monitor
- **1** (communication, 5V): Shared with USB-to-serial — avoid for general I/O when using Serial Monitor
- **2** (digital, 5V): 
- **3** (digital, 5V): 
- **4** (digital, 5V): 
- **5** (digital, 5V): 
- **6** (digital, 5V): 
- **7** (digital, 5V): 

### digital-high Header (right side, 10 pins)
- **8** (digital, 5V): 
- **9** (digital, 5V): 
- **10** (digital, 5V): 
- **11** (digital, 5V): 
- **12** (digital, 5V): 
- **13** (digital, 5V): Connected to on-board LED — may affect external circuits
- **GND** (ground, 0V): 
- **AREF** (control, 5V): External ADC reference voltage — do not exceed VCC
- **SDA** (communication, 5V): 
- **SCL** (communication, 5V): 

## Critical Safety & Verification Notes
- **WARNING:** Total current across all I/O pins must not exceed 200mA
- **WARNING:** 5V logic — level shifting required for 3.3V devices
- **WARNING:** D0/D1 shared with USB serial — avoid using with Serial Monitor active
- **WARNING:** D13 has on-board LED that may interfere with external circuits
- Pin data cross-referenced with official Arduino UNO R3 datasheet and pinout PDF
- PWM frequencies verified against ATmega328P Timer assignments
- I2C pins verified: A4/A5 share I2C with dedicated SDA/SCL pins added in R3 revision
- [undefined](https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf) (Confidence: high)
- [undefined](https://content.arduino.cc/assets/Pinout-UNOrev3_latest.pdf) (Confidence: high)
- [undefined](https://docs.arduino.cc/hardware/uno-rev3) (Confidence: high)

---
Related: [[hardware-components]], [[architecture-decisions]]
