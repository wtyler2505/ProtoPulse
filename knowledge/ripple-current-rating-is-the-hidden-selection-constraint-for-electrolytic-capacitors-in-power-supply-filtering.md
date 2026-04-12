---
description: "In SMPS and amplifier PSU filtering, the AC ripple current through the capacitor generates internal heating via ESR (P = Irms^2 x ESR) -- exceeding the ripple current rating accelerates electrolyte evaporation and shortens lifespan even when voltage rating is respected"
type: knowledge-note
source: "docs/parts/200mxr470m-electrolytic-capacitor-470uf-200v-radial.md"
topics:
  - "[[passives]]"
  - "[[power-systems]]"
confidence: high
verified: false
---

# Ripple current rating is the hidden selection constraint for electrolytic capacitors in power supply filtering

Beginners select electrolytic capacitors by two specs: capacitance (for filtering performance) and voltage rating (for safety). The third spec -- ripple current rating -- is the one most commonly ignored, and it is the primary lifespan determinant in power supply applications.

**The mechanism:**
- In a rectifier/filter circuit, the capacitor charges during voltage peaks and discharges during valleys
- This charge/discharge cycle creates an AC ripple current through the capacitor
- The ripple current flows through the capacitor's ESR (equivalent series resistance), generating heat: `P = Irms^2 x ESR`
- This internal heating is indistinguishable from ambient heating in its effect on electrolyte evaporation

**For the 470uF/200V Rubycon MXR:**
- Ripple current rating: ~800mA at 105C, 120Hz
- ESR: ~0.3 ohm at 100kHz
- Internal heating at rated ripple: `0.8^2 x 0.3 = 0.192W`

**Why this matters more than voltage in practice:**
- Voltage derating is intuitive (don't exceed the max)
- Ripple current is invisible without an AC current measurement
- A cap operating at 50% of rated voltage but 150% of rated ripple current will fail faster than one at 90% of rated voltage with nominal ripple current

**Selection rule for power supply filtering:**
1. Choose capacitance for ripple voltage requirement: `C = I_load / (2 x f x Vripple)`
2. Choose voltage rating with 80% derating
3. **Verify** that the capacitor's ripple current rating exceeds the calculated ripple current
4. If ripple current is exceeded, either use a higher-rated cap or parallel multiple caps (ripple current ratings add in parallel)

---

Relevant Notes:
- [[electrolytic-capacitor-voltage-derating-to-80-percent-of-rated-voltage-is-mandatory-for-reliability]] -- Voltage derating is the more obvious but less critical constraint
- [[every-10c-above-rated-temperature-halves-aluminum-electrolytic-capacitor-lifespan]] -- ESR heating from ripple current compounds with ambient temperature

Topics:
- [[passives]]
- [[power-systems]]
