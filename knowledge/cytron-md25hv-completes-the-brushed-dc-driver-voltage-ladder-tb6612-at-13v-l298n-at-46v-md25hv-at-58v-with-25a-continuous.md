---
description: "The Cytron MD25HV fills the high-voltage/high-current slot in the brushed DC motor driver ladder — TB6612 handles 13.5V/1.2A for small toys, L298N handles 46V/2A for medium brushed motors, and MD25HV handles 58V/25A continuous (60A peak) for scooter/EV/industrial class loads that the first two cannot touch"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
---

# Cytron MD25HV completes the brushed DC driver voltage ladder: TB6612 at 13V, L298N at 46V, MD25HV at 58V with 25A continuous

The ProtoPulse parts catalog needs a brushed DC motor driver for every common voltage and current regime. The three canonical choices form a ladder, each filling a different slice:

| Driver | Voltage | Continuous Current | Peak Current | Technology | Typical Use |
|--------|---------|--------------------|--------------|------------|-------------|
| TB6612FNG | 2.5-13.5V | 1.2A | 3.2A | Integrated MOSFETs | Arduino toys, small robots, mini-4WD |
| L298N | 5-46V | 2A | 3A | BJT Darlington | Breadboard-friendly, low-current, high voltage drop |
| Cytron MD25HV | 7-58V | 25A | 60A | Discrete NMOS H-bridge | E-bike/scooter/EV wheels, pumps, industrial actuators |

**Why MD25HV exists in this ladder:**
Until you hit scooter/e-bike/EV loads — 24V or 48V battery packs driving motors that pull 10-25A continuous — no generic hobby driver is adequate. L298N burns out at anything above 3A. TB6612 is limited to toy-scale. The MD25HV covers the gap: discrete NMOS H-bridge with active current limiting, thermal protection, undervoltage shutdown, and logic-level flexibility (1.8V/3.3V/5V/12V/24V).

**Architectural features that distinguish MD25HV from cheap NMOS boards:**
- **Active current limiting** — instead of crowbar shutdown, the driver throttles current, letting the motor continue at reduced torque instead of stopping
- **Integrated 5V/250mA buck** — can power the controlling Arduino/Pi directly, avoiding a separate BEC
- **Dual control modes** — PWM/DIR for programmatic control, potentiometer/switch for standalone manual control
- **Logic-level flexibility** — accepts any common MCU voltage without level-shifting

**Gotchas:**
- **No reverse-polarity protection** — connecting battery backwards will destroy the driver. Add an external reverse-poly diode or fuse for battery-powered projects.
- **25A continuous is without heatsink** — at duty cycle >60% in warm environments, bolt it to a metal chassis anyway.
- **60A peak is instantaneous** — not a motor stall rating. Motors that stall for seconds at peak will trip thermal protection.

**Resolves the mosfet-driver-efficiency selection tension:**
Earlier vault notes compared L298N (efficient for 2A but useless above 3A) against TB6612 (efficient but limited to 13V). The missing piece was a true high-voltage/high-current H-bridge in the hobby price/availability tier. MD25HV fills it: 58V / 25A is genuinely useful for e-mobility projects, and "discrete NMOS H-bridge" technology means the efficiency loss is only the RDS(on) of the MOSFETs (~0.5V across the bridge at 10A vs L298N's ~3V across the Darlington BJT).

---

Source: docs_and_data

Relevant Notes:
- [[l298n-is-a-beginner-trap-because-it-dissipates-more-power-than-the-motor-at-typical-robotics-currents]] — the L298N limitation that MD25HV resolves at higher voltages
- [[tb6612fng-dual-h-bridge-replaces-l298n-for-small-robots-with-better-efficiency-and-integrated-protection]] — the small-motor alternative
- [[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float]] — general motor-driver integration requirement

Topics:
- [[actuators]]
- [[power-systems]]
