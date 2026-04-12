---
description: "CdS photoresistors contain cadmium — a RoHS-regulated substance. RoHS Annex III exemptions allow them in some sensor applications, but for new commercial designs this creates sourcing and compliance risk when moving from prototype to production"
type: claim
source: "docs/parts/photoresistor-ldr-light-dependent-resistor-analog-light-sensor.md"
confidence: proven
topics:
  - "[[sensors]]"
  - "[[eda-fundamentals]]"
related_components:
  - "photoresistor-ldr"
---

# CdS photoresistors are RoHS restricted because cadmium sulfide is a regulated hazardous substance

Cadmium (Cd) is one of the six substances restricted by the EU RoHS (Restriction of Hazardous Substances) directive, with a maximum concentration of 0.01% by weight (100 ppm) in homogeneous materials. CdS photoresistors are essentially MADE of cadmium sulfide — they exceed this limit by orders of magnitude.

**Current status:**
- RoHS Annex III provides time-limited exemptions for specific applications where no viable alternative exists
- Exemption 39 previously covered cadmium in light sensors, but exemption renewals are increasingly scrutinized
- Many professional electronics manufacturers have already switched to silicon photodiodes or phototransistors for light sensing

**Impact on maker-to-production path:**
1. **Prototyping:** No issue. Buy from hobby suppliers, use freely on breadboards
2. **Personal projects:** No issue. RoHS applies to products placed on the market
3. **Small production runs:** Potential issue if selling in EU. Must verify current exemption status
4. **Commercial products:** Replace with compliant alternatives (TSL2561, BH1750, or silicon photodiodes)

**Compliant alternatives:**
| Component | Interface | Calibrated? | RoHS? |
|---|---|---|---|
| CdS LDR | Analog (voltage divider) | No | Restricted |
| Silicon photodiode | Analog (current) | Somewhat | Compliant |
| Phototransistor | Analog (current) | No | Compliant |
| TSL2561 | I2C digital | Yes (lux) | Compliant |
| BH1750 | I2C digital | Yes (lux) | Compliant |
| VEML7700 | I2C digital | Yes (lux) | Compliant |

**For the bench coach:** When a user adds an LDR to a project and later asks about "making it into a product" or "selling on Etsy/Tindie," flag the RoHS concern and suggest the I2C digital alternatives as a drop-in replacement path (better accuracy AND compliance).

---

Relevant Notes:
- [[cds-photoresistors-have-logarithmic-response-making-them-qualitative-not-quantitative-light-sensors]] -- Additional reason to prefer digital alternatives for new designs

Topics:
- [[sensors]]
- [[eda-fundamentals]]
