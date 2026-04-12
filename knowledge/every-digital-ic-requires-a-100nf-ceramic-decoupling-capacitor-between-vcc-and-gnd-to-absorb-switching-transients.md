---
description: "Digital IC switching draws sharp current spikes from the supply rail -- a 100nF ceramic capacitor placed as close as possible to VCC/GND pins acts as a local charge reservoir that absorbs these transients before they propagate and cause voltage dips"
type: knowledge-note
source: "docs/parts/100nf-ceramic-capacitor-104-50v-decoupling-bypass.md"
topics:
  - "[[passives]]"
  - "[[eda-fundamentals]]"
confidence: proven
verified: true
---

# Every digital IC requires a 100nF ceramic decoupling capacitor between VCC and GND to absorb switching transients

When a digital IC transitions output states, it draws a brief spike of current from the power rail (typically nanoseconds). The power supply cannot respond fast enough (the inductance of even short wires limits current slew rate), so the VCC voltage dips momentarily. A 100nF ceramic capacitor placed directly between VCC and GND pins serves as a local charge reservoir that delivers the spike current without requiring it to travel back through the supply traces.

**Why 100nF specifically:**
- At frequencies below ~1MHz, bulk electrolytic caps handle filtering
- At frequencies above ~100MHz, the capacitor's own parasitic inductance limits effectiveness
- 100nF is the sweet spot for the 1-100MHz range where digital switching noise lives
- X7R or even Y5V dielectric is acceptable -- the exact capacitance does not matter for this application, only that a fast-response capacitor exists at the IC's supply pins

**Placement rules:**
1. One capacitor per VCC pin, not per IC package (multi-VCC ICs need multiple caps)
2. As close as physically possible to the VCC and GND pins -- lead length adds inductance that defeats the purpose
3. On breadboards, this means the cap body should be within one or two tie points of the IC

**The universal rule:** If you are looking at a schematic and an IC has no 100nF capacitor between its VCC and GND pins, that is a design error. No exceptions. Even if "it works on the bench," it will fail intermittently in production or when the environment changes.

---

Relevant Notes:
- [[missing-decoupling-capacitors-produce-three-distinct-failure-modes]] -- What happens when this rule is violated
- [[multi-vcc-ics-need-one-decoupling-capacitor-per-vcc-pin-not-one-per-package]] -- The common mistake of under-decoupling multi-supply ICs
- [[analog-ics-need-decoupling-more-critically-than-digital-because-supply-noise-directly-contaminates-signal-measurements]] -- Analog ICs elevate this from important to critical
- [[78xx-regulators-require-input-and-output-capacitors-close-to-pins-for-stability]] -- Regulators themselves need decoupling for stability

Topics:
- [[passives]]
- [[eda-fundamentals]]
