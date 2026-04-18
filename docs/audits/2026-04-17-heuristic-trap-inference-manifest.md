# heuristic-trap-inference Manifest — 2026-04-17

Enumeration of every rule in `client/src/lib/heuristic-trap-inference.ts` (13 rules) against the
`knowledge/` vault corpus to surface coverage gaps. Produced for audit #252.

---

## Scope note: two related but distinct modules

`heuristic-trap-inference.ts` and `breadboard-board-audit.ts` both cover ESP32 strapping-pin
hazards, but through different code paths:

| Module | Trigger | Output type | Confidence |
|--------|---------|-------------|------------|
| `heuristic-trap-inference.ts` | `inferTraps({ family, title })` — fires on **unverified** parts at placement time | `InferredTrap[]` — shown as floating coach cards | `'inferred'` |
| `breadboard-board-audit.ts` → `checkHeuristicEsp32RestrictedPins()` | Board-wide DRC audit — fires only when an ESP32 pin is **wired to a net** | `BoardAuditIssue[]` — shown in DRC panel | `'verified'` |

Task 1.6 (audit #241/#256) added `checkHeuristicEsp32RestrictedPins` to `breadboard-board-audit.ts`.
That function covers GPIO 6-11, GPIO12, GPIO5, and GPIO0 — the same ground as four of the 13 rules
below — but at a more precise level (it fires only when the pin is actually wired). The heuristic
trap rules fire earlier as a warning even before wiring, and they are not redundant with the DRC
check. Both should exist. This manifest covers **only** `heuristic-trap-inference.ts`.

---

## Part 1 — Currently implemented rules

Rules are organized by their generating function inside the module. Total: **13 rules**.

### ESP32 traps — `esp32Traps()` (always fires when `family=mcu` and title contains "esp32")

| Rule ID | Severity | Category | Family trigger | Title pattern | Vault slug |
|---------|----------|----------|----------------|---------------|------------|
| `esp32-flash-gpio` | critical | safety | mcu | title ~ "esp32" | `esp32-six-flash-gpios-must-never-be-used` |
| `esp32-adc2-wifi` | warning | signal | mcu | title ~ "esp32" | `esp32-adc2-unavailable-when-wifi-active` |
| `esp32-gpio12-strapping` | critical | safety | mcu | title ~ "esp32" | `esp32-gpio12-must-be-low-at-boot-or-module-crashes` |
| `esp32-gpio0-boot` | warning | signal | mcu | title ~ "esp32" | `esp32-gpio5-is-a-strapping-pin-...` (closest match; no dedicated GPIO0 slug) |

### ATmega / Arduino traps — `avrTraps()` (fires when title ~ "atmega" or "arduino")

| Rule ID | Severity | Category | Family trigger | Title pattern | Vault slug |
|---------|----------|----------|----------------|---------------|------------|
| `avr-5v-logic` | warning | power | mcu | title ~ "atmega" or "arduino" | *(no dedicated slug — general 5V/3.3V level-shift notes cover this)* |
| `avr-serial-conflict` | info | signal | mcu | title ~ "atmega" or "arduino" | *(no dedicated slug)* |
| `avr-reset-noise` | info | signal | mcu | title ~ "atmega" or "arduino" | *(no dedicated slug)* |

### 3.3 V ARM MCU traps — `arm3v3Traps()` (fires when title ~ "rp2040", "pico", "stm32", "nrf", "samd")

| Rule ID | Severity | Category | Family trigger | Title pattern | Vault slug |
|---------|----------|----------|----------------|---------------|------------|
| `mcu-3v3-logic` | warning | power | mcu | title ~ rp2040 / pico / stm32 / nrf / samd | *(no dedicated slug)* |

### BLDC motor traps — `bldcTraps()` (fires when `isBldcDriver()` → title ~ "bldc" or "riorand")

| Rule ID | Severity | Category | Family trigger | Title pattern | Vault slug |
|---------|----------|----------|----------------|---------------|------------|
| `motor-brake-polarity` | critical | safety | driver | title ~ bldc / riorand | `bldc-stop-active-low-brake-active-high` / `ct-brake-polarity-on-the-zs-x11h-...` |
| `motor-hall-order` | warning | signal | driver | title ~ bldc / riorand | `hall-sensor-wiring-order-matters-for-bldc` |

### H-Bridge traps — `hBridgeTraps()` (fires when `isHBridgeDriver()` → title ~ h-bridge / l298 / l293 / l9110 / tb6612 / drv8 / bts7960)

| Rule ID | Severity | Category | Family trigger | Title pattern | Vault slug |
|---------|----------|----------|----------------|---------------|------------|
| `motor-back-emf` | warning | safety | driver | title ~ h-bridge variants | `l298n-has-no-internal-flyback-diodes-unlike-l293d-making-external-protection-mandatory` |
| `motor-shoot-through` | warning | safety | driver | title ~ h-bridge variants | *(no dedicated slug — implied by dead-time/complementary-PWM notes)* |

### Motor PWM trap — `motorPwmTrap()` (fires for ALL motor drivers)

| Rule ID | Severity | Category | Family trigger | Title pattern | Vault slug |
|---------|----------|----------|----------------|---------------|------------|
| `motor-pwm-frequency` | info | signal | driver | any `isMotorDriver()` match | *(no dedicated slug)* |

**Total: 13 rules** (4 ESP32 + 3 AVR + 1 ARM3V3 + 2 BLDC + 2 H-Bridge + 1 motor-PWM)

---

## Part 2 — Vault coverage matrix

The vault contains 427 notes matching broad hardware keywords. After filtering to strictly
breadboard-hazard content (notes whose slug or content addresses actionable physical wiring/assembly
mistakes), the focused corpus is ~90 notes. The matrix below is organized by topic. "Covered by"
means a current `heuristic-trap-inference.ts` rule maps to the same hazard.

### ESP32 — strapping pins & boot

| Vault slug | Covered by | Notes |
|-----------|------------|-------|
| `esp32-six-flash-gpios-must-never-be-used` | `esp32-flash-gpio` | Covered (critical) |
| `esp32-gpio12-must-be-low-at-boot-or-module-crashes` | `esp32-gpio12-strapping` | Covered (critical) |
| `esp32-gpio5-is-a-strapping-pin-for-boot-message-printing-and-should-not-be-treated-as-unconditionally-safe` | GAP | No heuristic-trap rule for GPIO5 (only `checkHeuristicEsp32RestrictedPins` in audit module) |
| `esp32-gpio0-boot` | `esp32-gpio0-boot` | Covered (warning) — no dedicated vault slug, but rule exists |
| `boot-time-setup-must-set-strapping-pins-to-the-safe-motor-state-before-any-other-initialization` | GAP | Combination of motor boot state + strapping; not directly modeled |
| `74hc14-schmitt-trigger-buffer-isolates-esp32-strapping-pins-from-external-loads-during-boot` | GAP | Remediation pattern knowledge — no "use a buffer on strapping pins" warning |
| `esp32-4wd-rover-consumes-20-of-34-gpios-for-motor-control-forcing-use-of-strapping-and-input-only-pins` | GAP | GPIO budget / strapping-pin conflict at system level |

### ESP32 — ADC, power, peripherals

| Vault slug | Covered by | Notes |
|-----------|------------|-------|
| `esp32-adc2-unavailable-when-wifi-active` | `esp32-adc2-wifi` | Covered (warning) |
| `10uf-ceramic-on-esp32-vin-prevents-wifi-tx-brownouts-because-radio-bursts-pull-current-faster-than-the-buck-regulator-responds` | GAP | No brownout / decoupling trap for ESP32 |
| `esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc` | GAP | ADC accuracy hazard — not modeled |
| `esp32-adc-attenuation-setting-determines-input-voltage-range` | GAP | Config hazard |
| `esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors` | GAP | Important layout constraint — no trap rule |
| `esp32-ams1117-regulator-limits-total-board-current-to-800ma` | GAP | Power budget warning for USB-powered use |
| `esp32-gpio25-26-are-both-dac-outputs-and-recommended-i2s-pins-creating-peripheral-exclusion` | GAP | Peripheral conflict |
| `esp32-38pin-barely-fits-breadboard-with-one-free-column` | GAP | Physical fit — layout advisory, low priority |

### ESP8266 — boot & restricted pins

| Vault slug | Covered by | Notes |
|-----------|------------|-------|
| `esp8266-boot-pins-gpio0-gpio2-and-gpio15-must-be-in-specific-states-at-power-on` | GAP | No ESP8266 family in `inferTraps()` at all |
| `esp8266-gpio9-and-gpio10-are-flash-connected-and-crash-if-used-as-gpio` | GAP | Analogous to ESP32 flash-GPIO rule, no coverage |
| `esp8266-has-only-5-truly-safe-gpio-out-of-11-total-pins` | GAP | Summary hazard note |
| `esp8266-a0-analog-input-has-0-1v-range-not-0-3v3` | GAP | Voltage range trap — easy to trigger by mistake |
| `esp8266-gpio16-is-architecturally-unique-and-cannot-do-pwm-or-i2c` | GAP | Capability restriction |
| `esp8266-pwm-is-software-implemented-at-1khz-unsuitable-for-servo-control` | GAP | Performance trap |
| `esp8266-wifi-consumes-50kb-ram-leaving-only-30kb-for-user-code` | GAP | Runtime resource trap |
| `esp8266-i2s-is-receive-only-with-fixed-pins-and-a-boot-pin-conflict-on-gpio2` | GAP | Combines two hazards |
| `i2c-devices-on-esp8266-boot-pins-can-prevent-boot-silently` | GAP | High-priority silent failure |
| `breadboard-bench-coach-should-flag-i2c-on-esp8266-boot-pins-as-wiring-error` | GAP | Coach note explicitly calling for a rule |

### ATmega / Arduino — voltage & peripherals

| Vault slug | Covered by | Notes |
|-----------|------------|-------|
| `avr-5v-logic` (rule, no slug) | `avr-5v-logic` | Covered — but no vault slug backs it |
| `avr-serial-conflict` (rule, no slug) | `avr-serial-conflict` | Covered — no vault slug |
| `avr-reset-noise` (rule, no slug) | `avr-reset-noise` | Covered — no vault slug |
| `mega-3v3-output-limited-to-50ma-cannot-power-wifi-or-bluetooth-modules` | GAP | Power capacity trap — Mega-specific |
| `mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v` | GAP | Thermal / input voltage trap |
| `mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently` | GAP | Footprint compatibility trap |
| `mega-2560-four-hardware-uarts` | — | Informational, not a hazard |
| `mega-2560-pin-7-8-gap-for-shield-compatibility` | — | Physical fit, not a hazard |
| `mega-2560-too-wide-for-any-breadboard` | — | Layout constraint, not a trap |
| `native-usb-arduino-boards-can-brick-usb-with-a-bad-sketch-requiring-a-double-tap-reset-to-catch-the-bootloader-window` | GAP | Critical bricking hazard for Leonardo/Micro |
| `100uf-capacitor-on-arduino-5v-input-absorbs-motor-switching-emi-that-causes-mcu-resets` | GAP | Motor-noise-induced reset — straddles AVR + motor domains |
| `clone-arduino-voltage-regulators-can-overheat-silently-because-there-is-no-thermal-feedback` | GAP | Thermal hazard specific to clone boards |
| `shield-servo-headers-share-arduino-5v-creating-hidden-brownout-path-that-only-trace-cutting-fixes` | GAP | Brownout trap on Arduino + servo shields |
| `uno-20ma-per-pin-200ma-total-means-no-direct-led-or-motor-drive` | GAP | GPIO current limit trap |
| `counterfeit-l293d-chips-on-clone-motor-shields-deliver-lower-than-rated-current-with-no-external-indication` | GAP | Clone component quality trap |

### ARM MCUs (RP2040 / Pico, STM32, nRF, SAMD)

| Vault slug | Covered by | Notes |
|-----------|------------|-------|
| `mcu-3v3-logic` (rule, no slug) | `mcu-3v3-logic` | Covered — no vault slug |
| `pico-3v3-en-pin-disables-regulator-for-external-sleep-control` | GAP | Pico-specific safety pin |
| `pico-lacks-wifi-bluetooth-requiring-pico-w-or-external-wireless` | — | Informational, not a hazard |
| `raspberry-pi-gpio-is-3v3-unprotected-with-no-clamping-diodes-and-5v-kills-the-soc-permanently` | GAP | Raspberry Pi (not RP2040 Pico) — not covered by any family trigger |

### BLDC motor controllers

| Vault slug | Covered by | Notes |
|-----------|------------|-------|
| `bldc-stop-active-low-brake-active-high` | `motor-brake-polarity` | Covered (critical) |
| `ct-brake-polarity-on-the-zs-x11h-is-active-low-contradicting-the-kjl-01-claim-that-brake-is-active-high-suggesting-the-polarity-is-vendor-specific-not-a-bldc-convention` | `motor-brake-polarity` | Partially covered — rule warns generically but not about vendor inconsistency |
| `hall-sensor-wiring-order-matters-for-bldc` | `motor-hall-order` | Covered (warning) |
| `hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position` | GAP | Pull-up requirement on hall lines — not in heuristic-trap rules |
| `bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float` | GAP | Common ground trap — silent failure |
| `bldc-direction-reversal-under-load-creates-destructive-current-spikes-through-mosfets` | GAP | Dynamic reversal trap |
| `bldc-commutation-table-maps-hall-states-to-phase-pairs-and-only-two-of-six-wire-permutations-produce-smooth-rotation` | Partial | Covered by `motor-hall-order` detail but not by a dedicated commutation rule |
| `bldc-controller-hall-sensor-outputs-are-push-pull-digital-making-txs-class-shifters-the-correct-bridge-to-3v3-mcus` | GAP | Level-shifting requirement for hall signals |
| `el-pin-floating-at-mcu-boot-defaults-the-motor-to-full-speed-so-explicit-high-initialization-is-mandatory-before-stop-is-enabled` | GAP | Boot-time pin-state trap — critical for BLDC |
| `safe-bldc-startup-sequence-initializes-el-stopped-then-brake-engaged-then-enable-low-before-setting-any-active-state` | GAP | Startup sequence trap |
| `motor-speed-must-be-ramped-below-50-percent-before-activating-the-brake-because-high-speed-regenerative-braking-stresses-the-controller` | GAP | Operational sequence trap |
| `emergency-stop-via-stop-pin-low-disables-bldc-controllers-entirely-and-is-safer-than-regenerative-braking-for-fault-conditions` | GAP | Safety mode clarity |
| `dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets` | GAP | Critical thermal/safety trap |
| `78l05-regulator-failure-kills-hall-power-making-motor-appear-dead-when-only-the-regulator-failed` | GAP | Hall sensor supply diagnostic |
| `swapped-hall-cables-between-dual-controllers-cause-both-motors-to-vibrate-instead-of-just-one-misbehaving` | GAP | Multi-motor diagnostic trap |
| `four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting` | GAP | System-level power trap |
| `staggered-motor-startup-by-100ms-prevents-combined-inrush-from-tripping-shared-bms-overcurrent-protection` | GAP | Multi-motor inrush trap |
| `powering-the-mcu-from-the-zs-x11h-5v-output-causes-resets-because-motor-switching-noise-on-the-shared-rail-corrupts-the-logic-supply` | GAP | Shared power rail noise trap |
| `zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes` | GAP | ZS-X11H-specific polarity trap |
| `zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory` | GAP | ZS-X11H safety — no protection circuits |

### H-Bridge motor drivers

| Vault slug | Covered by | Notes |
|-----------|------------|-------|
| `l298n-has-no-internal-flyback-diodes-unlike-l293d-making-external-protection-mandatory` | `motor-back-emf` | Covered (warning) |
| `motor-shoot-through` (rule, no slug) | `motor-shoot-through` | Covered — no dedicated vault slug |
| `l298n-needs-heatsink-above-half-amp-because-25w-package-limit-is-reached-quickly-with-darlington-drops` | GAP | Thermal trap — very common L298N failure mode |
| `l298n-saturation-voltage-drop-loses-up-to-5v-making-it-inefficient-at-high-current` | GAP | Voltage budget trap |
| `l298n-ttl-input-thresholds-allow-3v3-mcu-control-despite-5v-logic-supply` | — | Informational compatibility note |
| `l293d-ground-pins-are-the-primary-thermal-dissipation-path-not-just-electrical-connections` | GAP | Thermal trap — L293D-specific |
| `l293d-voltage-drop-is-1-4v-per-switch-totaling-2-8v-across-the-full-h-bridge-path` | GAP | Voltage budget — affects motor stall torque |
| `the-d-suffix-on-l293d-denotes-built-in-clamp-diodes-and-the-non-d-variant-is-a-destructive-substitution` | GAP | Critical substitution trap |
| `tb6612-standby-pin-adds-a-fifth-motor-state-below-brake-and-coast-with-sub-microamp-quiescent-current` | GAP | TB6612 standby pin behavior |
| `tb6612-motor-supply-ceiling-of-13-5v-is-a-hard-selection-boundary-against-l298n-for-24v-and-36v-motor-systems` | GAP | Voltage ceiling — selection hazard |
| `inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail` | GAP | Decoupling for motor drivers — not modeled |
| `h-bridge-brake-and-coast-are-distinct-stop-modes-that-beginners-conflate` | GAP | Mode confusion trap |
| `counterfeit-l293d-chips-on-clone-motor-shields-deliver-lower-than-rated-current-with-no-external-indication` | GAP | Clone component trap |
| `active-current-limiting-motor-drivers-throttle-output-instead-of-crowbar-shutdown-preserving-motion-under-transient-overload` | — | Informational |

### Decoupling & power supply

| Vault slug | Covered by | Notes |
|-----------|------------|-------|
| `every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients` | GAP | No general decoupling trap in any family |
| `missing-decoupling-capacitors-produce-three-distinct-failure-modes` | GAP | High-priority — covers all families |
| `multi-vcc-ics-need-one-decoupling-capacitor-per-vcc-pin-not-one-per-package` | GAP | Multi-rail decoupling |
| `analog-ics-need-decoupling-more-critically-than-digital-because-supply-noise-directly-contaminates-signal-measurements` | GAP | Analog supply sensitivity |
| `78xx-regulators-require-input-and-output-capacitors-close-to-pins-for-stability` | GAP | LDO stability trap |
| `wrong-jumper-voltage-on-breadboard-power-module-silently-destroys-3v3-components-with-no-warning` | GAP | Breadboard PSU voltage trap — very common beginner mistake |
| `breadboard-power-module-700ma-total-budget-excludes-servos-and-motors-requiring-separate-power` | GAP | Current budget trap |
| `independent-per-rail-voltage-selection-enables-mixed-voltage-breadboard-prototyping-without-isolation-circuits` | — | Informational |
| `reversed-polarity-on-aluminum-electrolytic-capacitors-causes-violent-catastrophic-failure` | GAP | Critical polarity trap |
| `jst-ph-battery-connectors-have-no-universal-polarity-standard-so-reversed-connection-damages-charger-circuits` | GAP | Connector polarity trap |

### Level shifting

| Vault slug | Covered by | Notes |
|-----------|------------|-------|
| `wireless-modules-are-overwhelmingly-3v3-making-level-shifting-the-default` | Partial | `mcu-3v3-logic` and `avr-5v-logic` cover the need, not the solution |
| `signal-topology-not-voltage-alone-determines-level-shifter-selection` | GAP | Critical design rule — wrong shifter type for I2C vs SPI |
| `open-drain-protocols-require-pull-up-based-level-shifters-because-auto-direction-sensors-cannot-distinguish-driver-from-pull-up` | GAP | I2C level-shifting trap |
| `bss138-level-shifter-channels-add-approximately-5pf-each-to-the-i2c-bus-capacitance-budget` | GAP | Bus capacitance trap |
| `active-level-shifters-use-one-shot-edge-accelerators-to-drive-rising-edges-breaking-the-bss138-rc-ceiling` | — | Informational |
| `logic-level-selector-switch-on-a-shield-lets-one-board-work-with-both-3v3-and-5v-arduinos-but-misconfigured-switch-produces-silent-data-corruption` | GAP | Misconfigured selector silent corruption |

### Pull-up resistors

| Vault slug | Covered by | Notes |
|-----------|------------|-------|
| `hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position` | GAP | Missing pull-up on hall lines |
| `joystick-sw-pin-has-no-onboard-pull-up-requiring-input-pullup-or-external-resistor-to-avoid-floating-input` | GAP | Floating input trap |
| `avr-reset-noise` | `avr-reset-noise` | Covered (info) |

### Thermal

| Vault slug | Covered by | Notes |
|-----------|------------|-------|
| `l298n-needs-heatsink-above-half-amp-because-25w-package-limit-is-reached-quickly-with-darlington-drops` | GAP | Thermal — L298N |
| `l293d-ground-pins-are-the-primary-thermal-dissipation-path-not-just-electrical-connections` | GAP | Thermal — L293D |
| `clone-arduino-voltage-regulators-can-overheat-silently-because-there-is-no-thermal-feedback` | GAP | Thermal — Arduino clones |
| `mega-5v-regulator-thermal-math-constrains-input-voltage-to-7-9v` | GAP | Thermal — Mega |
| `to-92-package-limits-power-dissipation-to-625mw-and-requires-derating-above-25c-making-thermal-math-mandatory-for-high-current-switching` | GAP | General transistor thermal |
| `dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets` | GAP | BLDC thermal — braking mode |
| `zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory` | GAP | No protection IC trap |

### Polarity & substitution traps

| Vault slug | Covered by | Notes |
|-----------|------------|-------|
| `reversed-polarity-on-aluminum-electrolytic-capacitors-causes-violent-catastrophic-failure` | GAP | Critical polarity |
| `jst-ph-battery-connectors-have-no-universal-polarity-standard-so-reversed-connection-damages-charger-circuits` | GAP | Connector polarity |
| `the-d-suffix-on-l293d-denotes-built-in-clamp-diodes-and-the-non-d-variant-is-a-destructive-substitution` | GAP | Part substitution hazard |
| `led-polarity-has-four-physical-identification-methods-and-getting-it-wrong-is-a-silent-failure` | GAP | LED polarity |
| `passive-buzzer-polarity-markings-are-inconsistent-and-assuming-no-polarity-is-unsafe` | GAP | Buzzer polarity |

---

## Part 3 — Proposed gap rules

Priority-ordered list. High = silent-failure or destructive; Medium = functional regression; Low = advisory.

| Priority | Vault slug | Proposed rule ID | Proposed severity | Proposed trigger |
|----------|-----------|------------------|-------------------|------------------|
| **High** | `esp8266-boot-pins-gpio0-gpio2-and-gpio15-must-be-in-specific-states-at-power-on` | `esp8266-boot-pins` | critical | family=mcu, title~"esp8266" or "nodemcu" or "d1 mini" |
| **High** | `esp8266-gpio9-and-gpio10-are-flash-connected-and-crash-if-used-as-gpio` | `esp8266-flash-gpio` | critical | family=mcu, title~esp8266 |
| **High** | `el-pin-floating-at-mcu-boot-defaults-the-motor-to-full-speed-so-explicit-high-initialization-is-mandatory-before-stop-is-enabled` | `bldc-el-boot-float` | critical | family=driver, isBldcDriver(title) |
| **High** | `wrong-jumper-voltage-on-breadboard-power-module-silently-destroys-3v3-components-with-no-warning` | `psu-jumper-voltage` | critical | family=power or title~"power module" or "mb102" or "yx-3006" |
| **High** | `reversed-polarity-on-aluminum-electrolytic-capacitors-causes-violent-catastrophic-failure` | `cap-reversed-polarity` | critical | family=passive or capacitor, title~"electrolytic" or "polarized" |
| **High** | `bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float` | `bldc-common-ground` | critical | family=driver, isBldcDriver(title) |
| **High** | `dynamic-brake-must-be-pulsed-not-held-because-stationary-phase-shorting-overheats-mosfets` | `bldc-brake-thermal` | critical | family=driver, isBldcDriver(title) |
| **High** | `the-d-suffix-on-l293d-denotes-built-in-clamp-diodes-and-the-non-d-variant-is-a-destructive-substitution` | `hbridge-l293-no-d` | critical | family=driver, title~"l293" (without "d" suffix) |
| **High** | `native-usb-arduino-boards-can-brick-usb-with-a-bad-sketch-requiring-a-double-tap-reset-to-catch-the-bootloader-window` | `avr-native-usb-brick` | warning | family=mcu, title~"leonardo" or "micro" or "pro micro" or "32u4" |
| **High** | `missing-decoupling-capacitors-produce-three-distinct-failure-modes` | `ic-missing-decoupling` | warning | family=mcu or driver (all families — universal advisory) |
| **Medium** | `esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors` | `esp32-input-only-pins` | warning | family=mcu, title~"esp32" |
| **Medium** | `esp8266-a0-analog-input-has-0-1v-range-not-0-3v3` | `esp8266-a0-range` | warning | family=mcu, title~"esp8266" or "nodemcu" |
| **Medium** | `hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position` | `bldc-hall-pullup` | warning | family=driver, isBldcDriver(title) |
| **Medium** | `l298n-needs-heatsink-above-half-amp-because-25w-package-limit-is-reached-quickly-with-darlington-drops` | `hbridge-l298n-thermal` | warning | family=driver, title~"l298" |
| **Medium** | `mega-3v3-output-limited-to-50ma-cannot-power-wifi-or-bluetooth-modules` | `avr-mega-3v3-budget` | warning | family=mcu, title~"mega" |
| **Medium** | `powering-the-mcu-from-the-zs-x11h-5v-output-causes-resets-because-motor-switching-noise-on-the-shared-rail-corrupts-the-logic-supply` | `bldc-shared-5v-noise` | warning | family=driver, title~"zs-x11h" or "kjl-01" or "riorand" |
| **Medium** | `raspberry-pi-gpio-is-3v3-unprotected-with-no-clamping-diodes-and-5v-kills-the-soc-permanently` | `rpi-gpio-no-clamp` | critical | family=mcu, title~"raspberry pi" or "rpi" or "raspi" (not "pico") |
| **Medium** | `zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory` | `bldc-no-protection` | warning | family=driver, title~"zs-x11h" or "kjl-01" |
| **Medium** | `signal-topology-not-voltage-alone-determines-level-shifter-selection` | `lvl-shift-topology` | warning | family=driver or module, title~"level shift" or "txs0108" or "bss138" |
| **Medium** | `esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc` | `esp32-adc-nonlinear` | info | family=mcu, title~"esp32" |
| **Low** | `inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail` | `motor-bypass-cap` | info | family=driver, isMotorDriver(title) |
| **Low** | `breadboard-power-module-700ma-total-budget-excludes-servos-and-motors-requiring-separate-power` | `psu-current-budget` | info | family=power, title~"power module" |
| **Low** | `jst-ph-battery-connectors-have-no-universal-polarity-standard-so-reversed-connection-damages-charger-circuits` | `connector-jst-polarity` | warning | family=connector or power, title~"jst" or "battery connector" |
| **Low** | `h-bridge-brake-and-coast-are-distinct-stop-modes-that-beginners-conflate` | `hbridge-brake-coast` | info | family=driver, isHBridgeDriver(title) |
| **Low** | `tb6612-standby-pin-adds-a-fifth-motor-state-below-brake-and-coast-with-sub-microamp-quiescent-current` | `hbridge-tb6612-stby` | info | family=driver, title~"tb6612" |

---

## Part 4 — Recommendations

### 1. Rules missing from the current implementation (actionable)

**Immediate / critical-severity gaps (Wave 2 should address these first):**

- **ESP8266 family is entirely absent.** The engine has no family trigger for `esp8266`, `nodemcu`, or `d1 mini`. The ESP8266 has arguably worse boot-pin hazards than the ESP32 (GPIO0, GPIO2, GPIO15 all must be at specific levels at power-on; GPIO9/10 are flash-connected and crash on use). At minimum, `esp8266-boot-pins` and `esp8266-flash-gpio` at critical severity should be added as a fourth MCU family block mirroring `esp32Traps()`.

- **BLDC boot-time floating EL pin** (`bldc-el-boot-float`): The ZS-X11H and similar BLDC controllers default to full speed when the EL speed pin floats at MCU boot. This is a destructive safety hazard — motors spin up at full power before firmware initializes. Severity: critical.

- **Breadboard power module jumper voltage** (`psu-jumper-voltage`): The MB102 / YX-3006 breadboard PSU jumper silently applies 5V to the 3.3V rail when misconfigured, instantly destroying any 3.3V ICs on that rail. No current trap covers this. This is the single most common cause of beginner component destruction.

- **BLDC common-ground requirement** (`bldc-common-ground`): Without a shared GND between MCU and BLDC controller, control signals float and behavior is unpredictable. This is a silent failure mode not currently warned about.

**Medium-priority gaps:**

- `esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors` — Adding a `warning` trap for ESP32 input-only pins would catch a very common mistake where users try to use GPIO34-39 for output.
- `mega-3v3-output-limited-to-50ma-cannot-power-wifi-or-bluetooth-modules` — A `warning` trap for the Mega when a wireless module appears nearby.
- `l298n-needs-heatsink-above-half-amp` — The L298N thermal trap is one of the most-documented L298N failures; a `warning` would reduce burnt boards.

### 2. Rules that could be consolidated or split

- **`esp32-gpio0-boot`** and **`esp32-gpio12-strapping`** are both strapping-pin rules but are separated by severity (warning vs critical) for good reason. No consolidation needed, but `esp32-gpio5-strapping` should be added as a third entry in `esp32Traps()` to match the coverage in `checkHeuristicEsp32RestrictedPins`.

- **`motor-brake-polarity`** covers a critical issue but its `detail` is generic ("many BLDC controllers"). The vault has specific ZS-X11H and KJL-01 data showing the polarity is vendor-specific. The rule should be split or the detail updated to reference the vendor-specific behavior.

- **`avr-5v-logic`**, **`avr-serial-conflict`**, and **`avr-reset-noise`** have no backing vault slugs. If vault notes are written for these (three short atomic notes), the `trapId` links would become navigable, improving the coach UX.

### 3. Testing gaps

Inspecting the test files adjacent to `heuristic-trap-inference.ts`:

- The engine's unit tests should verify that `esp32Traps()` returns exactly 4 rules, `avrTraps()` returns 3, `arm3v3Traps()` returns 1, `bldcTraps()` returns 2, `hBridgeTraps()` returns 2, and `motorPwmTrap()` returns 1 — a total of 13. If any rule is added or removed without updating the count assertions, the test suite will not catch it.

- **LED-driver exclusion regression** (added in audit #257 / task W1.7): Tests exist for the `isLedDriver()` guard in `isMotorDriver()`. These must remain in place. Any new motor-driver subtype (e.g., stepper-specific traps) must also pass through the LED-driver exclusion check to avoid false positives.

- **No tests cover the gap rules proposed in Part 3.** When Wave 2 rules are added, each new family function should have a corresponding `describe` block that verifies: (a) the rule fires for expected title strings, (b) the rule does not fire for LED-driver titles, and (c) the total rule count for the family is asserted.

---

*Generated by audit task 1.11 (audit #252). Source file: `client/src/lib/heuristic-trap-inference.ts`. Related module: `client/src/lib/breadboard-board-audit.ts` → `checkHeuristicEsp32RestrictedPins`. Vault corpus: 675 total notes; ~90 breadboard-hazard-relevant notes cross-referenced.*
