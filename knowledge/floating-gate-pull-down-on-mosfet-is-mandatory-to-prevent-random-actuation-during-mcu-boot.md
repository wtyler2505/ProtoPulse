---
description: "A MOSFET gate is a capacitor that holds charge -- without a 10K pull-down to source, the gate floats during MCU boot/reset and the load turns on randomly, which for a motor or solenoid is dangerous"
type: claim
source: "docs/parts/p30n06le-n-channel-logic-level-mosfet-60v-30a.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[passives]]"
  - "[[eda-fundamentals]]"
related_components:
  - "p30n06le"
---

# Floating gate pull-down on MOSFET is mandatory to prevent random actuation during MCU boot

A MOSFET gate is electrically a capacitor -- it has essentially infinite input impedance. When the MCU is in reset, booting, uploading firmware, or has crashed, GPIO pins are typically high-impedance (tri-state). Any charge on the gate capacitor from the previous state, electrical noise, static discharge, or capacitive coupling from nearby traces can hold the gate above threshold voltage and turn the MOSFET on.

For a 30A MOSFET switching a motor, "on during boot" means the motor runs uncontrolled for the entire boot duration (1-5 seconds for Arduino, up to 15 seconds for an ESP32 connecting to WiFi). On a rover, this means it lurches forward unexpectedly. On a CNC machine, it means the spindle starts. On a heating element, it means uncontrolled heating.

**The fix:** A 10K ohm resistor from Gate to Source (ground). This resistor:
- Provides a discharge path for the gate capacitor when the GPIO is high-impedance
- Holds the gate at 0V (off) whenever the MCU is not actively driving the gate HIGH
- Is small enough that the GPIO can easily override it (5V / 10K = 0.5mA, well within any MCU's source capability)
- Is large enough not to waste power during normal HIGH drive (5V / 10K = 0.5mA = 2.5mW)

**Additional protection for inductive loads:** For motors, solenoids, and relay coils, a flyback diode across the load (cathode to V+, anode to drain) is also required. When the MOSFET turns off, the inductive load generates a voltage spike (back-EMF) that can exceed the MOSFET's 60V Vds rating and destroy it. The diode clamps this spike.

**ProtoPulse implication:** Any MOSFET in a schematic should trigger a DRC check for: (1) gate pull-down resistor present, (2) flyback diode on inductive loads, and (3) gate series resistor for EMI reduction on long gate traces (optional but recommended).

---

Relevant Notes:
- [[logic-level-mosfet-gate-threshold-below-3v-eliminates-need-for-gate-driver-circuit]] -- the logic-level gate that makes direct GPIO drive possible
- [[relay-coil-is-an-inductor-that-generates-destructive-back-emf-spikes-when-de-energized]] -- flyback diode requirement for inductive loads applies equally to MOSFET-switched loads
- [[low-side-mosfet-switching-puts-load-between-supply-and-drain-with-source-at-ground]] -- the circuit topology where this pull-down is placed

Topics:
- [[power-systems]]
- [[passives]]
- [[eda-fundamentals]]
