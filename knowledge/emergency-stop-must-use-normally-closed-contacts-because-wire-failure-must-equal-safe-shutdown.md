---
description: "NC (Normally Closed) e-stop contacts ensure that any failure mode -- button press, wire break, connector corrosion, coil death -- results in power being CUT, not maintained"
type: claim
source: "docs/parts/emergency-stop-nc-button-with-dc-contactor-for-36v.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "schneider-xb5as"
  - "albright-sw200"
---

# Emergency stop must use normally closed contacts because wire failure must equal safe shutdown

The fundamental safety principle of e-stop design: a Normally Closed (NC) contact is closed when the button is NOT pressed, and opens when pressed. This means the safety system is held in a "power flows" state by active, intact wiring. Any interruption -- deliberate (button press) or accidental (wire break, connector corrosion, control power loss) -- produces the same result: power dies.

If you used Normally Open (NO) contacts instead, the system would work exactly backwards: pressing the button would CLOSE the circuit to activate a "stop" signal. But what happens when the wire from the NO button to the controller breaks? Nothing. The system doesn't know the button exists anymore. The e-stop is now decorative.

**The four failure modes of NC e-stop, all safe:**
1. Button pressed → NC opens → coil de-energizes → contactor opens → **power cut**
2. Wire breaks → same as NC open → coil de-energizes → contactor opens → **power cut**
3. Control power lost → coil can't energize → contactor opens → **power cut**
4. Connector corrodes → resistance rises → coil eventually drops out → **power cut**

This is not a design preference -- it is a safety standard (ISO 13850, IEC 60947-5-5). Any e-stop that uses NO contacts for the safety function is non-compliant and dangerous.

**ProtoPulse implication:** When an e-stop appears in a schematic, the DRC must verify the contact block is NC (not NO), that the coil de-energizes on button press (not energizes), and that the power path requires continuous coil energization to remain closed.

---

Relevant Notes:
- [[two-stage-estop-separates-control-circuit-from-power-circuit-for-safe-high-current-interruption]] -- why the NC button controls a coil, not the main power directly
- [[dc-contactor-must-have-magnetic-blowout-arc-suppression-or-contacts-will-weld-under-dc-load]] -- the contactor that the NC button controls
- [[twist-to-release-estop-prevents-accidental-restart-after-emergency-shutdown]] -- deliberate restart required

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
