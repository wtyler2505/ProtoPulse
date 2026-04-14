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

The divider's output is consumed by firmware that maps measured voltage to a battery percentage, and [[linear-voltage-to-percentage-approximation-is-adequate-for-10s-li-ion-despite-the-nonlinear-discharge-curve]] establishes that the linear `(V - 30) / 12 * 100` map is good enough because the decisions it drives (continue vs return, warning vs critical) all sit at the low end of the curve where linear and real agree. The measurement chain is: divider -> ADC (attenuated, calibrated) -> linear percent -> decision threshold. Each stage has acceptable error in isolation and the errors do not compound in the region that matters.

**Where to wire it:** the divider output should land on an ADC1 channel because WiFi locks out ADC2 during transmission. [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]] are all ADC1 and ideal for this role -- they cannot be accidentally driven as outputs, and battery monitoring never needs to drive the pin. The 100nF bypass on the 10K leg also solves the floating-input problem those pins have for digital use; for analog sensing the divider output is low-impedance enough that no additional pull resistor is needed.

---

Source: [[wiring-36v-battery-power-distribution-4-tier-system]]

Relevant Notes:
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] -- explains why 2.5V ceiling matters for this divider design
- [[esp32-adc-attenuation-setting-determines-input-voltage-range]] -- the divider requires 11dB attenuation configuration
- [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]] -- the battery range that drives the divider math
- [[linear-voltage-to-percentage-approximation-is-adequate-for-10s-li-ion-despite-the-nonlinear-discharge-curve]] -- the downstream firmware consumer of this divider's measurement
- [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]] -- the recommended ADC1 landing pins for the divider output

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
