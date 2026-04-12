---
description: "Unlike LEDs where reversed polarity is a silent no-current failure, reversed electrolytic polarity causes electrochemical gas generation inside the sealed can -- pressure builds until the vent scores rupture, ejecting hot electrolyte and producing a loud pop"
type: knowledge-note
source: "docs/parts/200mxr470m-electrolytic-capacitor-470uf-200v-radial.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: true
---

# Reversed polarity on aluminum electrolytic capacitors causes violent catastrophic failure

Aluminum electrolytic capacitors are polarized: the aluminum oxide dielectric is formed on only one electrode (the anode). When voltage is applied in the correct direction, the oxide blocks current. When reversed:

1. **Reverse current flows** through the oxide, which is not formed to block current in this direction
2. **Electrolysis occurs** -- the electrolyte decomposes, generating hydrogen gas
3. **Internal pressure builds** inside the sealed aluminum can
4. **Vent scores rupture** -- the cross-scored top of the can (visible on most modern electrolytics) opens to release pressure
5. **Hot electrolyte ejects** -- potentially spraying nearby components and the technician

**This is categorically different from LED reversed polarity**, which produces zero current, zero light, and zero damage. Electrolytic reversed polarity produces a violent, potentially dangerous failure.

**Polarity identification:**
- **Negative terminal** is marked with a stripe and/or minus arrows on the sleeve
- **Positive lead** is typically longer on new/untrimmed parts
- **PCB footprint** has a "+" marking for the positive pad on most designs
- **Through-hole pads** may have a square pad for positive and round for negative (convention varies)

**Time to failure:** Reversed polarity failure is not instant -- it takes seconds to minutes depending on the applied voltage relative to the rating and the circuit's current-limiting capability. A low-current circuit (high series resistance) may sustain a reversed electrolytic for minutes with gradually increasing leakage before venting. A low-impedance source can cause failure in under a second.

---

Relevant Notes:
- [[led-polarity-has-four-physical-identification-methods-and-getting-it-wrong-is-a-silent-failure]] -- Contrast: LED polarity is silent and harmless; electrolytic polarity is violent
- [[high-voltage-capacitors-store-dangerous-energy-that-persists-after-circuit-power-off]] -- Reversed polarity on a charged high-voltage cap combines both hazards

Topics:
- [[passives]]
- [[eda-fundamentals]]
