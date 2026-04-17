---
description: "Commercial-grade treadmills, ellipticals, and stationary bikes split the user interface panel (buttons, LEDs, MCU) from the motor power controller into two enclosures connected by a ribbon cable — this physical separation exists because the motor stage is a high-current EMI source and the HMI is a low-voltage signal integrity zone, and mixing them on one board would require expensive shielding that a cable-isolated split avoids"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[actuators]]"
---

# Commercial exercise equipment splits HMI panel from motor controller via ribbon cable because panel electronics and motor power have incompatible noise budgets

A Cybex or Precor commercial treadmill has a specific architecture worth recognizing:

**Front (HMI) enclosure:**
- Microcontroller (often a mid-range MCU like a PIC18 or STM32)
- Button matrix for speed, incline, program selection
- 7-segment or VFD displays for speed/grade/distance readouts
- LED bar graphs for visual feedback
- Low voltage only (5V or 3.3V logic; 12V LED drivers max)

**Frame (power) enclosure:**
- Step-down transformer (mains-to-low-voltage for the HMI)
- SCR or IGBT motor controller (drives 2-5 HP AC or DC motor)
- Incline motor driver (smaller DC motor with limit switches)
- Mains-rated fuses, EMI filter, contactor for motor power
- Earthed metal enclosure for safety

**Connection:** One ribbon cable or D-sub harness carrying:
- DC power from the frame's transformer to the HMI
- Control signals (speed setpoint, start/stop) from HMI to controller
- Feedback signals (actual speed from motor tach, safety key status) from controller to HMI

**Why this architecture dominates commercial equipment:**

1. **Noise budget mismatch** — the motor stage switches 15A+ at PWM frequencies, radiating significant EMI. Putting the MCU and its display driver ICs near that switching would require heavy shielding or would produce visible display corruption and button-misread issues.

2. **Safety separation** — the HMI is a user-contact surface. Keeping mains-voltage components physically far from the HMI makes safety certification (UL, CE) easier because creepage and clearance distances are automatic.

3. **Maintenance partitioning** — the HMI is replaced by a different service path than the motor controller. Most HMI failures (button membrane wear, LCD failure) don't require mains-qualified service. Most controller failures (motor driver MOSFET/IGBT failure) require a qualified electrician. Separating boards separates service categories.

4. **Thermal isolation** — the motor controller runs hot (SCR heatsinks, IGBT heatsinks) and often has its own fan. The HMI runs cold. Co-locating them would require managing heat flow from the hot side away from the cold side's sensitive MCU.

**Recognition pattern for reverse-engineering commercial equipment:**
If you see a ribbon cable of 10-26 conductors leaving the HMI panel and going to a boxed controller behind the frame, you're looking at this architecture. The ribbon pinout is typically:
- 2-4 conductors for DC power (5V, 12V, GND)
- 4-8 conductors for I2C/SPI/UART between MCU and controller
- 2-4 conductors for safety-key/interlock signals

**Hobbyist implication:**
This same split is the right architecture for ANY project mixing an MCU with a high-power motor drive — especially battery-powered scooters, e-bikes, and heavy robotics. Do NOT put the Arduino on the same board as the MOSFETs. Run a cable.

---

Source: docs_and_data

Relevant Notes:
- [[100uf-capacitor-on-arduino-5v-input-absorbs-motor-switching-emi-that-causes-mcu-resets]] — the EMI mechanism this architecture avoids
- [[cytron-md25hv-completes-the-brushed-dc-driver-voltage-ladder-tb6612-at-13v-l298n-at-46v-md25hv-at-58v-with-25a-continuous]] — the motor controller stage in the hobbyist version of this split

Topics:
- [[power-systems]]
- [[actuators]]
