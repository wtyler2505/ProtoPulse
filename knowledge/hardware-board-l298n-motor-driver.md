---
description: "Exact physical and electrical specifications for L298N Dual Motor Driver Module."
type: domain-knowledge
category: hardware-components
status: verified
tags: [board, hardware, generic]
---

# L298N Dual Motor Driver Module Specifications

This note is the canonical Ars Contexta source of truth for the L298N Dual Motor Driver Module, used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** Generic
- **MPN:** L298N-MOD
- **Aliases:** l298n module, h-bridge module, dual motor driver
- **Family:** board-module
- **Description:** Classic L298N dual H-bridge motor driver module. Controls two DC motors or one bipolar stepper motor. Includes an onboard 5V regulator.
- **Breadboard Fit:** `not_breadboard_friendly`
- **Breadboard Notes:** Module has screw terminals and male headers, designed for jumper wire connections, not direct breadboard insertion.

## Exact Physical Dimensions
- **Width:** 43 mm
- **Height:** 43 mm
- **Thickness:** 1.6 mm
- **Pin Pitch:** 2.54 mm

## Visual Characteristics
- **PCB Color (Hex):** `#dc2626`
- **Silkscreen Color (Hex):** `#b91c1c`

## Electrical Constraints
- **Operating Voltage:** 5V
- **Input Voltage Range:** 5V - 35V
- **Max Current Per Pin:** 2000 mA
- **Max Total Current:** 4000 mA

## Headers & Pinout
### power Header (bottom side, 3 pins)
- **12V** (power, 12V): Main motor power input. Technically accepts up to 35V, but typically labeled 12V. Remove 5V-EN jumper if supplying >12V to avoid burning the onboard regulator.
- **GND** (ground, 0V): Common ground. Must be connected to the microcontroller ground.
- **5V** (power, 5V): If 5V-EN jumper is present, this is a 5V OUTPUT from the onboard regulator. If jumper is removed, this is a 5V INPUT to power the logic logic.

### motor_a Header (left side, 2 pins)
- **OUT1** (power, 12V): Motor A output 1
- **OUT2** (power, 12V): Motor A output 2

### motor_b Header (right side, 2 pins)
- **OUT3** (power, 12V): Motor B output 1
- **OUT4** (power, 12V): Motor B output 2

### logic Header (bottom side, 6 pins)
- **ENA** (control, 5V): Enable A (PWM for Motor A speed). Keep jumper on for full speed.
- **IN1** (control, 5V): Direction control 1 for Motor A
- **IN2** (control, 5V): Direction control 2 for Motor A
- **IN3** (control, 5V): Direction control 1 for Motor B
- **IN4** (control, 5V): Direction control 2 for Motor B
- **ENB** (control, 5V): Enable B (PWM for Motor B speed). Keep jumper on for full speed.

## Critical Safety & Verification Notes
- **WARNING:** DO NOT supply more than 12V if the 5V-EN jumper is installed. The onboard regulator will overheat.
- **WARNING:** L298N has significant voltage drop (up to 2V-4V) across the transistors. A 12V supply might only deliver 9-10V to the motors.
- Logic pins ENA and ENB are typically jumpered to 5V for 100% duty cycle.
- Common issue: users forget to connect common ground.
- [L298 Datasheet](https://www.st.com/resource/en/datasheet/l298.pdf) (Confidence: high)

---
Related: [[hardware-components]], [[architecture-decisions]]
