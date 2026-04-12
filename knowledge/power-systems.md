---
description: "Power system knowledge -- battery management, voltage regulation, power distribution, fusing, emergency stop, and multi-voltage tier design for 36V rover systems"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# power-systems

Battery management, voltage regulation, power distribution architecture, fusing strategy, and safety systems for the inventory. Covers LiPo/BMS, buck converters, linear regulators, MOSFETs, E-stop circuits, and multi-tier power distribution.

## Knowledge Notes
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] — four voltage tiers with different supply, regulation, and isolation requirements
- [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]] — Darlington architecture wastes up to 40% of supply voltage as heat; MOSFET drivers solve this
- [[relay-coil-draws-70ma-which-exceeds-gpio-limits-on-every-common-mcu]] — relay coil current requires driver transistor between GPIO and coil
- [[relay-coil-is-an-inductor-that-generates-destructive-back-emf-spikes-when-de-energized]] — flyback diode clamps back-EMF; 1N4007 correct for relay (not motor) frequencies

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
