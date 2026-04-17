---
description: "Exact physical and electrical specifications for RioRand KJL-01 BLDC Controller."
type: domain-knowledge
category: hardware-components
status: verified
tags: [board, hardware, riorand]
---

# RioRand KJL-01 BLDC Controller Specifications

This note is the canonical Ars Contexta source of truth for the RioRand KJL-01 BLDC Controller, used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** RioRand
- **MPN:** KJL-01
- **Aliases:** RioRand Motor Controller, RioRand BLDC Controller, RioRand 6-60V Controller, RioRand 350W Controller, KJL-01, RioRand B087M2378D
- **Family:** driver
- **Description:** RioRand KJL-01 — 350W 6-60V 3-phase PWM DC brushless motor speed controller with hall sensor feedback. Supports 120 degree electrical angle BLDC motors. 16A continuous / 20A peak. Screw terminal connections for power, motor phases, hall sensors, and control signals (speed, stop, brake, direction). On-board potentiometer for manual speed adjustment. Overcurrent protection.
- **Breadboard Fit:** `not_breadboard_friendly`
- **Breadboard Notes:** Screw terminal connections and high-current traces make this controller completely unsuitable for breadboard mounting. Connect via jumper wires from screw terminals to breadboard for signal-level control lines (SPEED, STOP, BRAKE, DIR) only. Power and motor phase connections must use appropriately rated wire.

## Exact Physical Dimensions
- **Width:** 75 mm
- **Height:** 50 mm
- **Thickness:** 2 mm
- **Pin Pitch:** 5.08 mm

## Visual Characteristics
- **PCB Color (Hex):** `#dc2626`
- **Silkscreen Color (Hex):** `#b91c1c`

## Electrical Constraints
- **Operating Voltage:** 5V
- **Input Voltage Range:** 6V - 60V
- **Max Current Per Pin:** 16000 mA
- **Max Total Current:** 20000 mA

## Headers & Pinout
### power-input Header (left side, 2 pins)
- **V+** (power, 60V): Main DC power input: 6-60V. Match to motor voltage rating. Observe polarity — no reverse protection on most units.
- **V-** (ground, 0V): Power ground return. Use heavy gauge wire rated for motor current (16A continuous).

### motor-output Header (right side, 3 pins)
- **U** (power, 60V): Motor phase U — high current output. Match color coding to motor wires. Wrong phase order reverses direction or causes vibration.
- **V** (power, 60V): Motor phase V — high current output.
- **W** (power, 60V): Motor phase W — high current output.

### hall-sensor Header (bottom side, 5 pins)
- **Hall +5V** (power, 5V): 5V supply for hall sensors. Usually red wire from motor hall connector.
- **Hall GND** (ground, 0V): Ground for hall sensors. Usually black wire from motor hall connector.
- **Ha** (communication, 5V): Hall sensor A signal. Usually yellow wire. 120 degree electrical angle.
- **Hb** (communication, 5V): Hall sensor B signal. Usually green wire.
- **Hc** (communication, 5V): Hall sensor C signal. Usually blue wire.

### control Header (bottom side, 4 pins)
- **VR/Speed** (control, 5V): 0-5V analog input for external speed control. Overrides on-board potentiometer when connected. Use a 0-5V signal only.
- **STOP** (control, 5V): Active LOW — connect to GND to stop motor. Normally open (motor runs). Can be driven by Arduino digital output (set LOW to stop, leave floating or HIGH to run).
- **BRAKE** (control, 5V): Active HIGH — connect to 5V to engage brake. Normally open (no brake). Provides dynamic braking by shorting motor phases.
- **DIR** (control, 5V): Direction control — connect to GND to reverse motor direction. Normally open (forward). Can be driven by Arduino digital output.

## Critical Safety & Verification Notes
- **WARNING:** No reverse polarity protection — double-check V+/V- before applying power.
- **WARNING:** Motor phase wiring order matters — wrong order causes vibration or reverse rotation, not damage.
- **WARNING:** Hall sensor wiring order matters — wrong order causes erratic behavior. If motor runs rough, try swapping Ha and Hc.
- **WARNING:** Control signals are 5V logic — safe to drive directly from Arduino (5V) or ESP32 (3.3V, but check threshold).
- **WARNING:** Keep high-current wires (power, motor phases) away from signal wires (hall, control) to avoid EMI interference.
- **WARNING:** This controller has no heatsink — add thermal management for sustained loads above 10A.
- Terminal layout is based on Amazon listing + standard BLDC controller conventions — no official manufacturer datasheet found.
- The KJL-01 model designation is visible on the PCB silkscreen in Amazon listing photos.
- Control terminal voltage levels (5V logic, active-low STOP, active-high BRAKE) are standard for this class of Chinese BLDC controllers.
- Physical dimensions are approximate — measured from Amazon listing photos, not a mechanical drawing.
- The on-board potentiometer overrides the external SPEED input when no external signal is connected.
- Overcurrent protection threshold is not documented — exercise caution with motor sizing.
- [undefined](https://www.amazon.com/RioRand-6-60V-Brushless-Electric-Controller/dp/B087M2378D) (Confidence: medium)
- [undefined](undefined) (Confidence: medium)

---
Related: [[hardware-components]], [[architecture-decisions]]
