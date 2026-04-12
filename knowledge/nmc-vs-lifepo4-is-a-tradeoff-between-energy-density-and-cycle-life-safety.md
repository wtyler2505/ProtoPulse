---
description: "NMC cells (3.7V nominal, 500-1000 cycles, higher fire risk) optimize for weight; LiFePO4 cells (3.2V nominal, 2000-4000 cycles, inherently safe) optimize for longevity -- the choice cascades into charger selection, BMS configuration, and motor performance"
type: insight
source: "docs/parts/hoverboard-10s-lithium-ion-battery-pack-36v-with-bms.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[eda-fundamentals]]"
related_components:
  - "hoverboard-10s-battery-pack"
---

# NMC vs LiFePO4 is a tradeoff between energy density and cycle life safety

When building or replacing a battery pack for a rover or other high-power project, the cell chemistry choice between NMC (lithium nickel manganese cobalt oxide) and LiFePO4 (lithium iron phosphate) has cascading effects across the entire electrical system.

**Head-to-head comparison for a 10S configuration:**

| Property | NMC (LiNiMnCoO2) | LiFePO4 (LFP) |
|----------|-------------------|---------------|
| Nominal voltage per cell | 3.6-3.7V | 3.2V |
| Full charge per cell | 4.2V | 3.65V |
| Cutoff per cell | 3.0V | 2.5V |
| 10S pack nominal | 36-37V | 32V |
| 10S pack full charge | 42.0V | 36.5V |
| Energy density | 210-250 Wh/kg | 100-140 Wh/kg |
| Cycle life (100% DoD) | 500-1,000 | 2,000-4,000 |
| Thermal runaway onset | ~150C | ~270C |
| Self-discharge rate | ~2-3%/month | ~1-2%/month |
| Weight (same capacity) | Baseline | ~40-50% heavier |

**The cascading effects of switching from NMC to LFP:**

1. **Motor performance drops ~11%.** A 10S LFP pack produces 32V nominal vs 36V -- BLDC motors spin proportionally slower. The ZS-X11H controller operates fine at 32V, but top speed decreases. A 12S LFP configuration (38.4V nominal) better matches the original 36V spec but requires a different BMS and charger.

2. **Charger is incompatible.** NMC 10S requires a 42.0V charger. LFP 10S requires a 36.5V charger. Using an NMC charger on LFP cells overcharges them to destruction. This is the single most dangerous mistake when swapping chemistries.

3. **BMS parameters differ.** Overvoltage, undervoltage, and balancing thresholds are all chemistry-specific. An NMC BMS on LFP cells provides wrong protection at every level.

4. **Longevity vs weight tradeoff.** LFP's 4x cycle life means the pack lasts years longer, but at a 40-50% weight penalty. For a heavy rover with hoverboard motors, the weight increase is tolerable. For a lightweight drone or portable device, it may not be.

5. **Safety margin is dramatically better with LFP.** NMC enters thermal runaway at ~150C (achievable in a hot car, a short circuit, or a BMS failure). LFP's threshold of ~270C makes catastrophic failure far less likely. For a project without professional battery enclosure design, LFP is the safer choice.

---

Relevant Notes:
- [[10s-lithium-ion-pack-voltage-range-spans-30v-to-42v-and-the-usable-window-is-narrower-than-beginners-expect]] -- NMC voltage curve; LFP has an even flatter curve in the middle
- [[lithium-ion-charging-requires-cc-cv-profile-and-a-raw-power-supply-will-overcharge-cells]] -- the CC/CV profile parameters change with chemistry
- [[actuator-voltage-tiers-map-to-distinct-power-supply-strategies]] -- chemistry choice affects the high-power tier's voltage range

Topics:
- [[power-systems]]
- [[eda-fundamentals]]
