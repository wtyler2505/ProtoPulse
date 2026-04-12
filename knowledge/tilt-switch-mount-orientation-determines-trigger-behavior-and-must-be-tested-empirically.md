---
description: "Unlike electronic sensors, the SW-520D's trigger axis depends entirely on physical mounting orientation — rotating 90 degrees changes which direction activates it, with no datasheet convention for 'up' since the device is electrically non-polarized and physically symmetric"
type: claim
source: "docs/parts/sw-520d-tilt-switch-ball-type-orientation-detector.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[input-devices]]"
related_components:
  - "sw-520d-tilt-switch"
---

# Tilt switch mount orientation determines trigger behavior and must be tested empirically

The SW-520D is a cylindrical can with two leads protruding from one end. A metal ball inside makes contact (switch closed) when the can is tilted past threshold from its "upright" position. But:

1. **No polarity marking** — The two leads are electrically identical (pure switch, no diode behavior). Either orientation in the circuit works identically.
2. **No "top" marking** — The can is visually symmetric. There's no arrow, dot, or flat indicating which end should point up.
3. **The trigger axis is the can's long axis** — Tilting perpendicular to the long axis is what moves the ball. Tilting along the long axis has no effect (ball stays centered between contacts).

**Why this is a design gotcha:**

Most electronic sensors have documented axes. An accelerometer datasheet shows X/Y/Z directions with labeled arrows. A tilt switch has none of this — the "axis" is determined by how you solder or mount it on your PCB or chassis.

**Practical procedure:**
1. Solder the switch in any orientation
2. Connect to MCU with `INPUT_PULLUP`
3. Start a serial monitor printing the pin state
4. Physically tilt the assembly in each direction to discover which motion triggers the switch
5. Mark the trigger direction on your enclosure/PCB for future reference

**PCB layout implication:**
If designing a PCB with the SW-520D, the footprint orientation (0/90/180/270 degrees) directly determines which physical tilt direction triggers the alarm. Document this in the schematic notes: "Switch triggers when board tilts >30 degrees along [marked axis]."

**DRC opportunity:** ProtoPulse should flag tilt switches in schematic/PCB layouts with a note: "Verify physical mounting orientation determines trigger axis. No standard orientation convention exists — test empirically after assembly."

---

Relevant Notes:
- [[sw-520d-switching-angle-varies-15-45-degrees-per-unit-making-precise-tilt-threshold-design-impossible]] -- Another precision limitation of this component class
- [[binary-tilt-detection-trades-precision-for-simplicity-and-zero-quiescent-power]] -- The use-case context for tilt switches

Topics:
- [[sensors]]
- [[input-devices]]
