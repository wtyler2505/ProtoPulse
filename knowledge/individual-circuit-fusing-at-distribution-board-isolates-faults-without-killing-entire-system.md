---
description: "Each motor controller gets its own 20A fuse at the distribution board -- a shorted MC1 blows its fuse while MC2-MC4 and all electronics continue running, enabling graceful degradation"
type: claim
source: "docs/parts/power-distribution-board-fused-terminal-block-for-36v-system.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "power-distribution-board"
  - "riorand-zs-x11h"
---

# Individual circuit fusing at distribution board isolates faults without killing entire system

A power distribution board with per-circuit fuses creates a hierarchy of protection where each fault is contained to the smallest possible zone. The rover's 36V distribution has this fusing cascade:

**Fuse hierarchy (upstream to downstream):**
1. **100A ANL main fuse** (at battery) -- protects the main bus wire from catastrophic short
2. **Per-circuit fuses at distribution board:**
   - 4x 20A blade fuses for motor controllers
   - 2x 5A blade fuses for buck converters (electronics power)
3. **Per-device protection** (where the device provides it -- the ZS-X11H does not)

**Fault isolation scenarios:**
- MC1 shorts internally → 20A fuse for circuit 1 blows → MC2, MC3, MC4, and all electronics continue operating. The rover can limp home on 3 motors.
- 12V buck converter fails → 5A fuse for circuit 5 blows → Motor controllers continue running on 36V. Only 12V-powered devices (relays, contactor coil) lose power. This does trigger a safe shutdown because the contactor coil loses power, but the motors are still controllable until the contactor opens.
- A wire shorts to chassis ground → the smallest fuse in the path blows first, containing the fault.

**Fuse sizing coordination:** Each 20A per-circuit fuse is smaller than the 100A main fuse. This means a fault on one circuit blows the small fuse before the main fuse has time to react. The 100A main fuse only blows if multiple circuits fault simultaneously or if the distribution board itself shorts.

**Blade fuse voltage rating gotcha:** Standard automotive ATC/ATO blade fuses are typically rated for 32V DC. For a 36V system (42V max when fully charged), you must source 58V DC rated blade fuses, or use bolt-down fuse blocks with properly rated fuses. Using a 32V-rated fuse at 42V risks the fuse failing to extinguish the arc after it blows, causing a sustained fault.

---

Relevant Notes:
- [[per-branch-motor-fusing-enables-graceful-degradation-because-a-single-motor-fault-blows-its-own-fuse-not-the-main]] -- motor-specific instance of this pattern: focuses on the limp-home behavioral outcome and the 10A branch sizing math
- [[main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement]] -- the upstream main fuse this per-circuit fusing coordinates with
- [[star-ground-at-distribution-board-prevents-ground-loops-in-multi-circuit-systems]] -- ground topology that complements this positive-side fusing
- [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] -- per-controller fuse is the only protection for the ZS-X11H
- [[slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring]] -- time-delay characteristics of the upstream main fuse

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
