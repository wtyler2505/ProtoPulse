---
description: "Two motors mounted on opposite sides of a chassis face mirror-image directions — identical electrical 'forward' commands then produce opposite wheel rotations, causing the robot to spin in place when it should drive straight; fix with software direction inversion on one side or by swapping two phase wires on one controller"
type: claim
source: "docs/parts/wiring-dual-zs-x11h-for-hoverboard-robot.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[wiring-integration]]"
  - "[[eda-fundamentals]]"
related_components:
  - "riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input"
---

# opposite-facing chassis motors require software or phase-wire inversion to make forward produce same-direction wheel motion

This is a wiring-vs-software design decision that has no obvious answer until you understand the geometry. Two drive motors on a rover mount on opposite sides of the chassis, rotated 180 degrees from each other. Their output shafts — and therefore their "natural forward" rotations — face opposite directions. When firmware commands both motors "forward" with identical signals, one wheel spins clockwise and the other spins counterclockwise. The robot pivots in place instead of driving forward.

The diagnostic signature is unambiguous: "commanding forward makes the robot spin, commanding pivot makes it drive straight." Every motion is rotated by 90 degrees. Beginners often assume a code bug or a wiring error — the actual cause is that the two motors are doing exactly what they were told, but the command convention doesn't account for their physical orientation.

**Two valid fixes, with different trade-offs:**

1. **Physical: swap two of the three motor phase wires on one ZS-X11H.** Any two swaps of MA/MB/MC reverses the commutation sequence, permanently flipping that motor's rotation direction. One-time hardware change, zero software cost, no performance penalty.

2. **Software: invert the direction pin logic for one motor.**
   ```cpp
   void setRightDirection(bool forward) {
     digitalWrite(PIN_RIGHT_DIR, forward ? HIGH : LOW);  // inverted
   }
   void setLeftDirection(bool forward) {
     digitalWrite(PIN_LEFT_DIR, forward ? LOW : HIGH);   // normal
   }
   ```
   Reversible, no hardware change, but adds a failure surface — if the inversion is ever forgotten (e.g., after firmware refactor), the robot regresses to spinning.

The choice matters because it sets the contract between the physical build and the firmware. Software inversion keeps all motors electrically identical, making them interchangeable spares and simplifying hardware documentation. Phase-wire swap encodes the chassis geometry into the wiring, making the hardware self-describing but creating a quiet rule that the left and right controllers are not interchangeable.

**Distinct from [[bldc-direction-reversal-under-load-creates-destructive-current-spikes-through-mosfets]]:** that note addresses runtime direction toggling; this note addresses permanent directional asymmetry at build time. The phase-wire swap described there (to fix single-motor wrong-direction) is the same technique applied to a different problem — one motor, not the mirroring of two.

**ProtoPulse implication:** The bench coach should ask during multi-motor chassis layout: "are the motors mirrored?" — and if yes, generate the direction abstraction layer automatically. The DRC should flag code that calls `digitalWrite(LEFT_DIR, val); digitalWrite(RIGHT_DIR, val);` with identical arguments as suspicious in a two-motor rover context.

---

Source: [[wiring-dual-zs-x11h-for-hoverboard-robot]]

Relevant Notes:
- [[bldc-commutation-table-maps-hall-states-to-phase-pairs-and-only-two-of-six-wire-permutations-produce-smooth-rotation]] — the phase-permutation space that makes "swap any two" a valid reversal technique
- [[bldc-direction-reversal-under-load-creates-destructive-current-spikes-through-mosfets]] — same phase-swap technique applied to a different problem (runtime direction change vs permanent chassis mirroring)
- [[tank-steering-replaces-mechanical-steering-with-differential-wheel-speed-control]] — the control paradigm that inherits this problem because it relies on "both forward = drive straight"

Topics:
- [[actuators]]
- [[wiring-integration]]
- [[eda-fundamentals]]
