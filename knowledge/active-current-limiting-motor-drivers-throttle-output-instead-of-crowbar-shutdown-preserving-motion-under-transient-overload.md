---
description: "High-end motor drivers (Cytron MD25HV, VESC, ODrive) use active current limiting that throttles PWM duty cycle when current exceeds threshold — letting the motor continue at reduced torque — rather than crowbar overcurrent shutdown that abruptly stops motion, which matters for vehicles/robots where unexpected cutouts cause worse damage than degraded motion"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[actuators]]"
---

# Active current limiting motor drivers throttle output instead of crowbar shutdown, preserving motion under transient overload

Two different "overcurrent protection" behaviors exist in motor drivers:

**Crowbar overcurrent (cheap drivers):**
- Detect current over threshold → latch driver OFF
- Motor goes from full torque to zero torque instantly
- Requires external reset (often a power cycle)
- Example behavior: L298N hitting thermal cutout, generic ESCs in beginner boards

**Active current limiting (premium drivers):**
- Detect current over threshold → reduce PWM duty cycle in real time
- Motor continues at reduced torque, limited to the threshold
- Driver stays operational; no reset needed
- Example behavior: Cytron MD25HV, VESC, ODrive, most industrial VFDs

**Why the distinction matters:**
- **Vehicles** — a scooter that cuts out mid-acceleration on a hill is worse than a scooter that slows down; the rider expects degraded performance, not abrupt loss
- **Robots manipulating objects** — a gripper that crowbars during a pickup drops the object; a gripper that limits torque holds the object at reduced force
- **Pumps** — a pump hitting a blockage with crowbar shutdown loses prime; limiting current keeps it pushing at reduced flow until someone clears the blockage
- **Stall detection** — active limiting gives you a stable "I'm stalling" current signal you can read from a current sensor; crowbar gives you a binary "I was running, now I'm off"

**Cost in the BOM:**
Active limiting requires faster current-sense feedback and a PWM controller that can throttle rather than just enable/disable. This is the main reason cheap drivers use crowbar — it's a comparator and a latch. Active limiting needs a current-sense amp, a PID or hysteretic controller, and fast-response MOSFETs. Typical upcharge is 3-10x the bare-bones driver price.

**When crowbar is still the right choice:**
- Permanent magnet stepper motors (stalling stepper is fine, just noisy)
- Fans (stalled fan doesn't care about torque limiting)
- Low-value loads where destroying the driver is cheaper than the smarter driver BOM

---

Source: docs_and_data

Relevant Notes:
- [[cytron-md25hv-completes-the-brushed-dc-driver-voltage-ladder-tb6612-at-13v-l298n-at-46v-md25hv-at-58v-with-25a-continuous]] — example of an active-limiting driver in the ladder
- [[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float]] — general motor-driver integration

Topics:
- [[actuators]]
