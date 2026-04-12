---
description: "When each sensor channel drives one animation parameter (accelerometer -> gaze direction, microphone -> blink, light sensor -> pupil size), the combined output produces emergent lifelike behavior more convincing than any single channel — a generalizable sensor-to-animation design pattern"
type: claim
source: "docs/parts/adafruit-monster-m4sk-dual-tft-display-board-for-animated-eyes.md"
confidence: high
verified: false
topics:
  - "[[displays]]"
  - "[[sensors]]"
---

# multi-sensor reactive behavior creates emergent realism when sensor outputs map directly to animation parameters

The Monster M4SK maps three independent sensor channels to three independent animation parameters:

| Sensor | Input | Animation Parameter | Effect |
|--------|-------|--------------------| -------|
| LIS3DH accelerometer | Board tilt angle | Gaze direction | Eyes look where the board tilts |
| PDM microphone | Sound amplitude | Blink trigger | Eyes widen or blink in response to noise |
| Phototransistor | Ambient light level | Pupil diameter | Pupils dilate in darkness, constrict in light |

Each mapping is simple — a sensor value drives a single visual parameter through a configurable transfer function. But the combined effect of all three channels running simultaneously produces emergent realism: the eyes appear to be alive, reacting to the environment in a way that feels natural. No single channel produces this effect alone.

**The design principle:** Realism emerges from the combination of simple, independent reactive channels, not from any single complex behavior system. This is computationally cheap (no AI, no state machine beyond basic thresholds) but perceptually powerful.

**Generalizability beyond animated eyes:**
- A robot face with LED eyes could use the same pattern: tilt -> look direction, sound -> attention, light -> mood expression
- A wearable indicator could map: acceleration -> urgency visualization, temperature -> color shift, orientation -> information layout
- An interactive display could map: proximity -> detail level, sound -> activity indicator, light -> brightness adaptation

**The key insight is independence:** Each sensor-to-parameter mapping can be developed, tested, and tuned independently. Adding or removing a sensor channel does not break the others. The firmware architecture should expose each mapping as a configurable, disableable channel — which is exactly what the M4SK's `config.eye` system does.

---

Source: [[adafruit-monster-m4sk-dual-tft-display-board-for-animated-eyes]]

Relevant Notes:
- [[display-type-determines-interface-protocol-and-driver-ic-which-together-set-library-and-pin-count]] — the display is the output end of this sensor-to-animation pipeline
- [[dual-spi-displays-require-cortex-m4f-class-processing-with-fpu-and-dma-for-usable-animation-frame-rates]] — processing all sensor channels plus animation requires Cortex-M4F class

Topics:
- [[displays]]
- [[sensors]]
