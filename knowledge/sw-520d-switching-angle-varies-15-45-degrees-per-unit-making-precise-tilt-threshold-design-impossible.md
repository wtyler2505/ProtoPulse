---
description: "The SW-520D has a 3:1 manufacturing tolerance on switching angle (15-45 degrees) — you cannot design a system that triggers at exactly 30 degrees without testing and binning individual units"
type: claim
source: "docs/parts/sw-520d-tilt-switch-ball-type-orientation-detector.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[input-devices]]"
related_components:
  - "sw-520d-tilt-switch"
---

# SW-520D switching angle varies 15-45 degrees per unit making precise tilt threshold design impossible

The SW-520D datasheet specifies a switching angle range of 15-45 degrees. This is not a measurement uncertainty — it's the actual unit-to-unit variation across production. Two switches from the same bag may trigger at 18 degrees and 42 degrees respectively.

**Root cause:** Ball-type tilt switches are not precision instruments. The switching angle depends on:
- Ball mass (loose tolerance on the metal ball)
- Can internal geometry (stamped, not machined)
- Contact placement within the can
- Surface friction between ball and can walls
- Ball-to-contact gap when upright

None of these are precision-controlled in a $0.10 component.

**Design implications:**

1. **Cannot specify a trigger angle** — If your design requires "alert at 30 degrees tilt," the SW-520D might trigger at 20 or might not trigger until 45. An accelerometer-based solution is required for angular precision.

2. **Must design for the full range** — Your system should behave correctly whether the switch triggers at 15 or 45 degrees. If triggering at 15 degrees causes false alarms (too sensitive) or 45 degrees causes missed events (too insensitive), the switch is wrong for the application.

3. **Binning is possible but impractical** — You CAN test each switch and select the ones that trigger near your target angle. But this only works for low-volume, hand-built projects where you're willing to characterize each unit.

4. **Multiple switches improve coverage** — Mounting 2-3 switches at slightly different angles gives overlapping coverage (like redundant sensors), but adds wiring complexity.

**For the bench coach:** When a user asks "how do I trigger at exactly X degrees," the answer is NOT a tilt switch. Suggest an MPU6050 or ADXL345 with `atan2()` for angle measurement. The tilt switch is for "has it tipped over significantly?" — a deliberately imprecise question.

---

Relevant Notes:
- [[binary-tilt-detection-trades-precision-for-simplicity-and-zero-quiescent-power]] -- The tradeoff this constraint illuminates
- [[cds-photoresistors-have-logarithmic-response-making-them-qualitative-not-quantitative-light-sensors]] -- Same pattern: cheap passive sensor with poor precision, suitable for qualitative detection only

Topics:
- [[sensors]]
- [[input-devices]]
