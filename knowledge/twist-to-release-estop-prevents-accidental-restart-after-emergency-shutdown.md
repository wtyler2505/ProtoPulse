---
description: "The mushroom-head e-stop latches when pressed and requires deliberate 90-degree clockwise rotation to release -- system cannot restart from vibration, bump, or inattention"
type: claim
source: "docs/parts/emergency-stop-nc-button-with-dc-contactor-for-36v.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "schneider-xb5as"
---

# Twist-to-release e-stop prevents accidental restart after emergency shutdown

The Schneider XB5AS e-stop uses a mushroom-head actuator (40mm red, on yellow background per IEC 60947-5-5) that latches in the pressed position. Once triggered, the system remains in a safe shutdown state regardless of what happens next -- vibration, being dropped, someone bumping into it, or the operator forgetting it was pressed.

Restart requires a deliberate two-step action:
1. Recognize the button is latched (it's visually obvious -- the mushroom head is depressed)
2. Rotate the head 90 degrees clockwise (requires intentional grip and twist)

This prevents the scenario where an e-stop is pressed during an emergency, the immediate danger passes, and the system unexpectedly comes back to life because the button popped back out. On a 200-pound rover with hoverboard motors, unexpected startup while someone is working on the chassis is a serious crush/entanglement hazard.

The 40mm mushroom head is oversized specifically so it can be hit with a palm, elbow, or any body part in a panic -- you don't need to find and aim at a small target. The yellow background provides maximum visual contrast for locating it instantly. IP66 rating ensures it works after being hosed down, dropped in mud, or left outside.

The 1,000,000 mechanical life rating means the button itself will outlast every other component in the system by an order of magnitude.

**ProtoPulse implication:** The safety checklist for any mobile robot project should include e-stop mounting location (accessible from outside the robot's work envelope) and a monthly test procedure (press, verify shutdown, verify no restart, twist to release, verify restart).

---

Relevant Notes:
- [[emergency-stop-must-use-normally-closed-contacts-because-wire-failure-must-equal-safe-shutdown]] -- the NC contact that this button implements
- [[two-stage-estop-separates-control-circuit-from-power-circuit-for-safe-high-current-interruption]] -- the overall system this button is part of

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
