---
description: "Unlike potentiometers or absolute encoders, the KY-040 incremental encoder only reports relative changes (delta clicks) — it has no way to report absolute position, loses all position information on power-off, and requires software to maintain a running count"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[ky-040-rotary-encoder-module-incremental-with-pushbutton]]"
---

# Incremental encoder has no position memory across power cycles making it a relative-only input device

The KY-040 is an incremental encoder, not an absolute encoder. This distinction is fundamental:

**Incremental (KY-040):**
- Outputs: "I moved N clicks clockwise/counterclockwise since you last asked"
- On power-up: position is unknown — software starts at zero (or a saved value)
- No physical stop: infinite rotation in both directions
- Position tracking requires continuous monitoring (interrupts)

**Absolute (not the KY-040):**
- Outputs: "I am at position 127 out of 360"
- On power-up: immediately knows position without movement
- Uses optical/magnetic/resistive coding disc
- More expensive, more pins (parallel) or protocol (SSI/SPI)

**Potentiometer (the simplest "absolute"):**
- Outputs: "I am at 73% of my range" (analog voltage)
- Limited rotation (300 degrees typical)
- Physical stops at endpoints
- Wears out (resistive track degradation)

**Practical implications for the KY-040:**
1. If the MCU resets during operation, position is lost (must re-home)
2. If you need to remember position across power cycles, save to EEPROM periodically
3. Infinite rotation means no "end of travel" — menu wrapping is a software choice
4. Missing interrupts (CPU busy) means missed counts — position drifts

The incremental encoder excels for: menu navigation, volume adjustment, parameter tuning — cases where relative change matters more than absolute position.

---

Topics:
- [[input-devices]]

Related:
- [[quadrature-encoding-detects-rotation-direction-from-phase-lead-lag-between-two-square-wave-channels]]
- [[a-potentiometer-wired-as-voltage-divider-converts-mechanical-rotation-to-proportional-analog-voltage-for-mcu-analogread]]
- [[potentiometer-300-degree-rotation-range-with-mechanical-stops-means-software-must-handle-endpoint-dead-zones-in-adc-reading]]
