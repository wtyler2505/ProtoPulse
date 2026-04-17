---
description: "Single-motor ZS-X11H wiring to ESP32: 5V controller I/O needs TXS0108E-class bidirectional level shifter to 3.3V ESP32 GPIO. Covers VCCA-lower-rail asymmetry, push-pull hall output routing, separate logic supply, and boot-strapping pin isolation."
type: moc
topics:
  - "[[wiring-integration]]"
  - "[[power-systems]]"
  - "[[index]]"
---

# ZS-X11H to ESP32 (with level shifter)

Single-motor ZS-X11H wiring to ESP32: 5V controller I/O needs TXS0108E-class bidirectional level shifter to 3.3V ESP32 GPIO. Covers VCCA-lower-rail asymmetry, push-pull hall output routing, separate logic supply, and boot-strapping pin isolation.

## Knowledge Notes

_No atomic notes currently link to this topic. Populated by future /extract passes as the relevant wiring batches are processed._

## Open Questions
(populated by /extract)

---

Topics:
- [[wiring-integration]] — Wiring and integration knowledge -- multi-component system wiring, common ground discipline, level shifting topology, pull-up sizing, flyback protection, decoupling placement, EMI suppression, and power distribution across mixed-voltage systems
- [[power-systems]] — Power system knowledge -- battery + BMS (10S Li-ion, lead-acid, LVD), linear + switching regulation, buck/boost topology, parallel rail distribution, fusing (ANL + slow-blow), two-stage E-stop with DC contactors, AC-mains safety capacitors (X-class line-to-line, Y-class line-to-ground), MOSFET low-side switching, and multi-voltage tier design for 36V rover systems
- [[index]] — Entry point to the ProtoPulse knowledge vault -- 528 atomic notes across 11 hardware topic maps covering microcontrollers, actuators, sensors, displays, power, communication, shields, passives, input devices, and system wiring
