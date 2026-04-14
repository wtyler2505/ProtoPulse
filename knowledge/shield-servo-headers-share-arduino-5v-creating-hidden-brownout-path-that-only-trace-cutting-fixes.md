---
description: "Motor shields with integrated servo headers route the Arduino's on-board 5V regulator to the servo VCC pin — fine for SG90-class micro servos but guarantees brownouts or regulator damage with standard servos, and the only fix is cutting the VCC trace and wiring external power"
type: claim
source: "docs/parts/osepp-motor-servo-shield-v1-drives-2-dc-motors-plus-servos.md"
confidence: proven
topics:
  - "[[shields]]"
  - "[[actuators]]"
  - "[[power-systems]]"
related_components:
  - "osepp-motor-servo-shield-v1"
  - "sg90-micro-servo"
  - "arduino-uno-r3"
---

# shield servo headers share Arduino 5V creating hidden brownout path that only trace-cutting fixes

When a motor shield adds "convenient" 3-pin servo headers, the VCC pin of those headers almost always connects directly to the Arduino's on-board 5V rail — the same rail that powers the ATmega, the USB serial chip, and any sensors on the shield. This routing choice is never documented prominently and is invisible from the top of the board. A beginner plugs a servo into the header, it moves when commanded, and the design appears to work. Then a larger servo is plugged in, or two servos are plugged in, and the Arduino starts resetting mid-motion.

The failure mode depends on the power source feeding the Arduino. On USB, the host's 500mA current limit triggers first — the computer cuts the port's power and the Arduino browns out. On a barrel-jack adapter with a larger supply, the Arduino's on-board regulator (AMS1117 or NCP1117 on most boards) overheats because it is trying to source ~1A of servo stall current through a TO-220 package rated for ~800mA thermal-limited. The regulator's thermal shutdown engages, cutting 5V entirely. In both cases the symptom is the Arduino restarting during servo movement — not at any predictable time, because the thermal and current profiles of a moving servo are spiky and depend on load.

Unlike [[breadboard-power-module-700ma-total-budget-excludes-servos-and-motors-requiring-separate-power]], which is a separate power module on the rail the user consciously wired, the shield's servo header appears to be a dedicated servo output — the shared-rail coupling is hidden behind the shield's stacking form factor. The user cannot see the connection without tracing the PCB.

**The only fix is surgery.** Cutting the trace from Arduino 5V to the servo header's VCC pin and wiring external 5V or 6V to the now-isolated VCC pin is the correct solution. Some shield datasheets document this explicitly (the OSEPP Motor/Servo V1 instructions mention "cut the VCC trace"). Most do not. The trace to cut is typically the thin track between the servo header's middle pin and the 5V pin of the shield's Arduino header pass-through — probing with a multimeter in continuity mode identifies it before cutting.

**The micro-servo exception.** SG90-class micro servos (operating current ~100mA, stall ~650mA briefly) are the only class that the shared-5V rail can support without modification, and only one at a time. Two SG90s moving simultaneously will still brown out the Arduino on USB power.

---

Source: [[osepp-motor-servo-shield-v1-drives-2-dc-motors-plus-servos]]

Relevant Notes:
- [[breadboard-power-module-700ma-total-budget-excludes-servos-and-motors-requiring-separate-power]] — same "on-board regulator cannot drive a servo" problem, different topology
- [[combo-motor-and-servo-shields-trade-per-function-efficiency-for-single-board-convenience]] — the shared-5V coupling is one of the two compromises combo shields force
- [[clone-arduino-voltage-regulators-can-overheat-silently-because-there-is-no-thermal-feedback]] — the thermal-shutdown failure mode is exactly the mechanism here
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] — actuators belong on their own power tier, never sharing with logic

Topics:
- [[shields]]
- [[actuators]]
- [[power-systems]]
