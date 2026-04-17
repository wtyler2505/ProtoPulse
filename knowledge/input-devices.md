---
description: "Input device knowledge -- joystick ADC mapping, keypad matrix scanning, rotary encoder debouncing, and human interface design for embedded systems"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# input-devices

Analog and digital input devices, debouncing strategies, matrix scanning, ADC mapping, and human interface patterns for the inventory (see [[hardware-components]] for physical specs). Covers joysticks, keypads, rotary encoders, and push-button switches.

## Knowledge Notes

### Potentiometers
- [[a-potentiometer-wired-as-voltage-divider-converts-mechanical-rotation-to-proportional-analog-voltage-for-mcu-analogread]] — VCC-wiper-GND three-wire pattern; the simplest human-to-MCU analog input
- [[b-taper-linear-potentiometer-is-for-voltage-sensing-and-a-taper-logarithmic-is-for-audio-volume-and-confusing-them-is-a-silent-design-error]] — B vs A taper; wrong taper creates behavior that looks like a code bug
- [[potentiometer-300-degree-rotation-range-with-mechanical-stops-means-software-must-handle-endpoint-dead-zones-in-adc-reading]] — Dead zones at mechanical stops require software map() trimming
- [[potentiometer-20-percent-resistance-tolerance-is-irrelevant-in-voltage-divider-mode-because-output-depends-on-wiper-position-ratio-not-absolute-resistance]] — Tolerance cancels in divider mode

### Joystick
- [[joystick-module-is-two-potentiometers-on-a-spring-return-gimbal-consuming-two-analog-pins-plus-one-digital-pin]] — KY-023 composite device: 2 pots + pushbutton, entirely passive, spring-return centering
- [[joystick-sw-pin-has-no-onboard-pull-up-requiring-input-pullup-or-external-resistor-to-avoid-floating-input]] — SW line floats without pull-up; INPUT_PULLUP or 10K to VCC required
- [[joystick-center-position-reads-approximately-512-but-varies-per-unit-requiring-per-unit-software-calibration]] — Spring settles at different points per unit; calibrate center at startup + dead zone
- [[running-joystick-at-3v3-scales-analog-output-proportionally-so-code-expecting-0-1023-range-sees-0-675-maximum]] — VCC mismatch compresses ADC range; match supply to ADC reference voltage

### Rotary Encoder
- [[quadrature-encoding-detects-rotation-direction-from-phase-lead-lag-between-two-square-wave-channels]] — A/B 90-degree offset encodes direction; count transitions for displacement
- [[incremental-encoder-has-no-position-memory-across-power-cycles-making-it-a-relative-only-input-device]] — No absolute position; relative-only, requires continuous interrupt monitoring
- [[mechanical-encoder-contact-bounce-requires-interrupt-driven-debounce-not-polling]] — 2-5ms bounce per detent; Stoffregen Encoder library with state machine ISR
- [[rotary-encoder-with-pushbutton-provides-scroll-plus-select-in-one-component]] — KY-040 integrates scroll + confirm in single 3-pin component
- [[ky040-module-includes-onboard-10k-pull-ups-on-all-signal-pins-unlike-bare-encoder-or-joystick-modules]] — Onboard 10K pull-ups = works out-of-box, contrast with joystick SW pin

### Keypad
- [[matrix-keypad-scanning-drives-one-row-low-at-a-time-and-reads-columns-with-pull-ups-to-detect-key-position]] — Row/column scanning algorithm; inverse of LED matrix multiplexing
- [[4x4-matrix-keypad-consumes-8-gpio-pins-making-io-expander-mandatory-on-pin-constrained-mcus]] — 8 pins = 57% of Uno budget; PCF8574 reduces to 2 I2C pins
- [[membrane-keypad-is-a-passive-switch-matrix-with-no-active-logic-so-it-operates-at-any-mcu-voltage-without-level-shifting]] — Zero active electronics; works at any logic voltage without adaptation
- [[membrane-keypad-has-no-built-in-debouncing-requiring-software-scan-timing]] — Arduino Keypad library handles debounce via multi-scan consistency
- [[membrane-switch-wear-limits-keypads-to-low-cycle-applications-unlike-mechanical-switches]] — 1M cycle rated life; fine for PIN entry, inadequate for gaming/industrial

### Switches (Multi-Position)
- [[self-locking-radio-button-switch-provides-hardware-mutual-exclusion-eliminating-software-mode-conflict-logic]] — Mechanical interlock = exactly one mode active, guaranteed by physics
- [[multi-pole-switch-pinout-must-be-mapped-by-continuity-testing-because-pin-assignments-are-not-standardized]] — 18-pin dense arrays need multimeter verification before wiring
- [[six-pole-switch-consumes-6-gpio-pins-but-priority-encoder-can-reduce-to-3-for-one-hot-state]] — Direct 6-pin vs 74HC148 priority encoder vs resistor ladder trade-off
- [[mechanical-latching-switch-still-requires-software-debounce-because-contact-bounce-is-independent-of-latch-mechanism]] — Latch solves mutual exclusion but contacts still bounce 10-50ms
- [[radio-button-hardware-switch-trades-fixed-mode-count-for-zero-state-management-versus-encoder-with-unlimited-software-modes]] — Hardware certainty vs software flexibility decision boundary
- [[passive-mechanical-switches-draw-zero-quiescent-current-making-them-ideal-battery-wake-triggers]] — zero quiescent current makes mechanical switches ideal for battery wake

### IR Remote (as Input)
- [[nec-ir-button-codes-are-manufacturer-specific-making-code-first-debugging-impossible-without-reading-your-own-remote]] — NEC codes are remote-specific; dump your own remote first
- [[dead-coin-cell-is-the-invisible-first-failure-mode-on-kit-ir-remotes]] — CR2025 failure is the #1 "remote doesn't work" false alarm
- [[kit-ir-receiver-modules-from-different-manufacturers-are-functionally-identical-tsop-38khz-demodulators]] — cross-vendor IR receiver interchangeability

## Open Questions
(populated by /extract)

## Synthesis Opportunities

- **Passive-vs-active power tradeoff is a cross-class meta-pattern.** The same zero-quiescent-current vs ~100uA-active distinction appears in switches ([[passive-mechanical-switches-draw-zero-quiescent-current-making-them-ideal-battery-wake-triggers]]), level shifters ([[active-level-shifters-draw-continuous-quiescent-current-unlike-passive-bss138-shifters-with-near-zero-idle-draw]]), and now keypad matrices ([[membrane-keypad-is-a-passive-switch-matrix-with-no-active-logic-so-it-operates-at-any-mcu-voltage-without-level-shifting]]). Not yet named as a principle. Candidate claim: "passive component classes (switches, MOSFET shifters, mechanical matrices) add zero to sleep budgets while their active counterparts add ~100uA floor — the distinction is architectural, not incidental." Would sit under [[eda-fundamentals]] as a design heuristic.

---

Agent Notes:
- 2026-04-14: /connect pass on [[membrane-keypad-is-a-passive-switch-matrix-with-no-active-logic-so-it-operates-at-any-mcu-voltage-without-level-shifting]]. qmd index stale (57/480), fell back to grep-only discovery. Found that membrane-keypad's zero-quiescent-current bullet rhymes exactly with the passive-mechanical-switches wake-trigger note — the keypad generalizes single-switch passivity to a matrix. Also connects sideways to the level-shifter topology framework as the degenerate case (no signal = no shifter regardless of voltage). Bidirectional link added to passive-switches note; skipped reverse on signal-topology because passive counter-examples would dilute its active-signal focus.

---

Topics:
- [[eda-fundamentals]]
- [[index]]
