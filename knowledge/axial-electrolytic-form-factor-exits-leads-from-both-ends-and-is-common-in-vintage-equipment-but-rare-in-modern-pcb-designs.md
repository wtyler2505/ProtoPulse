---
description: "Axial electrolytics have leads exiting from both ends of the cylindrical body -- standard in point-to-point wiring and older equipment, but radial (both leads from one end) dominates modern PCB layouts because it mounts vertically and uses less board area"
type: knowledge-note
source: "docs/parts/381383-cde-aluminum-electrolytic-capacitor-axial-high-voltage.md"
topics:
  - "[[passives]]"
confidence: high
verified: false
---

# Axial electrolytic form factor exits leads from both ends and is common in vintage equipment but rare in modern PCB designs

Aluminum electrolytic capacitors come in two physical form factors defined by where the leads exit the body:

- **Axial:** Leads exit from both ends of the cylindrical body, like a resistor. The component lies flat, parallel to the board or chassis. Common in tube amplifiers, vintage test equipment, point-to-point wiring, and industrial power supplies where board density is not a concern.

- **Radial:** Both leads exit from the same end (the bottom), and the component stands upright on the board. This is the dominant form factor for modern through-hole PCB designs because it occupies less board area -- the footprint is just the circular cross-section of the body, not the full length.

**Why this matters for inventory and ProtoPulse:**

1. **Breadboard compatibility:** Axial caps are awkward on a breadboard because the body spans the gap between rows. Radial caps drop straight into adjacent holes. The bench coach should note this when an axial cap appears in inventory.

2. **Footprint selection:** An EDA tool needs different land patterns for axial vs radial mounting. The axial pattern is two pads separated by the body length; the radial pattern is two pads at the lead spacing (typically 2.5-7.5mm depending on diameter).

3. **Identification context:** Encountering an axial electrolytic in a parts kit suggests it was sourced from surplus/vintage equipment or a specialty supplier (like Cornell Dubilier's 381LX series). Modern component kits from Amazon/AliExpress contain almost exclusively radial electrolytics.

---

Source: [[381383-cde-aluminum-electrolytic-capacitor-axial-high-voltage]]

Relevant Notes:
- [[electrolytic-capacitor-voltage-derating-to-80-percent-of-rated-voltage-is-mandatory-for-reliability]] -- applies equally to axial and radial form factors
- [[reversed-polarity-on-aluminum-electrolytic-capacitors-causes-violent-catastrophic-failure]] -- polarity marking style differs between axial (band near negative lead) and radial (stripe with minus signs)

Topics:
- [[passives]]
