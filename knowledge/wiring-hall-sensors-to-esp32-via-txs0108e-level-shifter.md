---
description: "BLDC hall sensor (5V open-collector + 5V push-pull variants) wiring to ESP32 via TXS0108E bidirectional level shifter: why BSS138 passive shifters fail on push-pull halls, VCCA-lower-rail requirement, one-shot edge accelerator behavior, and separate hall-power regulator diagnostic."
type: moc
topics:
  - "[[wiring-integration]]"
  - "[[power-systems]]"
  - "[[index]]"
---

# Hall sensors to ESP32 (via TXS0108E level shifter)

BLDC hall sensor (5V open-collector + 5V push-pull variants) wiring to ESP32 via TXS0108E bidirectional level shifter: why BSS138 passive shifters fail on push-pull halls, VCCA-lower-rail requirement, one-shot edge accelerator behavior, and separate hall-power regulator diagnostic.

## Knowledge Notes

_No atomic notes currently link to this topic. Populated by future /extract passes as the relevant wiring batches are processed._

## Open Questions
(populated by /extract)

---

Topics:
- [[wiring-integration]] — Wiring and integration knowledge -- multi-component system wiring, common ground discipline, level shifting topology, pull-up sizing, flyback protection, decoupling placement, EMI suppression, and power distribution across mixed-voltage systems
- [[power-systems]] — Power system knowledge -- battery + BMS (10S Li-ion, lead-acid, LVD), linear + switching regulation, buck/boost topology, parallel rail distribution, fusing (ANL + slow-blow), two-stage E-stop with DC contactors, AC-mains safety capacitors (X-class line-to-line, Y-class line-to-ground), MOSFET low-side switching, and multi-voltage tier design for 36V rover systems
- [[index]] — Entry point to the ProtoPulse knowledge vault -- 528 atomic notes across 11 hardware topic maps covering microcontrollers, actuators, sensors, displays, power, communication, shields, passives, input devices, and system wiring
