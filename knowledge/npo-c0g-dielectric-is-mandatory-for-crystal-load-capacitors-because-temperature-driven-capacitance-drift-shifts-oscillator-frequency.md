---
description: "NPO/C0G ceramic capacitors drift less than 1% across temperature, while X7R drifts ~15% and Y5V can lose up to 80% of rated capacitance -- since crystal oscillator frequency depends directly on load capacitance, using a temperature-unstable dielectric means the clock drifts with ambient temperature"
type: knowledge-note
source: "docs/parts/22pf-ceramic-capacitor-npo-50v-crystal-load-cap.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: high
verified: false
---

# NPO/C0G dielectric is mandatory for crystal load capacitors because temperature-driven capacitance drift shifts oscillator frequency

Ceramic capacitor dielectrics have dramatically different temperature stability:

| Dielectric | Capacitance Drift Over Temperature | Typical Use |
|------------|-----------------------------------|-------------|
| NPO/C0G (Class 1) | < 1% (±30 ppm/°C) | Crystal loading, RF, timing |
| X7R (Class 2) | ~15% (±15% over -55°C to +125°C) | General decoupling, filtering |
| Y5V (Class 3) | Up to -80% at temperature extremes | Non-critical bulk bypass |

For crystal oscillator load capacitors, the dielectric choice directly affects clock accuracy. A crystal's oscillation frequency is a function of the total load capacitance seen at its pins. If the load capacitance changes with temperature, the frequency changes with temperature.

**Quantifying the impact:** A 16MHz crystal with a specified load of 20pF has a frequency pulling sensitivity of roughly 10-20 ppm per pF of load capacitance change. An X7R capacitor pair that drifts 15% (from 22pF to 18.7pF) shifts effective load by ~1.7pF, causing a frequency error of ~17-34 ppm. Over a 24-hour period, this translates to ~1.5-3 seconds of clock drift -- acceptable for casual timing but unacceptable for UART communication, I2C timing, or any protocol relying on clock accuracy.

With NPO/C0G, the same temperature swing causes <0.2pF change, keeping frequency error below 2 ppm -- negligible for all practical purposes.

**The trap:** X7R capacitors are far more common in maker kits and easier to source. If you grab a 22pF cap from a mixed bag without verifying the dielectric, you have roughly a coin-flip chance of getting X7R, which will work fine on the bench but cause intermittent communication failures in environments with temperature variation.

---

Relevant Notes:
- [[crystal-load-capacitance-equals-the-series-combination-of-two-matched-caps-plus-stray-capacitance]] -- The load capacitance formula these caps participate in
- [[78xx-regulators-require-input-and-output-capacitors-close-to-pins-for-stability]] -- Different cap application, same principle: cap properties matter for circuit stability
- [[ds3231-tcxo-accuracy-is-orders-of-magnitude-better-than-ds1307-crystal-drift-making-ds1307-obsolete-for-most-projects]] -- Temperature compensation at a higher level of sophistication

Topics:
- [[passives]]
- [[eda-fundamentals]]
