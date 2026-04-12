---
description: "The L293D includes internal clamp diodes for inductive kickback, but the L298N does not -- all four motor outputs require fast-recovery external flyback diodes (trr < 200ns) or the output transistors will be destroyed by back-EMF"
type: claim
source: "docs/parts/l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
---

# l298n has no internal flyback diodes unlike l293d making external protection mandatory

Every motor is an inductor. When an H-bridge switches off, the motor's stored magnetic energy has nowhere to go and produces a voltage spike (back-EMF) that can exceed the supply voltage by multiples. Without a clamping path, this spike destroys the driver's output transistors.

The L293D (the L298N's lower-current sibling at 600mA) includes internal clamp diodes on all outputs. This is why L293D-based motor shields like the HW-130 "just work" with motors -- the protection is built in. The L298N omits these diodes entirely, presumably to allow the designer to choose faster or higher-rated external components.

**What to install:** Four fast-recovery diodes (two per H-bridge channel) wired from each motor output to both supply rails -- cathode to VS (motor supply), anode to GND. The diodes must have a reverse recovery time (trr) under 200ns. The 1N4148 (signal diode, trr ~4ns) works for lower currents. For loads above 1A, the 1N5819 Schottky (no recovery time issue) or UF4007 (trr ~75ns) are better choices. The commonly recommended 1N4007 is actually a poor choice here -- its trr of ~2us is too slow for fast PWM switching frequencies.

**Why this is a dangerous beginner trap:** Most L298N tutorials omit the flyback diodes entirely, showing bare motor connections. Pre-assembled L298N modules (the red PCBs from Amazon/AliExpress) sometimes include onboard diodes and sometimes do not -- there is no consistency. A motor that runs fine at low current may destroy the driver when stalled or reversed under load because the back-EMF spike scales with current.

Since [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]], bypass capacitors complement but do not replace flyback diodes -- the cap absorbs high-frequency noise while the diodes clamp the large inductive spikes.

---

Source: [[l298n-dual-h-bridge-motor-driver-drives-2-dc-motors-or-1-stepper-up-to-46v-2a]]

Relevant Notes:
- [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]] -- caps and diodes serve complementary protection roles
- [[driver-ic-selection-follows-from-actuator-type-not-power-rating-alone]] -- the L293D's built-in diodes make it simpler for beginners despite lower current

Topics:
- [[actuators]]
- [[eda-fundamentals]]
