---
description: "Passive component knowledge -- capacitor types and selection, transistor biasing, resistor networks, shift registers, and discrete component design patterns"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# passives

Capacitor selection (ceramic vs electrolytic vs film), transistor switching circuits, potentiometer circuits, shift register cascading, and discrete component design patterns for the inventory. Covers decoupling, bulk filtering, BJT switching, and IO expansion.

## Knowledge Notes

### MOSFET Switching
- [[logic-level-mosfet-gate-threshold-below-3v-eliminates-need-for-gate-driver-circuit]] — P30N06LE driven directly from 3.3V/5V GPIO without gate driver
- [[floating-gate-pull-down-on-mosfet-is-mandatory-to-prevent-random-actuation-during-mcu-boot]] — 10K gate-source resistor prevents floating gate during MCU reset
- [[low-side-mosfet-switching-puts-load-between-supply-and-drain-with-source-at-ground]] — standard N-channel topology for MCU-driven load switching

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
