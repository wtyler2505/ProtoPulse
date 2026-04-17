---
description: "Exact physical and electrical specifications for Arduino Mega 2560 R3."
type: domain-knowledge
category: hardware-components
status: verified
tags: [board, hardware, arduino]
---

# Arduino Mega 2560 R3 Specifications

This note is the canonical Ars Contexta source of truth for the Arduino Mega 2560 R3, used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** Arduino
- **MPN:** A000067
- **Aliases:** Arduino Mega 2560, Arduino Mega, Mega 2560, Mega 2560 R3, Mega2560, ATmega2560
- **Family:** board-module
- **Description:** Arduino Mega 2560 R3 — ATmega2560-based microcontroller board with 54 digital I/O pins (15 PWM), 16 analog inputs, 4 hardware UARTs, SPI, I2C, and 256 KB flash. The most pin-rich board in the classic Arduino line.
- **Breadboard Fit:** `not_breadboard_friendly`
- **Breadboard Notes:** At 101.6mm x 53.34mm, the Mega is far too wide for any standard breadboard. Use jumper wires from the female headers to a breadboard, or mount on a dedicated prototyping baseplate.

## Exact Physical Dimensions
- **Width:** 101.6 mm
- **Height:** 53.34 mm
- **Thickness:** 15.3 mm
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
### power Header (left side, 8 pins)
- **VIN** (power, 7V): Input voltage 7-12V recommended, 6-20V absolute max
- **GND** (ground, 0V): 
- **GND** (ground, 0V): 
- **5V** (power, 5V): 
- **3.3V** (power, 3.3V): Max 50mA from on-board regulator
- **RESET** (control, 5V): 
- **IOREF** (power, 5V): Reference voltage for shields
- **NC** (nc, 0V): 

### comm Header (right side, 10 pins)
- **0** (communication, 5V): Shared with USB-to-serial — avoid for general I/O when using Serial Monitor
- **1** (communication, 5V): Shared with USB-to-serial — avoid for general I/O when using Serial Monitor
- **14** (communication, 5V): 
- **15** (communication, 5V): 
- **16** (communication, 5V): 
- **17** (communication, 5V): 
- **18** (communication, 5V): 
- **19** (communication, 5V): 
- **20** (communication, 5V): Has external 10K pull-up — not available for interrupts while using I2C
- **21** (communication, 5V): Has external 10K pull-up — not available for interrupts while using I2C

### digital-low Header (right side, 14 pins)
- **2** (digital, 5V): 
- **3** (digital, 5V): 
- **4** (digital, 5V): 
- **5** (digital, 5V): 
- **6** (digital, 5V): 
- **7** (digital, 5V): 
- **8** (digital, 5V): 
- **9** (digital, 5V): 
- **10** (digital, 5V): 
- **11** (digital, 5V): 
- **12** (digital, 5V): 
- **13** (digital, 5V): Connected to on-board LED
- **GND** (ground, 0V): 
- **AREF** (control, 5V): External analog reference voltage — do not exceed operating voltage

### digital-high Header (right side, 28 pins)
- **22** (digital, 5V): 
- **23** (digital, 5V): 
- **24** (digital, 5V): 
- **25** (digital, 5V): 
- **26** (digital, 5V): 
- **27** (digital, 5V): 
- **28** (digital, 5V): 
- **29** (digital, 5V): 
- **30** (digital, 5V): 
- **31** (digital, 5V): 
- **32** (digital, 5V): 
- **33** (digital, 5V): 
- **34** (digital, 5V): 
- **35** (digital, 5V): 
- **36** (digital, 5V): 
- **37** (digital, 5V): 
- **38** (digital, 5V): 
- **39** (digital, 5V): 
- **40** (digital, 5V): 
- **41** (digital, 5V): 
- **42** (digital, 5V): 
- **43** (digital, 5V): 
- **44** (digital, 5V): 
- **45** (digital, 5V): 
- **46** (digital, 5V): 
- **47** (digital, 5V): 
- **48** (digital, 5V): 
- **49** (digital, 5V): 

### analog Header (left side, 16 pins)
- **A0** (analog, 5V): 
- **A1** (analog, 5V): 
- **A2** (analog, 5V): 
- **A3** (analog, 5V): 
- **A4** (analog, 5V): 
- **A5** (analog, 5V): 
- **A6** (analog, 5V): 
- **A7** (analog, 5V): 
- **A8** (analog, 5V): 
- **A9** (analog, 5V): 
- **A10** (analog, 5V): 
- **A11** (analog, 5V): 
- **A12** (analog, 5V): 
- **A13** (analog, 5V): 
- **A14** (analog, 5V): 
- **A15** (analog, 5V): 

### spi Header (right side, 4 pins)
- **50** (communication, 5V): 
- **51** (communication, 5V): 
- **52** (communication, 5V): 
- **53** (communication, 5V): Must be kept as OUTPUT to stay in SPI master mode

### icsp Header (top side, 6 pins)
- **MOSI** (communication, 5V): 
- **5V** (power, 5V): 
- **MISO** (communication, 5V): 
- **SCK** (communication, 5V): 
- **RESET** (control, 5V): 
- **GND** (ground, 0V): 

## Critical Safety & Verification Notes
- **WARNING:** Do not exceed 20V on VIN — 7-12V recommended for safe regulator operation.
- **WARNING:** Pin 53 (SS) must remain OUTPUT for SPI master mode to work correctly.
- **WARNING:** Avoid using pins 0/1 for general I/O when USB Serial is in use.
- Pin 7-to-8 gap is 160 mil (not standard 100 mil) for Uno shield compatibility.
- Pins 4 and 13 run PWM at 980 Hz (Timer0); all other PWM pins default to 490 Hz.
- Pin 13 has an on-board LED that may affect circuits expecting a clean digital output.
- SPI pins 50-53 are duplicated on the ICSP header.
- I2C pins 20/21 have 10K pull-up resistors that cannot be disabled.
- Total I/O current across all pins must not exceed 200 mA.
- [undefined](https://docs.arduino.cc/resources/datasheets/A000067-datasheet.pdf) (Confidence: high)
- [undefined](https://docs.arduino.cc/hardware/mega-2560/) (Confidence: high)
- [undefined](https://store.arduino.cc/products/arduino-mega-2560-rev3) (Confidence: high)

---
Related: [[hardware-components]], [[architecture-decisions]]
