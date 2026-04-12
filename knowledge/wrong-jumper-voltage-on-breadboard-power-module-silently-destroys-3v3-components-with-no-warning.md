---
description: "Selecting 5V on a rail powering an ESP32 or other 3.3V device is an irreversible overvoltage failure with no fuse, no indicator, and no recovery -- the jumper is tiny and unlabeled on many clones"
type: claim
source: "docs/parts/elegoo-breadboard-power-module-mb-v2-3v3-5v-selectable.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "mb-v2-power-module"
---

# Wrong jumper voltage on breadboard power module silently destroys 3.3V components with no warning

Selecting 5V on a breadboard power rail that feeds an ESP32, Raspberry Pi Pico, or any 3.3V device is permanent semiconductor death. Unlike overcurrent (which blows fuses or triggers thermal shutdown), overvoltage directly damages the gate oxide and junction structures in semiconductor devices. The damage is:
- Instantaneous -- happens in microseconds
- Silent -- no spark, no smoke (usually), no audible indication
- Irreversible -- the device is dead, no reset possible
- Often partial -- device may appear to work but produce garbage data or have elevated leakage current

The specific danger of the MB V2 module's jumper design:
1. The jumper is physically tiny (2.54mm pitch) with no color coding
2. Many clone modules have no printed label indicating which position is 3.3V vs 5V
3. The jumper can be accidentally displaced when inserting components nearby
4. There is no intermediate "off" position -- removing the jumper disables the rail entirely (which is at least safe)

This is particularly dangerous because the breadboard power module is often set up once and then forgotten. If a project sits on the bench for a week and someone bumps the jumper while reaching for something else, the next power-on kills the 3.3V device with no obvious cause.

**Mitigation:** Always verify output voltage with a multimeter before connecting any 3.3V device to a breadboard power module. Mark the jumper position with a colored dot. Consider using hot glue to lock jumpers in position on completed prototypes.

**ProtoPulse implication:** The bench coach should require voltage verification as a checklist item when a 3.3V device appears on the same breadboard as a configurable power module. The DRC could flag this as a "verify before connect" condition.

---

Relevant Notes:
- [[raspberry-pi-gpio-is-3v3-unprotected-with-no-clamping-diodes-and-5v-kills-the-soc-permanently]] -- same class of overvoltage destruction on a different platform
- [[clone-arduino-voltage-regulators-can-overheat-silently-because-there-is-no-thermal-feedback]] -- clone modules have poor labeling and unknown quality, amplifying the voltage selection risk
- [[independent-per-rail-voltage-selection-enables-mixed-voltage-breadboard-prototyping-without-isolation-circuits]] -- the feature that creates this risk

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
