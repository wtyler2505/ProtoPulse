---
description: "Exact physical and electrical specifications for HC-SR04 Ultrasonic Sensor."
type: domain-knowledge
category: hardware-components
status: verified
tags: [board, hardware, generic]
topics:
  - "[[hardware-components-sensors]]"
  - "[[hardware-components]]"
  - "[[eda-hardware-components]]"
---

# HC-SR04 Ultrasonic Sensor Specifications

This note is the canonical Ars Contexta source of truth for the HC-SR04 Ultrasonic Sensor, used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** Generic
- **MPN:** HC-SR04
- **Aliases:** ultrasonic sensor, hcsr04, distance sensor
- **Family:** sensor-module
- **Description:** A 5V ultrasonic distance measuring module providing 2cm-400cm non-contact measurement functionality.
- **Breadboard Fit:** `native`
- **Breadboard Notes:** 4-pin header can be inserted directly into a breadboard.

## Exact Physical Dimensions
- **Width:** 45 mm
- **Height:** 20 mm
- **Thickness:** 15 mm
- **Pin Pitch:** 2.54 mm

## Visual Characteristics
- **PCB Color (Hex):** `#1d4ed8`
- **Silkscreen Color (Hex):** `#1e3a8a`

## Electrical Constraints
- **Operating Voltage:** 5V
- **Input Voltage Range:** 4.5V - 5.5V
- **Max Current Per Pin:** 20 mA
- **Max Total Current:** 20 mA

## Headers & Pinout
### main Header (bottom side, 4 pins)
- **VCC** (power, 5V): Strictly 5V module. Do not use 3.3V.
- **Trig** (control, 5V): Requires a 10us HIGH pulse to trigger measurement
- **Echo** (control, 5V): Outputs a 5V HIGH pulse proportional to distance. Use a voltage divider if connecting to a 3.3V microcontroller.
- **GND** (ground, 0V): 

## Critical Safety & Verification Notes
- **WARNING:** Echo pin outputs 5V. Connecting directly to 3.3V logic may damage the microcontroller.
- The standard HC-SR04 is 5V only. There are variants like HC-SR04+ or RCWL-1601 that support 3.3V, but this definition assumes the classic 5V part.
- [HC-SR04 User Manual](https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf) (Confidence: high)

---
Related: [[hardware-components]], [[architecture-decisions]]
