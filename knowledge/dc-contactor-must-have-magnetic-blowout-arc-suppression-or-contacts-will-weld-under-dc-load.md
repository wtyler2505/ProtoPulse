---
description: "DC arcs do not self-extinguish at zero-crossing like AC arcs -- without magnetic blowout or arc chute, DC contactor contacts will weld shut and the e-stop becomes inoperative"
type: claim
source: "docs/parts/emergency-stop-nc-button-with-dc-contactor-for-36v.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "albright-sw200"
---

# DC contactor must have magnetic blowout arc suppression or contacts will weld under DC load

When contacts open under DC load, an arc forms between the separating surfaces. In AC circuits, this arc extinguishes naturally 100-120 times per second at zero-crossing -- the current briefly hits zero and the arc dies. DC has no zero crossing. The arc will burn continuously, limited only by the available current (which on a battery system can be hundreds of amps).

An arc burning at 100+ amps will:
1. Heat the contact surfaces to melting temperature in milliseconds
2. Vaporize contact material, creating conductive plasma that sustains the arc further
3. Weld the contacts together when they're close enough for the molten metal to bridge
4. Render the contactor permanently closed -- the e-stop button becomes completely useless

The Albright SW200 solves this with magnetic blowout coils -- permanent magnets that deflect the arc sideways into an arc chute where it stretches, cools, and extinguishes. The double-breaking contact design (two contact points in series) divides the arc voltage, further aiding extinction. The silver alloy contacts resist welding even when subjected to brief arcs.

**The critical selection criterion:** Never use an AC-rated contactor (or relay, or switch) for DC power interruption above about 5A. The same contactor that safely interrupts 250A AC will weld shut at 50A DC because it relies entirely on zero-crossing extinction that doesn't exist in DC.

**ProtoPulse implication:** The DRC should verify that any relay or contactor in a DC power path has an explicit DC interrupt rating. The AI should warn that AC-rated components in DC power circuits are a fire/safety hazard and suggest DC-specific alternatives.

---

Relevant Notes:
- [[emergency-stop-must-use-normally-closed-contacts-because-wire-failure-must-equal-safe-shutdown]] -- the NC contact design that this contactor implements
- [[two-stage-estop-separates-control-circuit-from-power-circuit-for-safe-high-current-interruption]] -- the architecture where this contactor sits
- [[main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement]] -- the upstream fuse that limits available fault current

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
