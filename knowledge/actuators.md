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
- [[28byj-48-gear-reduction-trades-speed-for-precision-at-a-ratio-that-eliminates-most-dynamic-applications]] — 1:64 gear ratio gives sub-degree resolution but caps speed at ~15 RPM
- [[stepper-drive-mode-selection-is-a-three-way-trade-between-torque-smoothness-and-resolution]] — wave drive, two-phase, and half-step offer different torque/smoothness/resolution profiles
- [[open-loop-steppers-silently-lose-position-on-stall-and-have-no-recovery-mechanism-without-external-feedback]] — stall or skip events are undetectable without external feedback
- [[stepper-holding-current-draws-continuous-power-even-when-stationary-making-de-energize-logic-essential-for-battery-projects]] — holding position costs continuous current draw identical to movement
- [[accelstepper-pin-order-for-28byj-48-is-not-sequential-and-miswiring-produces-vibration-instead-of-rotation]] — pin constructor order is IN1, IN3, IN2, IN4 (not sequential)
- [[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]] — active-LOW PWM where analogWrite(0) = full speed; analog mode has opposite polarity
- [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] — zero onboard protection; inline fuse is the only safety net
- [[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float]] — floating ground causes erratic motor behavior indistinguishable from wiring errors
- [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]] — holding brake after stop creates heat with no back-EMF to limit current
- [[bldc-direction-reversal-under-load-creates-destructive-current-spikes-through-mosfets]] — must stop motor before toggling direction; back-EMF spikes exceed ratings
- [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]] — 470uF 63V cap across V+/V- absorbs flyback spikes on all motor drivers
- [[sc-speed-pulse-output-enables-closed-loop-rpm-measurement-via-interrupt-counting]] — SC pin outputs 6 pulses per electrical revolution; RPM = (freq / (6 * pole_pairs)) * 60
- [[78l05-regulator-failure-kills-hall-power-making-motor-appear-dead-when-only-the-regulator-failed]] — single point of failure with non-obvious diagnostic signature
- [[bldc-commutation-table-maps-hall-states-to-phase-pairs-and-only-two-of-six-wire-permutations-produce-smooth-rotation]] — 6-step table; 67% wrong-wiring probability; systematic swap protocol
- [[l293d-ground-pins-are-the-primary-thermal-dissipation-path-not-just-electrical-connections]] — 4 GND pins bonded to die lead frame; 6 sq inches copper pour for full rating
- [[l293d-voltage-drop-is-1-4v-per-switch-totaling-2-8v-across-the-full-h-bridge-path]] — bipolar switching steals 2.8V from motor supply; 6V motors get only 3.2V
- [[the-d-suffix-on-l293d-denotes-built-in-clamp-diodes-and-the-non-d-variant-is-a-destructive-substitution]] — L293 vs L293D part number distinction; non-D variant silently destroys under load
- [[l293d-dip-16-package-makes-it-the-only-motor-driver-ic-that-drops-directly-into-a-breadboard]] — DIP-16 straddles breadboard center channel; all alternatives need breakout boards
- [[l293d-separates-speed-control-on-enable-pins-from-direction-control-on-input-pins]] — PWM on enable for speed, digital on inputs for direction
- [[hw-130-motor-shield-is-an-adafruit-motor-shield-v1-clone-that-uses-the-afmotor-library-unchanged]] — HW-130 is pin-for-pin Adafruit Motor Shield V1 clone; AFMotor library works unmodified
- [[74hc595-in-motor-shields-trades-gpio-savings-for-direction-change-latency-that-matters-at-high-switching-frequencies]] — shift-register direction saves pins but inserts serial-shift latency that matters for steppers
- [[hw-130-shield-consumes-both-timer0-and-timer2-leaving-only-timer1-free-for-other-libraries]] — four-channel motor PWM locks Timer0 and Timer2; only Servo (Timer1) remains compatible
- [[counterfeit-l293d-chips-on-clone-motor-shields-deliver-lower-than-rated-current-with-no-external-indication]] — cheap HW-130 batches may have sub-600mA counterfeit chips that mimic undersized-driver symptoms

- [[arduino-tone-uses-timer2-which-disables-pwm-on-pins-3-and-11-creating-invisible-resource-conflicts]] — tone() commandeers Timer2 silently breaking PWM on pins 3/11
- [[esp32-replaces-tone-with-ledcwritetone-and-the-api-is-not-a-drop-in-substitution]] — ESP32 tone API requires channel management absent from AVR
- [[dc-voltage-on-a-passive-buzzer-produces-only-a-click-because-there-is-no-internal-oscillator]] — DC on passive buzzer = silence; frequency-driven control required
- [[passive-buzzer-polarity-markings-are-inconsistent-and-assuming-no-polarity-is-unsafe]] — some passive buzzers do have polarity despite convention saying otherwise
- [[relay-coil-draws-70ma-which-exceeds-gpio-limits-on-every-common-mcu]] — bare relay coils need transistor/MOSFET driver, not direct GPIO
- [[relay-coil-is-an-inductor-that-generates-destructive-back-emf-spikes-when-de-energized]] — flyback diode mandatory across coil terminals
- [[relay-electrical-life-is-100x-shorter-than-mechanical-life-because-arcing-erodes-contacts]] — 100K electrical vs 10M mechanical cycles; SSR for high-frequency switching

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
