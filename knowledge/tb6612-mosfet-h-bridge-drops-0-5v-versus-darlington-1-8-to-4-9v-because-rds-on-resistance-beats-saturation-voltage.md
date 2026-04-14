---
description: "MOSFET H-bridges like the TB6612 drop only ~0.5V total because RDS(on) is milliohm-scale resistance, while bipolar Darlington H-bridges like the L293D and L298N drop 1.4-4.9V because VCE(sat) is a fixed floor — this architectural difference, not current rating, is what makes modern drivers efficient"
type: claim
source: "docs/parts/osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel.md"
confidence: proven
topics:
  - "[[actuators]]"
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "osepp-tb6612-motor-shield"
  - "l293d-dual-h-bridge-ic"
  - "l298n-dual-h-bridge-motor-driver"
---

# TB6612 MOSFET H-bridge drops 0.5V versus Darlington 1.8-4.9V because RDS(on) resistance beats saturation voltage

The TB6612FNG uses MOSFETs in its H-bridge, which drop voltage according to Ohm's law: V = I × RDS(on). At a few hundred milliohms of on-resistance, a 1A current produces only a few hundred millivolts of drop — and total path drop across two MOSFETs (high-side + low-side) stays around 0.5V even at the 1.2A rated current. The L293D and L298N use bipolar Darlington transistor pairs, which drop voltage according to VCE(sat) — a fixed floor of roughly 1V-2.5V per transistor regardless of how hard you drive the base. Because VCE(sat) is a physics floor, not a resistance, you cannot "scale it down" by driving harder. The drop IS the drop.

This is the architectural reason the TB6612 is 96% efficient at 12V while the L298N is 59% efficient at 2A (see [[l293d-voltage-drop-is-1-4v-per-switch-totaling-2-8v-across-the-full-h-bridge-path]] for the efficiency table). It is also why [[bjt-switching-tops-out-at-600ma-in-to-92-and-the-transition-to-mosfet-is-a-hard-architecture-boundary]] applies inside integrated H-bridges, not just discrete switching — the Darlington VCE(sat) floor is the same physics whether the BJT pair is on a TO-92 or inside a DIP-16.

**Why this compounds at higher currents:** VCE(sat) actually rises with current in Darlington pairs (bipolar transistors are not ideal switches). The L298N's drop climbs from ~1.8V at 1A to ~4.9V at 2A. A MOSFET's drop rises linearly with current because it is just resistance — but the slope is so gentle that at the TB6612's 1.2A limit the total is still only ~0.5V. Doubling current in a Darlington more than doubles the drop. Doubling current in a MOSFET exactly doubles it. This means the efficiency gap between MOSFET and Darlington H-bridges WIDENS as current rises, not narrows.

**Why this is the key selection principle:** Matching driver current to motor current is the obvious first filter, but architectural efficiency is the hidden second filter. A motor within both the TB6612's 1.2A rating AND the L298N's 2A rating will run cooler, faster, and with better battery life on the TB6612 — the Darlington is not just "higher capacity," it is structurally worse at any shared current point.

**ProtoPulse implication:** The driver selection DRC should prefer MOSFET-based drivers within their current range and only recommend Darlington drivers when the current demand exceeds MOSFET options in the inventory. The selection flowchart must treat "MOSFET vs Darlington architecture" as a first-class dimension, not a footnote to current rating.

---

Source: [[osepp-tb6612-motor-shield-drives-2-dc-motors-at-1p2a-per-channel]]

Relevant Notes:
- [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]] — the Darlington half of this architectural comparison
- [[l293d-voltage-drop-is-1-4v-per-switch-totaling-2-8v-across-the-full-h-bridge-path]] — the other Darlington shows the same VCE(sat) floor at lower current
- [[bjt-switching-tops-out-at-600ma-in-to-92-and-the-transition-to-mosfet-is-a-hard-architecture-boundary]] — same physics applies in discrete switching; integrated H-bridges inherit the boundary
- [[logic-level-mosfet-gate-threshold-below-3v-eliminates-need-for-gate-driver-circuit]] — why modern MOSFET drivers can run on 5V logic despite previously needing gate drivers
- [[motor-shield-current-ratings-form-a-graduated-selection-ladder]] — the current ladder hides the architectural dimension that matters for efficiency

Topics:
- [[actuators]]
- [[power-systems]]
- [[eda-fundamentals]]
