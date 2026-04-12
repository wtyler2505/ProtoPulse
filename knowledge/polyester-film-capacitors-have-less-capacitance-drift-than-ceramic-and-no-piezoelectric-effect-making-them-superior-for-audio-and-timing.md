---
description: "Film caps (polyester, polypropylene) exhibit minimal temperature-driven capacitance shift and zero piezoelectric microphonics -- unlike X7R/Y5V ceramics whose capacitance varies 15-80% with temperature and which generate audible artifacts from mechanical vibration"
type: knowledge-note
source: "docs/parts/753j-400v-polyester-film-capacitor-75nf.md"
topics:
  - "[[passives]]"
confidence: high
verified: false
---

# Polyester film capacitors have less capacitance drift than ceramic and no piezoelectric effect making them superior for audio and timing

Ceramic capacitors with X7R, X5R, and Y5V dielectrics suffer from two properties that make them unsuitable for signal-path and precision timing applications:

1. **Temperature coefficient:** X7R drifts ~15% over its rated temperature range. Y5V can drift ~80%. This means a 100nF coupling cap can effectively become 120nF or 20nF depending on ambient temperature.

2. **Piezoelectric effect:** Ceramic dielectrics (especially high-K types like X7R/Y5V) are mechanically coupled to their electrical properties. Physical vibration generates voltage noise (microphonics), and applied voltage causes physical deformation (singing capacitors). In audio circuits, this creates audible artifacts.

**Film capacitors avoid both problems:**
- **Temperature stability:** Polyester film drifts ~1-2% over the operating range. Polypropylene is even better at <0.5%. The capacitance value you select is essentially the value you get regardless of temperature.
- **No piezoelectric effect:** Plastic film has no crystal lattice to couple mechanical and electrical energy. Zero microphonics, zero singing.

**Where this selection rule applies:**

| Application | Use Film | Use Ceramic | Why |
|-------------|----------|-------------|-----|
| Audio coupling/signal path | Yes | No | Microphonics in ceramics create audible noise |
| Tone/crossover networks | Yes | No | Capacitance drift changes frequency response |
| RC timing circuits | Yes (or NPO ceramic) | No (X7R/Y5V) | Drift changes time constants |
| Decoupling/bypass | No (size) | Yes | Exact value doesn't matter; ceramic is smaller |
| EMI filtering | Either works | Either works | Both effective for suppression |

**The NPO exception:** NPO/C0G ceramic capacitors have near-zero temperature drift (<30ppm/C) and minimal piezoelectric effect. They compete with film caps for stability but are only available in small values (<10nF typically). For values above ~10nF where stability matters, film caps are the only practical through-hole option.

---

Source: [[753j-400v-polyester-film-capacitor-75nf]]

Relevant Notes:
- [[npo-c0g-dielectric-is-mandatory-for-crystal-load-capacitors-because-temperature-driven-capacitance-drift-shifts-oscillator-frequency]] -- the ceramic exception that approaches film-cap stability
- [[dielectric-tolerance-is-irrelevant-for-decoupling-because-the-exact-capacitance-value-does-not-matter-for-transient-suppression]] -- where ceramic drift is acceptable

Topics:
- [[passives]]
