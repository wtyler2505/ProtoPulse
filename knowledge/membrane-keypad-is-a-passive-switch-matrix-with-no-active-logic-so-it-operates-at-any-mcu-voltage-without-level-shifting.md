---
description: "The membrane keypad matrix is entirely passive — mechanical switch contacts between row and column traces — so it operates at whatever voltage the MCU applies via its pull-ups, requiring no level shifting, no voltage regulator, and no compatibility concerns between 3.3V and 5V platforms"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[membrane-switch-keypad-module-tactile-button-array]]"
---

# Membrane keypad is a passive switch matrix with no active logic so it operates at any MCU voltage without level shifting

A membrane keypad contains zero active electronics — no IC, no logic, no comparator. Each "key" is simply a normally-open contact between its row trace and column trace. The electrical behavior is entirely determined by the MCU:

- Row pins driven LOW by MCU → whatever the MCU's LOW voltage is (0V)
- Column pins pulled HIGH by MCU's internal pull-ups → whatever the MCU's HIGH is (3.3V or 5V)
- Pressed key → row's LOW appears on column (simple wire connection)

**Implications:**
- No level shifting needed when moving between 3.3V and 5V MCUs — this is the degenerate case of [[signal-topology-not-voltage-alone-determines-level-shifter-selection]], where the signal topology has literally no driver, so both topology and voltage axes collapse.
- No power rail connection to the keypad (it draws zero quiescent current) — the same passive-wake power property captured in [[passive-mechanical-switches-draw-zero-quiescent-current-making-them-ideal-battery-wake-triggers]], extended from a single switch to a full matrix.
- No initialization sequence, no communication protocol
- Works identically with any digital GPIO regardless of logic family

This "entirely passive" pattern also applies to:
- Analog joystick modules (potentiometers follow VCC)
- Bare tactile buttons
- DIP switches
- Reed switches
- Multi-pole latching switches (Toneluck 6-way: purely mechanical contacts)

The contrast is with active input devices like:
- Rotary encoders (some modules include RC debounce networks)
- Touch sensors (capacitive sensing IC)
- I2C keypads (MCU + protocol on the keypad itself)

---

Topics:
- [[input-devices]]

Related:
- [[matrix-keypad-scanning-drives-one-row-low-at-a-time-and-reads-columns-with-pull-ups-to-detect-key-position]] — the scanning algorithm that exploits this passivity, driving row voltage from the MCU side
- [[joystick-module-is-two-potentiometers-on-a-spring-return-gimbal-consuming-two-analog-pins-plus-one-digital-pin]] — exemplifies the same "entirely passive" class in analog form
- [[4x4-matrix-keypad-consumes-8-gpio-pins-making-io-expander-mandatory-on-pin-constrained-mcus]] — extends the GPIO-cost consequence of the passive matrix to pin-budget decisions
- [[passive-mechanical-switches-draw-zero-quiescent-current-making-them-ideal-battery-wake-triggers]] — grounds: the zero-quiescent-current claim generalized across the passive-switch family (buttons, reed, tilt)
- [[signal-topology-not-voltage-alone-determines-level-shifter-selection]] — exemplifies the degenerate endpoint of the topology framework: no signal to shift means no shifter needed regardless of voltage
