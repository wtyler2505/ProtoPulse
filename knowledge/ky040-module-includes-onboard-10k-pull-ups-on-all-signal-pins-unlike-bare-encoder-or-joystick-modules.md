---
description: "The KY-040 module includes onboard 10K pull-up resistors on CLK, DT, and SW pins — unlike the joystick SW pin or bare encoder breakouts which require external pull-ups or INPUT_PULLUP configuration, the KY-040 works correctly without any additional pull-up provision"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[ky-040-rotary-encoder-module-incremental-with-pushbutton]]"
---

# KY-040 module includes onboard 10K pull-ups on all signal pins unlike bare encoder or joystick modules

The KY-040 breakout board includes 10K pull-up resistors from VCC to each signal pin:
- **CLK (Channel A)**: 10K to VCC
- **DT (Channel B)**: 10K to VCC
- **SW (pushbutton)**: 10K to VCC

This means:
- All signals idle HIGH
- Active state (encoder contact closed or button pressed) pulls LOW
- No external pull-ups needed
- No `INPUT_PULLUP` configuration needed (though enabling it harmlessly parallels the internal and external pull-ups, giving ~5K effective)

**Contrast with other modules:**

| Module | Pull-ups | Consequence |
|--------|----------|-------------|
| KY-040 rotary encoder | 10K onboard on all pins | Works out-of-box |
| KY-023 joystick | No pull-up on SW | SW floats without INPUT_PULLUP |
| Bare rotary encoder | No pull-ups | All signals need external pull-ups |
| Bare tactile button | No pull-ups | Needs pull-up or INPUT_PULLUP |

**Why this matters for debounce:** The 10K pull-up combined with inherent pin capacitance forms a low-pass filter (~1us time constant with ~100pF pin capacitance). This is too fast to meaningfully debounce (bounce is 2-5ms), but it does prevent the pin from floating during the brief open-contact moment between detents — reducing but not eliminating bounce.

The presence of onboard pull-ups also means the module draws a small quiescent current through the pull-ups when contacts are closed: I = VCC/10K = 0.5mA per closed contact at 5V.

---

Topics:
- [[input-devices]]

Related:
- [[joystick-sw-pin-has-no-onboard-pull-up-requiring-input-pullup-or-external-resistor-to-avoid-floating-input]]
- [[mechanical-encoder-contact-bounce-requires-interrupt-driven-debounce-not-polling]]
- [[quadrature-encoding-detects-rotation-direction-from-phase-lead-lag-between-two-square-wave-channels]]
