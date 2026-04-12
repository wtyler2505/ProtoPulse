---
description: "The Hamlin 59030 reed switch is rated for 200V DC, 500mA switching, 1A carry, 10W — it can directly switch solenoids, small motors, and lamps without a relay or MOSFET, unlike typical GPIO-level sensors"
type: claim
source: "docs/parts/hamlin-59030-reed-switch-magnetic-sensor-dry-contact.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[passives]]"
related_components:
  - "hamlin-59030-reed-switch"
---

# Reed switches rated 200V 1A can directly switch real loads not just signal level GPIO

Most makers treat reed switches purely as GPIO sensors — "detect magnet, read HIGH/LOW." But the Hamlin 59030 (and similar rated switches) can switch significant loads directly:

**Ratings:**
- Maximum switching voltage: 200V DC
- Maximum switching current: 500mA
- Maximum carry current: 1A (contacts can handle after initial closure)
- Maximum power: 10W
- Contact resistance: <150 milliohms (very low loss)

**What this enables:**
1. **Direct solenoid control** — A 12V/500mA solenoid can be switched directly by a reed switch + magnet, with NO MCU, NO relay, NO transistor. Pure passive magnetic triggering.
2. **Small motor switching** — 12V DC motors under 500mA can be magnetically triggered (e.g., drawer opens → motor runs).
3. **Lamp circuits** — LED strips or incandescent lamps under 10W switched by proximity.
4. **Safety interlock** — Door/hatch magnetic switch that directly breaks a power circuit (not just signals a controller).

**Why this matters:**
The "passive switching" paradigm is fundamentally different from "sense and control":
- Sense and control: Reed → GPIO → MCU processes → output pin → MOSFET → load
- Direct switching: Reed → load (magnet IS the controller)

The direct switching path has no failure modes from firmware bugs, MCU crashes, or power supply issues. The physics (magnet proximity) IS the logic.

**Limitations at high loads:**
- Contact life degrades with load: 10^8 cycles unloaded → 10^5 cycles at rated load
- Inductive loads (solenoids, motors) need a flyback diode across the switch to protect contacts from arcing
- No PWM possible (purely on/off)

---

Relevant Notes:
- [[passive-mechanical-switches-draw-zero-quiescent-current-making-them-ideal-battery-wake-triggers]] -- Extends this note by showing reed switches can be more than just wake triggers

Topics:
- [[sensors]]
- [[passives]]
