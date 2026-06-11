---
title: Level shifter HV reference must come from a clean regulated supply not from the motor controller 5V rail because motor switching noise on the shared rail produces erratic level shifting
tags: [power, level-shifter, debugging, noise, zs-x11h, best-practices]
---

# Level shifter HV reference must come from a clean regulated supply not from the motor controller 5V rail because motor switching noise on the shared rail produces erratic level shifting

When bridging a 3.3V MCU to a 5V motor controller (like the ZS-X11H) using a bidirectional level shifter, the high-voltage (HV) reference pin on the shifter must be supplied by a clean, stable 5V source.

A common pitfall is to grab the 5V output provided by the motor controller itself to supply the level shifter's HV pin. While this seems convenient, motor switching events (PWM, direction changes, braking) inject massive noise into this rail.

Because the level shifter relies on this rail as its threshold reference for translating 3.3V logic up to 5V, any noise on the HV rail directly shifts the detection threshold. This results in the level shifter erratically misinterpreting logic levels, producing intermittent signal corruption on the 5V side. 

The fix is to power the level shifter's HV reference from an independent, clean 5V regulator (such as the same LM2596 buck converter providing clean 5V to the MCU). This keeps the level shifter's reference independent of the motor's electrical noise.

## Connections

- **Source:** [[wiring-zs-x11h-to-esp32-with-level-shifter]]
- **Related Failure Mode:** [[powering-the-mcu-from-the-zs-x11h-5v-output-causes-resets-because-motor-switching-noise-on-the-shared-rail-corrupts-the-logic-supply]]
- **Related Architecture Principle:** [[parallel-power-rails-from-battery-are-more-reliable-than-cascaded-regulators]]
