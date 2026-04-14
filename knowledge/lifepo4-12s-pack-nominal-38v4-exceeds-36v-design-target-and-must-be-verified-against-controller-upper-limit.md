---
description: "A 12-series LiFePO4 pack reaches 43.8V at full charge and sits at 38.4V nominal -- substantially above a 36V-nominal Li-Ion pack -- which forces verification that downstream motor controllers (ZS-X11H rated 6-60V) and buck converters tolerate the upper end of the LiFePO4 range"
type: claim
created: 2026-04-14
source: "docs/parts/wiring-36v-battery-power-distribution-4-tier-system.md"
confidence: high
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
---

# LiFePO4 12S pack nominal 38V4 exceeds 36V design target and must be verified against controller upper limit

LiFePO4 cells have a nominal voltage of 3.2V per cell -- lower than the 3.6-3.7V of NMC lithium-ion. To reach a rover-compatible 36V nominal, a LiFePO4 pack uses 12 cells in series instead of the 10 that an NMC pack uses. But the chemistry difference compounds through the whole charge curve: the full-charge voltage per LiFePO4 cell is 3.65V versus 4.2V for NMC, the nominal per cell is 3.2V versus 3.6V, and the cutoff per cell is 2.5V versus 3.0V.

For a 12S LiFePO4 pack, this produces: 43.8V full charge, 38.4V nominal, 30V cutoff. Compare to a 10S NMC pack: 42V full charge, 36V nominal, 30V cutoff. The cutoff matches but the charge and nominal ranges are 1.8V and 2.4V higher respectively. Downstream hardware sees a systematically elevated voltage over most of the discharge curve.

This is not automatically a problem -- most 36V-class controllers have voltage headroom -- but it must be verified against the spec sheet of every component downstream of the battery. The ZS-X11H motor controller has an input range of 6-60V, so 43.8V peak is comfortably within spec. The LM2596 buck converter is rated 4-40V input, so 43.8V exceeds its maximum and it will fail immediately on a full-charge LiFePO4 pack. Substituting LiFePO4 for NMC on an existing 10S NMC design will destroy the buck converters unless they are upgraded to higher-voltage parts (LM2676, MP2315, or similar rated 50V+).

Second-order implications cascade:
- ADC voltage dividers designed for 42V peak (see [[130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin]]) must be recalculated for 43.8V peak, or the ADC will clamp during charging
- Fuse voltage ratings should be verified -- most ANL fuses are rated 125V DC so 43.8V is fine, but cheap automotive blade fuses rated 32V DC are out of spec on a LiFePO4 system
- BMS configuration must match the chemistry -- an NMC-programmed BMS will trigger overvoltage protection at 42V and refuse to charge a LiFePO4 pack above that

The fundamental rule: battery chemistry is not a drop-in swap. Changing from NMC to LiFePO4 "for safety" is a full electrical system redesign, not a battery substitution.

---

Source: [[wiring-36v-battery-power-distribution-4-tier-system]]

Relevant Notes:
- [[nmc-vs-lifepo4-is-a-tradeoff-between-energy-density-and-cycle-life-safety]] -- the chemistry comparison at the decision level
- [[130k-to-10k-voltage-divider-scales-42v-battery-maximum-to-3v-adc-input-with-safety-margin]] -- the divider that breaks on a LiFePO4 system
- [[counterfeit-lm2596-chips-are-common-on-cheap-modules-and-fail-under-heavy-load]] -- genuine parts cope with 40V input; counterfeits may fail earlier

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
