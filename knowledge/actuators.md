---
description: "Actuator and motor knowledge -- H-bridge logic, BLDC control, stepper sequences, servo PWM, buzzer drive, relay switching, and motor driver selection"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# actuators

Motor control theory, driver IC comparison, PWM strategies, and output device selection for the inventory. Covers BLDC hub motors, DC motors, steppers, servos, buzzers, relays, and their driver boards.

## Knowledge Notes
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] — PWM means different things for DC motors, servos, and BLDC
- [[driver-ic-selection-follows-from-actuator-type-not-power-rating-alone]] — driver architecture must match actuator type before checking power ratings
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] — four voltage tiers with different supply and isolation requirements
- [[outrunner-hub-motors-eliminate-mechanical-transmission-by-making-the-wheel-the-rotor]] — hub motor architecture removes drivetrain complexity entirely
- [[hoverboard-motor-power-ratings-are-unreliable-because-manufacturers-inflate-specs-for-marketing]] — use 250W continuous / 350W peak, not advertised numbers
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] — 4-motor peak draw exceeds standard BMS, needs limiting or upgrade
- [[hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position]] — Hall outputs are open-collector producing 6-state Gray code per electrical revolution
- [[pole-pair-count-is-determined-empirically-by-counting-hall-state-transitions-per-wheel-revolution]] — bench technique for characterizing salvaged BLDC motors
- [[hoverboard-wheel-size-determines-speed-torque-tradeoff-and-terrain-capability]] — 6.5/8/10 inch variants with different speed, torque, and terrain tradeoffs
- [[high-current-motor-phase-wires-require-14awg-minimum-and-undersized-wiring-is-a-fire-hazard]] — wire gauge is safety-critical at 15A peak
- [[salvaged-generic-components-have-no-datasheets-so-specs-must-be-determined-empirically]] — no datasheet is the default for salvage and generic parts
- [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]] — Darlington architecture wastes up to 40% of supply voltage as heat at 2A
- [[l298n-has-no-internal-flyback-diodes-unlike-l293d-making-external-protection-mandatory]] — L298N omits clamp diodes that L293D includes; external fast-recovery diodes required
- [[l298n-ttl-input-thresholds-allow-3v3-mcu-control-despite-5v-logic-supply]] — TTL thresholds (2.3V HIGH) mean 3.3V MCUs can drive L298N inputs directly
- [[h-bridge-brake-and-coast-are-distinct-stop-modes-that-beginners-conflate]] — both-HIGH = brake (fast stop), both-LOW = coast (free run); different behaviors and thermal impacts
- [[l298n-needs-heatsink-above-half-amp-because-25w-package-limit-is-reached-quickly-with-darlington-drops]] — 25W package limit consumed rapidly by Darlington saturation voltage at moderate current

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
