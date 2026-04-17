---
description: "Actuator and motor knowledge -- DC/BLDC/stepper/servo/AC motor selection, H-bridge + MOSFET driver comparison (L293D→L298N→TB6612→Cytron MD25HV voltage ladder), PWM and commutation strategies, brake/coast/stop state machines, relay + buzzer drive, and AC-mains motor control via relay/SSR"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# actuators

Motor control theory, driver IC comparison across the brushed-DC voltage ladder (TB6612 13V → L298N 46V → Cytron MD25HV 58V), PWM strategies, commutation tables, brake/coast/stop state machines, and output device selection for the inventory (see [[hardware-components]] for physical specs). Covers BLDC hub motors, brushed DC, steppers, servos, **AC synchronous and AC gearmotors**, buzzers, relays, and their driver boards.

## Driver voltage ladder (resolved tension)

The brushed-DC driver voltage ladder is now fully populated: **TB6612** (13.5V ceiling, MOSFET, internal flyback, sub-uA standby, ~1.2A continuous) → **L298N** (46V ceiling, Darlington, no internal flyback, 2A continuous, 2-5V saturation loss) → **Cytron MD25HV** (58V ceiling, MOSFET with active current limiting, 25A continuous / 60A peak). This resolves the older tension note `mosfet-driver-efficiency-conflicts-with-voltage-range...` — MOSFET efficiency is NOT lost at high voltage, it was only absent from the hobby-tier TB6612. At the 36V rover tier (10S Li-ion), MD25HV is the first driver that keeps MOSFET efficiency AND active current limiting AND adequate voltage headroom simultaneously.

## Knowledge Notes

### Actuator selection (top-level)
- [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] — PWM means different things for DC motors, servos, and BLDC
- [[driver-ic-selection-follows-from-actuator-type-not-power-rating-alone]] — driver architecture must match actuator type before checking power ratings
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] — four voltage tiers with different supply and isolation requirements
- [[salvaged-generic-components-have-no-datasheets-so-specs-must-be-determined-empirically]] — no datasheet is the default for salvage and generic parts
- [[motor-insulation-class-letters-encode-maximum-winding-temperature-class-a-is-105c-b-is-130c-f-is-155c-h-is-180c]] — insulation class is the primary thermal rating on salvaged motor nameplates

### BLDC (hoverboard + salvage)
- [[outrunner-hub-motors-eliminate-mechanical-transmission-by-making-the-wheel-the-rotor]] — hub motor architecture removes drivetrain complexity entirely
- [[hoverboard-motor-power-ratings-are-unreliable-because-manufacturers-inflate-specs-for-marketing]] — use 250W continuous / 350W peak, not advertised numbers
- [[hoverboard-wheel-size-determines-speed-torque-tradeoff-and-terrain-capability]] — 6.5/8/10 inch variants with different speed, torque, and terrain tradeoffs
- [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] — 4-motor peak draw exceeds standard BMS, needs limiting or upgrade
- [[hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position]] — Hall outputs are open-collector producing 6-state Gray code per electrical revolution
- [[hall-sensor-wiring-order-matters-for-bldc]] — hall wiring permutations affect commutation correctness
- [[pole-pair-count-is-determined-empirically-by-counting-hall-state-transitions-per-wheel-revolution]] — bench technique for characterizing salvaged BLDC motors
- [[bldc-commutation-table-maps-hall-states-to-phase-pairs-and-only-two-of-six-wire-permutations-produce-smooth-rotation]] — 6-step table; 67% wrong-wiring probability; systematic swap protocol
- [[bldc-direction-reversal-under-load-creates-destructive-current-spikes-through-mosfets]] — must stop motor before toggling direction; back-EMF spikes exceed ratings
- [[bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float]] — floating ground causes erratic motor behavior indistinguishable from wiring errors
- [[high-current-motor-phase-wires-require-14awg-minimum-and-undersized-wiring-is-a-fire-hazard]] — wire gauge is safety-critical at 15A peak
- [[motor-power-wiring-below-14awg-overheats-at-15a-and-creates-fire-risk-so-gauge-is-chosen-by-steady-state-current-not-voltage]] — ampacity sizing by steady-state current, not voltage class

### ZS-X11H BLDC controller (module-specific)
- [[bldc-stop-active-low-brake-active-high]] — two-pin polarity convention for ZS-X11H and KJL-01
- [[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]] — active-LOW PWM where analogWrite(0) = full speed; analog mode has opposite polarity
- [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] — zero onboard protection; inline fuse is the only safety net
- [[ct-brake-polarity-on-the-zs-x11h-is-active-low-contradicting-the-kjl-01-claim-that-brake-is-active-high-suggesting-the-polarity-is-vendor-specific-not-a-bldc-convention]] — vendor-specific brake polarity, not a BLDC standard
- [[el-pin-floating-at-mcu-boot-defaults-the-motor-to-full-speed-so-explicit-high-initialization-is-mandatory-before-stop-is-enabled]] — boot-time full-speed default requires explicit safe-state init
- [[safe-bldc-startup-sequence-initializes-el-stopped-then-brake-engaged-then-enable-low-before-setting-any-active-state]] — ordered init sequence for ZS-X11H-class controllers
- [[emergency-stop-via-stop-pin-low-disables-bldc-controllers-entirely-and-is-safer-than-regenerative-braking-for-fault-conditions]] — STOP pin > regen brake for fault conditions
- [[stop-is-the-correct-emergency-kill-and-ct-brake-is-for-controlled-deceleration-because-only-stop-removes-the-controller-power-path-entirely]] — functional distinction between STOP and CT-BRAKE
- [[sc-speed-pulse-output-enables-closed-loop-rpm-measurement-via-interrupt-counting]] — SC pin outputs 6 pulses per electrical revolution; RPM = (freq / (6 * pole_pairs)) * 60
- [[78l05-regulator-failure-kills-hall-power-making-motor-appear-dead-when-only-the-regulator-failed]] — single point of failure with non-obvious diagnostic signature
- [[powering-the-mcu-from-the-zs-x11h-5v-output-causes-resets-because-motor-switching-noise-on-the-shared-rail-corrupts-the-logic-supply]] — shared 5V rail injects switching noise into MCU; use separate supply
- [[100uf-capacitor-on-arduino-5v-input-absorbs-motor-switching-emi-that-causes-mcu-resets]] — bulk cap on MCU 5V input absorbs conducted motor EMI

### Brushed DC (L293D, L298N, TB6612, Cytron MD25HV)
- [[l293d-dip-16-package-makes-it-the-only-motor-driver-ic-that-drops-directly-into-a-breadboard]] — DIP-16 straddles breadboard center channel; all alternatives need breakout boards
- [[l293d-ground-pins-are-the-primary-thermal-dissipation-path-not-just-electrical-connections]] — 4 GND pins bonded to die lead frame; 6 sq inches copper pour for full rating
- [[l293d-voltage-drop-is-1-4v-per-switch-totaling-2-8v-across-the-full-h-bridge-path]] — bipolar switching steals 2.8V from motor supply; 6V motors get only 3.2V
- [[l293d-separates-speed-control-on-enable-pins-from-direction-control-on-input-pins]] — PWM on enable for speed, digital on inputs for direction
- [[the-d-suffix-on-l293d-denotes-built-in-clamp-diodes-and-the-non-d-variant-is-a-destructive-substitution]] — L293 vs L293D part number distinction; non-D variant silently destroys under load
- [[l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current]] — Darlington architecture wastes up to 40% of supply voltage as heat at 2A
- [[l298n-has-no-internal-flyback-diodes-unlike-l293d-making-external-protection-mandatory]] — L298N omits clamp diodes that L293D includes; external fast-recovery diodes required
- [[l298n-ttl-input-thresholds-allow-3v3-mcu-control-despite-5v-logic-supply]] — TTL thresholds (2.3V HIGH) mean 3.3V MCUs can drive L298N inputs directly
- [[l298n-needs-heatsink-above-half-amp-because-25w-package-limit-is-reached-quickly-with-darlington-drops]] — 25W package limit consumed rapidly by Darlington saturation voltage at moderate current
- [[tb6612-mosfet-h-bridge-drops-0-5v-versus-darlington-1-8-to-4-9v-because-rds-on-resistance-beats-saturation-voltage]] — MOSFET architecture is the root reason the TB6612 runs cool and efficient where L293D/L298N cannot
- [[tb6612-pwm-ceiling-of-100khz-is-4x-the-l298n-and-20x-the-l293d-because-mosfet-switching-has-no-storage-time]] — MOSFET carrier storage is zero, so PWM ceiling is ultrasonic; eliminates motor whine the L293D/L298N produce
- [[tb6612-motor-supply-ceiling-of-13-5v-is-a-hard-selection-boundary-against-l298n-for-24v-and-36v-motor-systems]] — TB6612 is structurally eliminated above 13.5V regardless of other advantages
- [[tb6612-standby-pin-adds-a-fifth-motor-state-below-brake-and-coast-with-sub-microamp-quiescent-current]] — STBY LOW enters sub-uA sleep, a battery-friendly fifth state L298N cannot replicate
- [[tb6612-internal-flyback-diodes-eliminate-the-external-protection-burden-that-l298n-requires]] — MOSFET body diodes clamp back-EMF internally, matching L293D and unlike L298N
- [[cytron-md25hv-completes-the-brushed-dc-driver-voltage-ladder-tb6612-at-13v-l298n-at-46v-md25hv-at-58v-with-25a-continuous]] — MD25HV fills the 58V/25A high-voltage MOSFET slot that resolves the older voltage-vs-efficiency tension
- [[active-current-limiting-motor-drivers-throttle-output-instead-of-crowbar-shutdown-preserving-motion-under-transient-overload]] — active limiting keeps vehicles moving under transient load rather than cutting abruptly
- [[motor-driver-with-integrated-bec-can-power-the-arduino-directly-eliminating-a-separate-buck-converter-if-the-bec-current-is-sufficient]] — integrated BEC removes a discrete buck at the cost of shared ground noise
- [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]] — 470uF 63V cap across V+/V- absorbs flyback spikes on all motor drivers

### Steppers
- [[28byj-48-gear-reduction-trades-speed-for-precision-at-a-ratio-that-eliminates-most-dynamic-applications]] — 1:64 gear ratio gives sub-degree resolution but caps speed at ~15 RPM
- [[stepper-drive-mode-selection-is-a-three-way-trade-between-torque-smoothness-and-resolution]] — wave drive, two-phase, and half-step offer different torque/smoothness/resolution profiles
- [[open-loop-steppers-silently-lose-position-on-stall-and-have-no-recovery-mechanism-without-external-feedback]] — stall or skip events are undetectable without external feedback
- [[stepper-holding-current-draws-continuous-power-even-when-stationary-making-de-energize-logic-essential-for-battery-projects]] — holding position costs continuous current draw identical to movement
- [[accelstepper-pin-order-for-28byj-48-is-not-sequential-and-miswiring-produces-vibration-instead-of-rotation]] — pin constructor order is IN1, IN3, IN2, IN4 (not sequential)

### AC motors (Wave H — new territory)
- [[ac-synchronous-motor-locks-rotor-speed-to-line-frequency-making-it-the-standard-choice-for-wall-clock-precision-timing-without-feedback]] — TDY-50-class synchronous motors for timing applications
- [[ac-gearmotors-swap-pwm-speed-control-for-gearbox-torque-multiplication-producing-high-torque-low-speed-output-without-an-h-bridge]] — Von Weise-class gearmotors trade variable speed for rugged high-torque output
- [[permanent-split-capacitor-psc-motor-uses-an-always-in-circuit-run-capacitor-to-generate-the-rotating-field-that-single-phase-ac-cannot-produce-natively]] — PSC topology, the dominant single-phase AC motor type in appliances and treadmills
- [[mcu-controlling-ac-motor-needs-a-relay-or-ssr-because-gpio-cannot-switch-mains-voltage-or-current-directly]] — relay or SSR is the mandatory isolation layer between MCU logic and mains-voltage AC load
- [[commercial-exercise-equipment-splits-hmi-panel-from-motor-controller-via-ribbon-cable-because-panel-electronics-and-motor-power-have-incompatible-noise-budgets]] — Cybex treadmill-style panel/controller split justified by noise-budget incompatibility

### Relays + buzzers
- [[relay-coil-draws-70ma-which-exceeds-gpio-limits-on-every-common-mcu]] — bare relay coils need transistor/MOSFET driver, not direct GPIO
- [[relay-coil-is-an-inductor-that-generates-destructive-back-emf-spikes-when-de-energized]] — flyback diode mandatory across coil terminals
- [[relay-electrical-life-is-100x-shorter-than-mechanical-life-because-arcing-erodes-contacts]] — 100K electrical vs 10M mechanical cycles; SSR for high-frequency switching
- [[arduino-tone-uses-timer2-which-disables-pwm-on-pins-3-and-11-creating-invisible-resource-conflicts]] — tone() commandeers Timer2 silently breaking PWM on pins 3/11
- [[esp32-replaces-tone-with-ledcwritetone-and-the-api-is-not-a-drop-in-substitution]] — ESP32 tone API requires channel management absent from AVR
- [[dc-voltage-on-a-passive-buzzer-produces-only-a-click-because-there-is-no-internal-oscillator]] — DC on passive buzzer = silence; frequency-driven control required
- [[passive-buzzer-polarity-markings-are-inconsistent-and-assuming-no-polarity-is-unsafe]] — some passive buzzers do have polarity despite convention saying otherwise

### Control concepts (brake/coast/standby, PWM, dual-motor)
- [[h-bridge-brake-and-coast-are-distinct-stop-modes-that-beginners-conflate]] — both-HIGH = brake (fast stop), both-LOW = coast (free run); different behaviors and thermal impacts
- [[dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets]] — holding brake after stop creates heat with no back-EMF to limit current
- [[motor-speed-must-be-ramped-below-50-percent-before-activating-the-brake-because-high-speed-regenerative-braking-stresses-the-controller]] — brake after decel ramp; regen at full speed exceeds controller thermal envelope
- [[speed-must-be-reduced-before-braking-at-high-voltage-because-back-emf-dissipation-in-mosfets-scales-with-rpm]] — ramp PWM to zero before engaging brake; at 36V/15A the full-speed brake transient can exceed MOSFET thermal envelope
- [[tank-steering-replaces-mechanical-steering-with-differential-wheel-speed-control]] — dual-motor differential-drive paradigm eliminates steering linkage entirely
- [[opposite-facing-chassis-motors-require-software-or-phase-wire-inversion-to-make-forward-produce-same-direction-wheel-motion]] — mirrored motor mounting requires direction compensation; software inversion vs phase-wire swap trade-off
- [[staggered-motor-startup-by-100ms-prevents-combined-inrush-from-tripping-shared-bms-overcurrent-protection]] — cheapest BMS-trip mitigation: timing-only, no current sensing required
- [[asymmetric-braking-enables-tighter-turns-during-deceleration-by-braking-the-inner-wheel-while-coasting-the-outer]] — dual-motor-specific braking strategy that tightens turn radius during stops
- [[swapped-hall-cables-between-dual-controllers-cause-both-motors-to-vibrate-instead-of-just-one-misbehaving]] — symmetric failure mode from asymmetric cause in multi-controller systems
- [[per-branch-motor-fusing-enables-graceful-degradation-because-a-single-motor-fault-blows-its-own-fuse-not-the-main]] — per-motor fuses preserve partial mobility when one motor faults
- [[bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors]] — single-path BMS output means motor fault can brownout logic
- [[esp32-4wd-rover-consumes-20-of-34-gpios-for-motor-control-forcing-use-of-strapping-and-input-only-pins]] — 4-motor ESP32 rover pin budget forces strapping-pin recruitment
- [[boot-time-setup-must-set-strapping-pins-to-the-safe-motor-state-before-any-other-initialization]] — strapping-pin motor wiring requires ordered safe-state init

### Motor shields (see also [[shields]])
- [[hw-130-motor-shield-is-an-adafruit-motor-shield-v1-clone-that-uses-the-afmotor-library-unchanged]] — HW-130 is pin-for-pin Adafruit Motor Shield V1 clone; AFMotor library works unmodified
- [[74hc595-in-motor-shields-trades-gpio-savings-for-direction-change-latency-that-matters-at-high-switching-frequencies]] — shift-register direction saves pins but inserts serial-shift latency that matters for steppers
- [[hw-130-shield-consumes-both-timer0-and-timer2-leaving-only-timer1-free-for-other-libraries]] — four-channel motor PWM locks Timer0 and Timer2; only Servo (Timer1) remains compatible
- [[counterfeit-l293d-chips-on-clone-motor-shields-deliver-lower-than-rated-current-with-no-external-indication]] — cheap HW-130 batches may have sub-600mA counterfeit chips that mimic undersized-driver symptoms
- [[combo-motor-and-servo-shields-trade-per-function-efficiency-for-single-board-convenience]] — combo boards like OSEPP Motor/Servo V1 inherit L298N inefficiency AND the shared 5V servo rail compromise
- [[shield-servo-headers-share-arduino-5v-creating-hidden-brownout-path-that-only-trace-cutting-fixes]] — motor shield servo headers route Arduino 5V, safe only for SG90 micro servos; full-size servos need external power via trace cut

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
