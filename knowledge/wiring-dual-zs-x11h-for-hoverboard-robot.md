---
description: "Two-motor differential-drive (tank-steer) BLDC wiring for a hoverboard-style robot: dual ZS-X11H controllers, mirrored chassis direction compensation via phase-wire inversion or software, swapped-hall-cable symmetric diagnostic, common-ground star topology, and per-controller bulk decoupling."
type: moc
topics:
  - "[[wiring-integration]]"
  - "[[power-systems]]"
  - "[[index]]"
---

# Dual ZS-X11H for hoverboard robot

Two-motor differential-drive (tank-steer) BLDC wiring for a hoverboard-style robot: dual ZS-X11H controllers, mirrored chassis direction compensation via phase-wire inversion or software, swapped-hall-cable symmetric diagnostic, common-ground star topology, and per-controller bulk decoupling.

## Knowledge Notes

- [[100uf-capacitor-on-arduino-5v-input-absorbs-motor-switching-emi-that-causes-mcu-resets]] — When high-current motor switching (15-30A through BLDC controllers) couples EMI onto a physically close Arduino 5V rail, the MCU may reset
- [[asymmetric-braking-enables-tighter-turns-during-deceleration-by-braking-the-inner-wheel-while-coasting-the-outer]] — On a tank-steered rover, applying brake to the inner wheel while letting the outer wheel coast creates a pivot-like deceleration that
- [[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float]] — The controller V- and MCU GND must be the same electrical node -- without a dedicated ground wire between them, the TTL control inputs (EL,
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] — 4-motor total peak draw (~60A) exceeds typical hoverboard BMS trip point (30-40A) -- either upgrade the BMS or implement firmware current
- [[opposite-facing-chassis-motors-require-software-or-phase-wire-inversion-to-make-forward-produce-same-direction-wheel-motion]] — Two motors mounted on opposite sides of a chassis face mirror-image directions — identical electrical 'forward' commands then produce
- [[pin-double-duty-between-static-digital-output-and-interrupt-input-works-because-enable-is-steady-state-and-interrupt-reads-incoming-pulses]] — When GPIO counts are tight, a single pin can simultaneously drive a static control signal (like a motor enable that sits HIGH or LOW for
- [[sc-speed-pulse-output-enables-closed-loop-rpm-measurement-via-interrupt-counting]] — The SC pin outputs one 5V pulse per Hall state change -- 6 per electrical revolution, 90 per mechanical revolution on a 15-pole-pair motor
- [[speed-must-be-reduced-before-braking-at-high-voltage-because-back-emf-dissipation-in-mosfets-scales-with-rpm]] — Braking a BLDC motor at full speed on a 36V bus forces the motor's back-EMF current through the low-side MOSFETs, and dissipation scales
- [[staggered-motor-startup-by-100ms-prevents-combined-inrush-from-tripping-shared-bms-overcurrent-protection]] — Two or more motors accelerating simultaneously from a single battery stack up their inrush currents, often exceeding the BMS trip point
- [[star-ground-at-distribution-board-prevents-ground-loops-in-multi-circuit-systems]] — All circuit ground returns meet at a single point (star topology) on the distribution board -- prevents motor current from flowing through
- [[swapped-hall-cables-between-dual-controllers-cause-both-motors-to-vibrate-instead-of-just-one-misbehaving]] — In a dual-motor build, each Hall sensor cable must route to its own motor's controller — if the cables are swapped so the left motor's
- [[tank-steering-replaces-mechanical-steering-with-differential-wheel-speed-control]] — Forward, reverse, pivot turns, arc turns, and spin-in-place all emerge from varying independent motor speeds — no steering linkage, servo,

## Open Questions
(populated by /extract)

---

Topics:
- [[wiring-integration]]
- [[power-systems]]
- [[index]]
