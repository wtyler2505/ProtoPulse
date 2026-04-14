---
description: "Budget clone motor shields like the HW-130 sometimes populate counterfeit or remarked L293D chips that fail well below the datasheet's 600mA rating -- the symptom looks identical to an undersized driver and is invisible without bench current measurement"
type: claim
source: "docs/parts/dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma.md"
confidence: likely
topics:
  - "[[shields]]"
  - "[[actuators]]"
  - "[[eda-fundamentals]]"
related_components:
  - "dk-electronics-hw-130-motor-shield"
---

# counterfeit l293d chips on clone motor shields deliver lower than rated current with no external indication

Clone motor shields built to the lowest price point (including some HW-130 batches) sometimes populate L293D chips that are either counterfeit (dies of unknown origin remarked as L293D) or factory-reject bins sold off as grade-B parts. Both failure modes deliver current capacity below the datasheet-specified 600mA per channel, with no visible indication on the package beyond the printed "L293D" label.

**Why this is a category of failure distinct from ordinary undersizing:** When a beginner follows the inventory's spec table and picks a 400mA motor to stay under the 600mA L293D limit, they reasonably expect the shield to deliver 600mA. A counterfeit chip may actually top out at 200-400mA before thermally shutting down or producing brown voltage output, which looks exactly like the motor being too big -- except the motor is within spec. The debugger's first hypothesis ("motor stall current exceeds driver") leads them to buy a bigger motor shield, when the correct diagnosis is that the installed chip is not genuine.

**Why clone shields are the primary risk surface:** Since [[clone-arduino-voltage-regulators-can-overheat-silently-because-there-is-no-thermal-feedback]] documents the same failure mode for AMS1117 regulators on clone Arduino boards, the pattern generalizes -- cost-optimized assembly pulls ICs from whatever supplier clears purchasing, and semiconductor counterfeiting specifically targets cheap-but-ubiquitous parts like L293D, AMS1117, and CH340. Name-brand parts (Texas Instruments L293D marked with TI logo, lot codes, traceable date code) are statistically unlikely to be counterfeit; generic un-logo'd chips marked only with "L293D" carry significant counterfeit risk.

**How to verify a suspect chip:**
1. Measure motor current draw directly with a series ammeter or clamp meter
2. If current plateaus below 600mA while the motor is clearly demanding more (stalled or heavily loaded), and the chip is getting hot, suspect counterfeit
3. Cross-check package markings -- authentic TI L293D has the TI logo, a 4-character date code, and a lot traceability code. Pure-text "L293D" with no logo is a warning sign

**ProtoPulse implication:** The BOM confidence system should track chip sourcing for drivers -- flagging shields labeled as generic clones with lower confidence on the current rating than shields with verified-brand chips. The bench coach should suggest a current-measurement verification step before blaming an undersized-driver hypothesis.

---

Source: [[dk-electronics-hw-130-motor-shield-uses-l293d-at-600ma]]

Relevant Notes:
- [[clone-arduino-voltage-regulators-can-overheat-silently-because-there-is-no-thermal-feedback]] -- same pattern applied to voltage regulators on clone Arduino boards
- [[counterfeit-lm2596-chips-are-common-on-cheap-modules-and-fail-under-heavy-load]] -- same pattern applied to switching regulator modules
- [[the-d-suffix-on-l293d-denotes-built-in-clamp-diodes-and-the-non-d-variant-is-a-destructive-substitution]] -- L293 vs L293D is a deliberate substitution risk; counterfeiting is an accidental/fraudulent one, both target the same part family
- [[l293d-ground-pins-are-the-primary-thermal-dissipation-path-not-just-electrical-connections]] -- a counterfeit chip's lower current capacity often manifests as premature thermal shutdown

Topics:
- [[shields]]
- [[actuators]]
- [[eda-fundamentals]]
