---
description: "After discharging a large electrolytic capacitor to 0V, the dielectric can spontaneously recover 5-15% of the original voltage within minutes as trapped charge migrates from deep within the oxide layer -- a second discharge check after 60 seconds is mandatory safety practice"
type: knowledge-note
source: "docs/parts/200mxr470m-electrolytic-capacitor-470uf-200v-radial.md"
topics:
  - "[[passives]]"
  - "[[power-systems]]"
confidence: high
verified: false
---

# Dielectric absorption causes voltage recovery in discharged electrolytic capacitors

Dielectric absorption (also called "soakage" or "battery effect") is a physical property of all real dielectrics where charge becomes trapped in deep layers of the insulating material during extended charging. When the capacitor is rapidly discharged to 0V, only the surface charge is removed. The deep-layer charge then slowly migrates to the plates over seconds to minutes, causing the terminal voltage to recover.

**The safety concern:** A 470uF/200V capacitor discharged to 0V through a resistor may recover 10-30V within 60 seconds. While 30V from this capacitance (0.2 joules) is unlikely to be lethal, it is painful and surprising -- and in a high-voltage bank of paralleled capacitors, the recovered energy can be significant.

**Recovery magnitude depends on:**
- Dielectric material: aluminum oxide has moderate absorption (~2-5%); polyester film is worse (~0.5-1%); polypropylene film is best (<0.1%)
- Time at rated voltage: longer charging = more deep absorption
- Temperature: higher temperature increases absorption depth

**Mandatory procedure:**
1. Discharge through resistor until V = 0
2. Wait 60 seconds with no load connected
3. Check voltage again with multimeter
4. If voltage has recovered, discharge again
5. For safety-critical work, leave a bleeder resistor permanently connected across the terminals

**The distinction from incomplete discharge:** This is NOT the same as not waiting long enough for the RC time constant to expire. Even after 5+ time constants (mathematically 99.3% discharged), dielectric absorption can recover voltage from a mechanism that the RC model does not capture.

---

Relevant Notes:
- [[high-voltage-capacitors-store-dangerous-energy-that-persists-after-circuit-power-off]] -- The broader safety context where dielectric absorption is a secondary hazard
- [[electrolytic-capacitor-voltage-derating-to-80-percent-of-rated-voltage-is-mandatory-for-reliability]] -- Voltage stress increases dielectric absorption magnitude

Topics:
- [[passives]]
- [[power-systems]]
