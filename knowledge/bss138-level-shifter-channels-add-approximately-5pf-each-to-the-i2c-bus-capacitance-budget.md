---
description: BSS138-based bidirectional level shifters add roughly 5pF per channel to the I2C bus capacitance so a typical SDA+SCL shifter pair contributes ~10pF that competes with devices and wire against the 400pF bus ceiling
type: atomic
created: 2026-04-14
source: "[[wiring-i2c-multi-device-bus-compass-imu-current-sensor]]"
confidence: verified
topics:
  - "[[passives]]"
  - "[[shields]]"
  - "[[communication]]"
  - "[[wiring-integration]]"
related_components:
  - BSS138
  - HW-221
---

# BSS138 level shifter channels add approximately 5pF each to the I2C bus capacitance budget

The BSS138 N-channel MOSFET, when wired in the standard bidirectional I2C level-shifter topology (gate to lower-side rail, source to lower-side signal, drain to upper-side signal, both sides pulled up), adds approximately **5pF per channel** to the bus capacitance. A typical SDA+SCL shifter uses two BSS138s — contributing ~10pF to the bus budget.

This matters because the I2C specification caps total bus capacitance at 400pF. Every level-shifted bus eats 10pF of that budget before any device or wire is added. See [[i2c-bus-capacitance-budget-of-400pf-caps-practical-total-wire-length-at-roughly-one-meter-in-fast-mode]] for the full budget accounting.

Worked example showing the constraint: a 3.3V ESP32 bridging to a 5V sensor array via BSS138 shifter, with 6 sensors (6 × 12 = 72pF) + 80cm wire (80 × 1.5 = 120pF) + shifter channels (10pF) = 202pF. Fine at 400kHz. Scale to 10 sensors and 100cm wire and the budget tightens.

Architectural implication for DRC tooling: a rule flagging "level-shifted I2C bus with N devices and L cm wire exceeds 400pF" must include the ~5pF per channel from the shifter. Missing that term produces false-negatives on real bus overloads.

Distinct from [[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]], which addresses the RC rise-time ceiling from `pull-up × drain_capacitance`. This claim is about the shifter's contribution to **total bus capacitance** competing with all other devices — not its own per-channel rise time.

---

Source: [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] (lines 128, 131)

Relevant Notes:
- [[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]]
- [[i2c-bus-capacitance-budget-of-400pf-caps-practical-total-wire-length-at-roughly-one-meter-in-fast-mode]]
- [[oled-i2c-modules-include-onboard-pull-ups-and-external-pull-ups-should-only-be-added-for-bus-lengths-exceeding-30cm]]

Topics: [[passives]] [[shields]] [[communication]] [[wiring-integration]]
