---
description: "Film capacitors (polyester, polypropylene) use solid plastic dielectric with no liquid electrolyte -- nothing evaporates, nothing degrades chemically, so lifespan is limited only by mechanical abuse or sustained over-voltage, not by the 2000-10000 hour clock that electrolytics face"
type: knowledge-note
source: "docs/parts/753j-400v-polyester-film-capacitor-75nf.md"
topics:
  - "[[passives]]"
confidence: high
verified: false
---

# Film capacitors have essentially unlimited lifespan because there is no electrolyte to dry out

Aluminum electrolytic capacitors have a finite lifespan because their liquid electrolyte slowly evaporates through the rubber seal, degrading capacitance and increasing ESR over time. This is why electrolytics are rated in hours (2000-10000h at rated temperature) and why the Arrhenius derating rule exists.

Film capacitors bypass this failure mechanism entirely. Their dielectric is solid plastic film (polyester/Mylar at ~85C, polypropylene at ~105C) with no liquid component. The degradation mechanisms that limit film cap life are:

1. **Dielectric aging under voltage stress** -- extremely slow at derated voltages
2. **Mechanical fatigue from thermal cycling** -- expansion/contraction can eventually crack the metallization
3. **Moisture ingress** -- in non-hermetically-sealed packages, humidity can degrade the dielectric over decades

In practice, film capacitors in normal operating conditions (within voltage and temperature ratings) last 20-50+ years. This makes them the preferred choice for:

- **Safety-critical circuits** where scheduled replacement is impractical (smoke detectors, fire alarm systems)
- **High-reliability industrial equipment** where downtime costs exceed component cost
- **Audio equipment** where electrolytic aging changes the frequency response over time (aging coupling caps = shifting bass response)

**The selection trade-off:** Film caps achieve this longevity at the cost of lower capacitance density. A 470uF electrolytic fits in a thumb-sized can; a 470uF film cap would be the size of a brick. Film caps are practical up to ~10uF in reasonable physical sizes. Above that, electrolytics are the only through-hole option for most applications.

**ProtoPulse DRC implication:** When a design requires a capacitor expected to last >10 years without replacement, recommend film over electrolytic if the required capacitance is under 10uF.

---

Source: [[753j-400v-polyester-film-capacitor-75nf]]

Relevant Notes:
- [[industrial-grade-electrolytic-capacitors-are-rated-for-5000-plus-hours-versus-2000-hours-for-generic-parts-making-manufacturer-reputation-a-selection-criterion]] -- the finite lifespan that film caps avoid
- [[every-10c-above-rated-temperature-halves-aluminum-electrolytic-capacitor-lifespan]] -- the derating rule that does not apply to film caps
- [[polyester-film-capacitors-self-repair-minor-dielectric-breakdowns-by-vaporizing-metallized-film-around-the-fault]] -- another longevity mechanism in film caps

Topics:
- [[passives]]
