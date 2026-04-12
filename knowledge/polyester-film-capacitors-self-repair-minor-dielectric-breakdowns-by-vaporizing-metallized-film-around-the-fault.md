---
description: "Metallized film capacitors can survive minor dielectric punctures because the thin metal electrode vaporizes around the fault point, isolating it -- this self-healing property makes them robust for high-voltage and high-reliability applications where electrolytics would fail"
type: knowledge-note
source: "docs/parts/753j-400v-polyester-film-capacitor-75nf.md"
topics:
  - "[[passives]]"
confidence: high
verified: false
---

# Polyester film capacitors self-repair minor dielectric breakdowns by vaporizing metallized film around the fault

Metallized film capacitors (polyester/Mylar, polypropylene) use an extremely thin metal layer (~50nm) deposited directly onto the plastic film dielectric. When a localized dielectric breakdown occurs (a pinhole, contamination, or voltage transient pierces the plastic), the fault current flows through the thin metal layer at the defect site. Because the metal is so thin, the current heats it beyond its vaporization point in microseconds, clearing a small area of metal around the fault. The result is an isolated dead spot rather than a permanent short.

**Why this matters for component selection:**

1. **Robustness under transients:** In applications like snubber circuits, the capacitor sees voltage spikes that can momentarily exceed the dielectric's breakdown strength. Self-healing allows the cap to survive occasional over-voltage events that would permanently damage a ceramic or electrolytic.

2. **Graceful degradation:** Each self-healing event removes a tiny area of electrode, slightly reducing capacitance. After many events, the cap loses measurable capacitance but continues functioning -- it degrades gracefully rather than failing catastrophically.

3. **Contrast with other dielectric types:**
   - **Ceramic caps:** No self-healing. A dielectric crack creates a permanent short or leakage path. Flexure cracking is a known ceramic failure mode.
   - **Electrolytic caps:** The aluminum oxide dielectric can self-reform to some extent (via electrochemical oxidation), but this is a different mechanism and only works at low fault currents.
   - **Film caps with foil electrodes:** Thick metal foil does NOT self-heal -- only metallized (vapor-deposited) film types have this property.

**The limitation:** Self-healing only works for small, localized faults. A massive over-voltage event that damages a large area of dielectric will exceed the self-healing capacity and create a permanent failure.

---

Source: [[753j-400v-polyester-film-capacitor-75nf]]

Relevant Notes:
- [[dielectric-absorption-causes-voltage-recovery-in-discharged-electrolytic-capacitors]] -- a different dielectric property; polyester film has higher absorption than polypropylene
- [[film-capacitors-have-essentially-unlimited-lifespan-because-there-is-no-electrolyte-to-dry-out]] -- self-healing contributes to this unlimited lifespan

Topics:
- [[passives]]
