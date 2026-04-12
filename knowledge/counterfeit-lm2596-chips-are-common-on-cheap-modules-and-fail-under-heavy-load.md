---
description: "Generic LM2596 modules from AliExpress/Amazon frequently contain counterfeit ICs that work at low current but oscillate, overheat, or fail to regulate under 2A+ loads -- always test at full rated current before deployment"
type: claim
source: "docs/parts/lm2596-adjustable-buck-converter-module-3a-step-down.md"
confidence: likely
topics:
  - "[[power-systems]]"
related_components:
  - "lm2596"
---

# Counterfeit LM2596 chips are common on cheap modules and fail under heavy load

The LM2596 module is ubiquitous -- $1-2 from any Chinese electronics vendor. At this price point, the silicon inside is frequently not a genuine Texas Instruments LM2596. Counterfeit or "equivalent" chips may have:

- **Lower current capability:** The genuine LM2596 handles 3A continuous with proper thermal management. Counterfeits may only sustain 1.5-2A before thermal shutdown or output voltage collapse.
- **Oscillation under load:** Counterfeits with different feedback loop characteristics may oscillate at heavy loads, producing unstable output voltage with large swings (>100mV peak-to-peak vs the expected ~30mV ripple).
- **Higher quiescent current:** Genuine LM2596 draws ~5mA with no load. Some counterfeits draw 15-20mA, which matters for battery-powered standby applications.
- **Thermal shutdown differences:** The counterfeit's thermal protection may trigger at different temperatures or may not exist at all, risking destruction rather than graceful shutdown.

**How to identify the problem:**
1. Test the module at your expected maximum current for 10+ minutes
2. Monitor output voltage stability with a multimeter or oscilloscope
3. Feel for excessive heat -- genuine LM2596 at 2A with 36V input gets warm but not untouchably hot
4. If the module fails or becomes unstable above 1.5A, the IC is likely counterfeit

**Practical approach:** For the $1-2 price, buy extras and test each one at rated load before deploying. If you need guaranteed 3A performance, source modules from reputable suppliers (Adafruit, Pololu) or use a different switching regulator IC with better supply chain integrity (XL4015, MP1584EN).

---

Relevant Notes:
- [[salvaged-generic-components-have-no-datasheets-so-specs-must-be-determined-empirically]] -- same "verify before trust" principle applies to new but cheap modules
- [[switching-buck-converters-waste-watts-not-volts-making-them-essential-for-large-voltage-differentials]] -- the efficiency advantage only holds if the chip actually performs as specified

Topics:
- [[power-systems]]
