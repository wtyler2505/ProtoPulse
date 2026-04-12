---
description: "The e-stop button switches a 12/24V control circuit (~0.5A) that operates a DC contactor which interrupts the 36V/100A power circuit -- the button never sees high current"
type: claim
source: "docs/parts/emergency-stop-nc-button-with-dc-contactor-for-36v.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "schneider-xb5as"
  - "albright-sw200"
  - "lm2596"
---

# Two-stage e-stop separates control circuit from power circuit for safe high-current interruption

A 36V/100A power bus cannot be safely interrupted by a panel-mount pushbutton. The arc energy at DC is enormous -- contacts would weld, the button would catch fire, and the "emergency stop" would become an "emergency torch." Instead, the e-stop system uses two physically separate circuits:

**Control circuit (12/24V, <1A):**
- Buck converter provides 12V or 24V (from 36V main bus)
- E-stop NC button sits in series with the contactor coil power
- Button rated for DC-13: 0.5A at 24V -- well within its capabilities
- #18 AWG wiring, tiny currents, no arc risk

**Power circuit (36V, 100A+):**
- Albright SW200 DC contactor with M10 stud terminals
- Silver alloy contacts with magnetic blowout arc suppression
- #4 AWG wiring, enormous currents, serious arc energy
- Contactor rated for 250A continuous -- far exceeds the 100A requirement

The elegance: the button is small, cheap, and mountable anywhere you want (exterior of rover). The contactor is heavy, expensive, and bolted down near the battery. A pair of thin #18 AWG control wires runs between them. You can mount the e-stop on a long cable (roll of #18 wire is light and flexible) without worrying about voltage drop on a 0.5A circuit.

The buck converter that feeds the control circuit must itself be powered from the main bus -- creating a bootstrap dependency. When the main bus is first energized (via the manual disconnect switch), the buck converter starts, the coil energizes, and the contactor closes, maintaining its own power supply. This is intentional: if the main bus dies for any reason, the contactor opens and stays open.

**ProtoPulse implication:** The schematic should show control and power circuits as separate domains with clear voltage labels. The AI should flag any design that puts a pushbutton directly in a power path above 5A.

---

Relevant Notes:
- [[emergency-stop-must-use-normally-closed-contacts-because-wire-failure-must-equal-safe-shutdown]] -- why the control circuit uses NC contacts
- [[dc-contactor-must-have-magnetic-blowout-arc-suppression-or-contacts-will-weld-under-dc-load]] -- why the contactor needs arc suppression
- [[switching-buck-converters-waste-watts-not-volts-making-them-essential-for-large-voltage-differentials]] -- the buck converter that provides control circuit power from the 36V bus

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
