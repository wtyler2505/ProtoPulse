---
description: "Input device knowledge -- joystick ADC mapping, keypad matrix scanning, rotary encoder debouncing, and human interface design for embedded systems"
type: moc
topics:
  - "[[eda-fundamentals]]"
  - "[[index]]"
---

# input-devices

Analog and digital input devices, debouncing strategies, matrix scanning, ADC mapping, and human interface patterns for the inventory. Covers joysticks, keypads, rotary encoders, and push-button switches.

## Knowledge Notes

### Potentiometers
- [[a-potentiometer-wired-as-voltage-divider-converts-mechanical-rotation-to-proportional-analog-voltage-for-mcu-analogread]] — VCC-wiper-GND three-wire pattern; the simplest human-to-MCU analog input
- [[b-taper-linear-potentiometer-is-for-voltage-sensing-and-a-taper-logarithmic-is-for-audio-volume-and-confusing-them-is-a-silent-design-error]] — B vs A taper; wrong taper creates behavior that looks like a code bug
- [[potentiometer-300-degree-rotation-range-with-mechanical-stops-means-software-must-handle-endpoint-dead-zones-in-adc-reading]] — Dead zones at mechanical stops require software map() trimming
- [[potentiometer-20-percent-resistance-tolerance-is-irrelevant-in-voltage-divider-mode-because-output-depends-on-wiper-position-ratio-not-absolute-resistance]] — Tolerance cancels in divider mode

## Open Questions
(populated by /extract)

---

Topics:
- [[eda-fundamentals]]
- [[index]]
