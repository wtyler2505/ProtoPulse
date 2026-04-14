---
description: "Wiring and integration knowledge -- multi-component system wiring, common ground discipline, power distribution topology, and system-level integration patterns"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[breadboard-intelligence]]"
---

# wiring-integration

System-level wiring patterns, multi-voltage integration, common ground discipline, and troubleshooting strategies for multi-component builds. Covers motor controller wiring, I2C bus layout, hall sensor integration, level shifting chains, and 36V power distribution.

## Knowledge Notes
- [[tank-steering-replaces-mechanical-steering-with-differential-wheel-speed-control]] — differential-drive control paradigm for dual-motor rovers
- [[opposite-facing-chassis-motors-require-software-or-phase-wire-inversion-to-make-forward-produce-same-direction-wheel-motion]] — mirrored chassis geometry requires direction compensation at build or runtime
- [[pin-double-duty-between-static-digital-output-and-interrupt-input-works-because-enable-is-steady-state-and-interrupt-reads-incoming-pulses]] — single GPIO shared between static output and interrupt input, and when the pattern breaks
- [[swapped-hall-cables-between-dual-controllers-cause-both-motors-to-vibrate-instead-of-just-one-misbehaving]] — multi-controller assembly error with symmetric diagnostic signature
- [[100uf-capacitor-on-arduino-5v-input-absorbs-motor-switching-emi-that-causes-mcu-resets]] — bulk cap across Arduino 5V buffers EMI transients the buck regulator cannot react to fast enough

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[breadboard-intelligence]]
