---
description: "Electrolyte slowly evaporates through the seal over months to years of non-use, thinning the oxide dielectric layer -- applying full rated voltage to a long-dormant cap can punch through the weakened dielectric, requiring a slow reforming process through a current-limiting resistor"
type: knowledge-note
source: "docs/parts/200mxr470m-electrolytic-capacitor-470uf-200v-radial.md"
topics:
  - "[[passives]]"
confidence: high
verified: false
---

# Dormant aluminum electrolytics require reforming before full voltage application

Aluminum electrolytic capacitors have a finite shelf life, not just a finite operating life. The aluminum oxide dielectric layer is maintained by a small leakage current during normal operation -- this current continuously repairs micro-defects in the oxide. When the cap sits unused:

1. **Electrolyte evaporation** slowly reduces the electrolyte volume through the seal (rubber or epoxy)
2. **Oxide degradation** occurs as micro-defects accumulate without the reforming current to repair them
3. **Leakage current increases** because the thinner/weaker oxide conducts more

**The failure mode:** Applying full rated voltage to a cap that has sat dormant for 1+ years can cause the weakened oxide to break down locally. The resulting leakage current generates heat, which further degrades the oxide, leading to thermal runaway and potential venting or rupture.

**Reforming procedure:**
1. Connect a current-limiting resistor (10K-100K ohm) in series with a DC power supply
2. Set supply to 10% of rated voltage
3. Wait until leakage current stabilizes (minutes to hours)
4. Increase voltage by 10% increments, waiting at each step
5. Continue until rated voltage is reached with stable, low leakage current
6. If leakage current does not decrease at any step, the cap is beyond reforming and should be discarded

**Practical time estimates:**
- 1 year dormant: 15-30 minutes reforming
- 3-5 years dormant: 1-4 hours reforming
- 10+ years dormant: may not be recoverable

**Inventory implication:** Electrolytic caps in the parts inventory that have not been used in over a year should be flagged for reforming before use in new projects. This is especially relevant for high-voltage caps (>50V) where the failure energy is significant.

---

Relevant Notes:
- [[high-voltage-capacitors-store-dangerous-energy-that-persists-after-circuit-power-off]] -- A dormant cap that fails during reforming can still release stored energy
- [[electrolytic-capacitor-voltage-derating-to-80-percent-of-rated-voltage-is-mandatory-for-reliability]] -- Derating is even more important for reformed caps

Topics:
- [[passives]]
