---
description: "An AC synchronous motor has a rotor (permanent-magnet or reluctance) that locks onto the rotating stator field and runs at exactly the synchronous speed determined by line frequency and pole count — with zero slip, no feedback loop, and no speed drift over time, which is why they drive wall clocks, microwave turntables, and any timing application needing long-term accuracy"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[actuators]]"
---

# AC synchronous motor locks rotor speed to line frequency, making it the standard choice for wall-clock precision timing without feedback

A synchronous motor is structurally different from an induction motor: the rotor contains permanent magnets (or uses reluctance geometry) that magnetically "lock" onto the stator's rotating field. There is zero slip — the rotor spins at exactly the synchronous speed determined by AC frequency and motor pole count.

**Synchronous speed formula:**
- N_sync (RPM) = (120 × frequency Hz) / poles
- 60Hz, 2-pole = 3600 RPM
- 60Hz, 4-pole = 1800 RPM
- 60Hz, many poles (small sync motor) = 60-600 RPM typical

**Key behavioral properties:**
- **Zero slip** — speed does NOT drop under increasing load; it stays locked until the load exceeds pull-out torque, at which point the motor stalls rather than slowing
- **No feedback needed** — the utility grid's frequency accuracy is extremely good (long-term 60.00 Hz ± 0.02%, regulated by the grid operator), making synchronous motor output accuracy better than most quartz crystals over days/weeks
- **Speed is untunable** — you cannot PWM it or vary its speed without a variable-frequency drive (VFD)

**Why synchronous motors dominate timing applications:**
- **Wall clocks and microwave timers** — utility frequency is accurate to within a few seconds per day
- **Microwave oven turntables** — cheap, reliable, runs forever, no speed control needed
- **Stage lighting disco balls, display rotators** — constant speed is the requirement
- **Chemical dosing pumps** with gearbox output — precise volume-per-revolution depends on constant speed

**Contrast with induction motors:**
| Aspect | Synchronous | Induction |
|--------|------------|-----------|
| Slip | Zero | 2-5% at full load |
| Speed vs load | Constant until pullout | Drops with load |
| Rotor | Magnets / reluctance | Squirrel cage |
| Starting torque | Depends on design | Generally higher |
| Efficiency | Higher | Lower |
| Cost | Higher (magnets) | Lower |

**Typical small sync motor (like TDY 50) design:**
- 4W power, 6 RPM output → driving a timer cam, display, or microwave turntable
- Many poles in a small package + internal gearbox
- Self-starting via shaded-pole or hysteresis synchronous design
- Two-wire connection; polarity-free (AC)
- 50Hz version runs at 5/6 the speed of 60Hz version — synchronous motors are frequency-specific

**Arduino/MCU integration:**
Synchronous motors cannot be driven from low-voltage DC logic. The control interface is simply "mains on" or "mains off," which requires a relay (mechanical or SSR) controlled by the MCU. There's no speed control — you can only run or stop.

---

Source: docs_and_data

Relevant Notes:
- [[permanent-split-capacitor-psc-motor-uses-an-always-in-circuit-run-capacitor-to-generate-the-rotating-field-that-single-phase-ac-cannot-produce-natively]] — induction motor alternative
- [[ac-gearmotors-swap-pwm-speed-control-for-gearbox-torque-multiplication-producing-high-torque-low-speed-output-without-an-h-bridge]] — higher-power AC motor companion note

Topics:
- [[actuators]]
