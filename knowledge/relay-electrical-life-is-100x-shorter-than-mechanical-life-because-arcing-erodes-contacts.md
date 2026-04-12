---
description: "The SRD-05VDC is rated for 10 million mechanical cycles but only 100,000 electrical cycles at rated load -- contact arcing during switching erodes the contact surfaces, reducing the usable lifespan by two orders of magnitude"
type: insight
source: "docs/parts/songle-srd-05vdc-relay-5v-coil-spdt-10a-250vac.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
related_components:
  - "songle-srd-05vdc-sl-c"
---

# Relay electrical life is 100x shorter than mechanical life because arcing erodes contacts

The Songle SRD-05VDC relay specifies two separate lifetime ratings: 10 million mechanical cycles (switching with no load) and 100,000 electrical cycles (switching at rated 10A load). The 100:1 ratio is not a manufacturing defect -- it's fundamental to how electromechanical relays work.

**What causes the wear:** When contacts separate under load, the current doesn't stop instantly. As the contacts begin to open, the decreasing contact area concentrates current into a tiny bridge of molten metal. This bridge stretches and breaks, creating an electric arc. The arc temperature can exceed 6000K, vaporizing contact material with each switching event. Over thousands of cycles, the contacts develop pitting (material removed) and buildup (material deposited on the opposite contact), eventually causing:
- Increased contact resistance (higher voltage drop, more heating)
- Contact welding (contacts fuse together under high inrush current)
- Failure to make contact (pits too deep for the contact spring to bridge)

**Implications for project design:**
- If switching 10A loads multiple times per minute, a relay will fail in weeks
- At 10A, 100,000 cycles at 1 switch/minute = ~69 days
- At 1A (1/10 rated load), electrical life extends dramatically (contact erosion scales with current)
- For high-frequency switching (more than a few times per second), use solid-state relays (SSRs) which have no mechanical contacts to erode

**The 10ms switching time also matters:** The relay's ~10ms contact travel time is an eternity compared to semiconductor switching (nanoseconds). During those 10ms, the contacts bounce -- making and breaking the circuit multiple times. Contact bounce generates RF noise and can trigger digital inputs multiple times. Debouncing (hardware RC filter or software delay) is required on any signal read through relay contacts.

---

Relevant Notes:
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] -- relay paradigm: digital HIGH/LOW, but with mechanical limitations that other actuator types don't have
- [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]] -- different mechanism (thermal vs erosion) but same theme: switching devices have mode-dependent wear rates

Topics:
- [[actuators]]
- [[eda-fundamentals]]
