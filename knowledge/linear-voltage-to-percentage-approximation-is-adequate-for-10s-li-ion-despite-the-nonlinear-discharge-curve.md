---
description: "A linear map of 42V=100% to 30V=0% is adequate for rover battery monitoring despite lithium-ion's flat discharge curve in the middle, because the decision the percentage informs (keep driving vs return to base) only needs accuracy at the low end where the curve steepens and becomes linear"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-36v-battery-power-distribution-4-tier-system.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[microcontrollers]]"
  - "[[eda-fundamentals]]"
related_components:
  - "hoverboard-10s-battery-pack"
  - "esp32"
---

# Linear voltage-to-percentage approximation is adequate for 10S Li-Ion despite the nonlinear discharge curve

The true discharge curve of a 10S lithium-ion pack is decidedly non-linear. From 42V (full) to about 38V the curve drops steeply (~15% of capacity). From 38V to 34V the curve is nearly flat (~70% of capacity discharged in a 4V swing). From 34V to 30V the curve steepens sharply again (~15% of capacity). A linear map `percent = (V - 30) / (42 - 30) * 100` ignores this shape entirely and returns wildly inaccurate intermediate values: the battery reads 50% at 36V when it may actually be at 70% remaining capacity.

Yet the linear approximation is still the right choice for most rover firmware, because accuracy in the middle of the curve does not drive any decision the firmware makes. The decision the percentage feeds is binary: can I keep driving, or should I head back? That decision only becomes interesting at the low end, below 33-34V, where the real discharge curve steepens and becomes approximately linear anyway. In the region that matters, the linear approximation is accurate.

The middle-curve inaccuracy is obvious to a user watching the percentage on a display -- the battery "holds" at 70% for a long time then drops fast -- but this matches the user's intuition about how lithium batteries behave, so it doesn't generate support requests. A Coulomb-counting fuel gauge IC (MAX17043, STC3100) would produce a more accurate linear reading, but at the cost of added hardware, firmware complexity, and a current-sense resistor in the main bus carrying full motor current.

The trade-off: for a precision application (drone, long-range EV, medical device) the linear approximation is not good enough and a Coulomb counter is mandatory. For a rover that drives for 30-60 minutes and returns to base for charging, linear is fine. The real decisions -- "low battery warning" at 32V, "critical / return now" at 30.5V, "auto e-stop" at 30V -- happen in the region where linear and true curves agree.

The code shape:
```cpp
float batteryPercent(float voltage) {
  float percent = ((voltage - 30.0) / (42.0 - 30.0)) * 100.0;
  return constrain(percent, 0.0, 100.0);
}
```
is twelve lines of arithmetic vs hundreds of lines for a Coulomb counter driver. The complexity gap is not justified by the decision gap.

---

Source: [[wiring-36v-battery-power-distribution-4-tier-system]]

Relevant Notes:
- [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]] -- the range that this percentage spans
- [[130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin]] -- the divider that feeds this calculation
- [[esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc]] -- the measurement imprecision at the input compounds with the model imprecision in the mapping

Topics:
- [[power-systems]]
- [[microcontrollers]]
- [[eda-fundamentals]]
