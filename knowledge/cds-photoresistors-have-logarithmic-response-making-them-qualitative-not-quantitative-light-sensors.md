---
description: "LDR resistance varies logarithmically with illumination and between individual units — you get 'bright/dim/dark' thresholds, not calibrated lux measurements. This shapes whether the component fits a design requiring precision light measurement"
type: claim
source: "docs/parts/photoresistor-ldr-light-dependent-resistor-analog-light-sensor.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "photoresistor-ldr"
---

# CdS photoresistors have logarithmic response making them qualitative not quantitative light sensors

A CdS (cadmium sulfide) photoresistor changes resistance based on light intensity, but the relationship is:
1. **Logarithmic** — doubling light intensity does NOT halve resistance. The curve is approximately R = A × Lux^(-γ) where γ ≈ 0.7-0.9
2. **Non-standardized** — two LDRs from the same batch may read 10k and 25k at identical light levels
3. **Temperature-dependent** — resistance shifts with ambient temperature
4. **Spectrally biased** — peak sensitivity at ~540nm (green), poor response to red/IR

**What this means for design:**
- You can detect "bright," "dim," and "dark" by setting thresholds empirically
- You CANNOT measure lux, compare readings between devices, or build a calibrated light meter
- Every deployment needs its own threshold calibration ("read the ADC, decide what 'dark' means HERE")

**Appropriate applications:**
- Auto-brightness for displays (relative comparison, not absolute)
- Day/night detection (sunrise/sunset threshold)
- Shadow/presence detection (change from baseline, not absolute level)
- "Is the lid open?" (bright = open, dark = closed)

**Inappropriate applications:**
- Lux meters / light intensity measurement → use a TSL2561 or BH1750 (calibrated I2C sensors)
- Optical communication → too slow (20-30ms response)
- Color detection → spectrally biased toward green
- Multi-unit sensor networks (no two read the same value)

**For the bench coach:** When a user asks "how do I measure light intensity," ask whether they need a NUMBER (lux → use I2C light sensor) or a THRESHOLD (bright/dark → LDR is fine and simpler).

---

Relevant Notes:
- [[resistive-sensors-require-voltage-divider-to-convert-resistance-changes-into-adc-readable-voltages]] -- The wiring pattern all LDRs need
- [[binary-tilt-detection-trades-precision-for-simplicity-and-zero-quiescent-power]] -- Same principle: qualitative/binary detection is a valid design choice

Topics:
- [[sensors]]
- [[breadboard-intelligence]]
