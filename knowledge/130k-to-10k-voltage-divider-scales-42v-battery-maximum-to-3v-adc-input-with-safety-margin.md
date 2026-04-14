---
description: "A 130K top-leg and 10K bottom-leg divider maps 42V full-charge battery voltage to 3.0V at the ESP32 ADC pin, leaving 10 percent headroom below the 3.3V rail to survive the inevitable over-voltage transients without clamping"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-36v-battery-power-distribution-4-tier-system.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "esp32"
  - "hoverboard-10s-battery-pack"
---

# 130K to 10K voltage divider scales 42V battery maximum to 3V ADC input with safety margin

The naive divider choice for reading a 42V battery on a 3.3V ADC is 100K over 10K -- but that produces 3.82V at full charge, clamping the ESP32 input protection diodes and risking destruction on charging transients. The correct design uses 130K over 10K.

The math: Vout = Vin × (R_bottom / (R_top + R_bottom)) = 42V × (10K / 140K) = 3.0V. At nominal 36V the divider reads 2.57V and at the 30V BMS cutoff it reads 2.14V. The entire operating range sits in the cleaner 2.0-3.0V window of the ESP32 ADC, avoiding the nonlinear region above 2.5V where [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] distorts readings.

Why the specific 130K/10K ratio matters: a 42V cell at rest is the floor of the over-voltage envelope, not the ceiling. Regenerative braking, charger misbehavior, or inductive spikes from the motor bus can briefly push battery voltage above 42V. The 3.0V design target leaves 0.3V of headroom before the ADC pin exceeds its absolute maximum rating of VDD+0.3V. A divider that reads exactly 3.3V at 42V would clamp on every charger-disconnect transient.

The 140K total impedance also matters for ADC accuracy. The ESP32 ADC input requires a source impedance below ~10K for accurate sampling. With 140K in the divider, a 100nF bypass capacitor across the 10K bottom leg is mandatory -- it provides the low impedance the ADC sees during conversion, while the resistors set the DC operating point.

Since [[esp32-adc-attenuation-setting-determines-input-voltage-range]], the ADC must be configured for 11dB attenuation (0-3.3V input range) to read this divider correctly. Default configurations at lower attenuation will clip the upper end of the battery range.

---

Source: [[wiring-36v-battery-power-distribution-4-tier-system]]

Relevant Notes:
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] -- explains why 2.5V ceiling matters for this divider design
- [[esp32-adc-attenuation-setting-determines-input-voltage-range]] -- the divider requires 11dB attenuation configuration
- [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]] -- the battery range that drives the divider math

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
