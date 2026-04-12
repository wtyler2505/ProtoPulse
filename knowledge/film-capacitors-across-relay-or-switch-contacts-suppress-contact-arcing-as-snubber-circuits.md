---
description: "A small film cap (10-100nF, 400V+) wired directly across relay or switch contacts absorbs the voltage spike at contact opening -- this snubber circuit quenches the arc that otherwise erodes contacts and generates EMI"
type: knowledge-note
source: "docs/parts/753j-400v-polyester-film-capacitor-75nf.md"
topics:
  - "[[passives]]"
  - "[[power-systems]]"
confidence: high
verified: false
---

# Film capacitors across relay or switch contacts suppress contact arcing as snubber circuits

When a mechanical switch or relay contact opens while carrying current, the current does not stop instantly. As the contacts separate, the gap ionizes and an electric arc forms. This arc:

1. **Erodes the contact surfaces** -- metal vaporizes and deposits as carbon/oxide, increasing contact resistance over time
2. **Generates broadband EMI** -- the rapid current collapse radiates electromagnetic noise that corrupts nearby digital circuits, analog sensors, and radio receivers
3. **Creates voltage spikes** -- the inductive energy in the wiring and load collapses into a transient that can exceed the supply voltage by 10-100x

**The snubber solution:** Place a small film capacitor (typically 10-100nF, rated above the circuit voltage) directly across the contacts (in parallel with the arc path). When the contacts open:

1. The cap absorbs the initial surge current that would otherwise sustain the arc
2. The voltage across the contacts rises gradually (limited by I = C dV/dt) instead of spiking
3. The arc extinguishes faster because the voltage rise is controlled

**Why film capacitors specifically:**
- **Voltage rating:** Film caps are available at 400V-630V in small packages. Ceramic caps at these voltages are physically large and prone to cracking.
- **Self-healing:** Metallized film caps survive occasional transients that exceed their voltage rating (see [[polyester-film-capacitors-self-repair-minor-dielectric-breakdowns-by-vaporizing-metallized-film-around-the-fault]])
- **ESR profile:** Low enough to absorb fast transients but not so low that they create destructive inrush on contact close

**Snubber vs flyback diode:** These serve different purposes and are NOT interchangeable:
- **Flyback diode** across the relay COIL -- protects the driver transistor/MOSFET from the coil's inductive spike
- **Snubber cap** across the relay CONTACTS -- protects the contacts from arcing and the circuit from EMI

A relay-driven circuit may need BOTH: flyback diode on the coil side, snubber cap on the contact side.

**Typical values:** For relay contacts switching 5-24V DC loads, a 100nF/400V polyester film cap is a common starting point. Some designs add a small series resistor (10-100 ohm) to form an RC snubber that damps oscillation.

---

Source: [[753j-400v-polyester-film-capacitor-75nf]]

Relevant Notes:
- [[relay-coil-is-an-inductor-that-generates-destructive-back-emf-spikes-when-de-energized]] -- the coil-side protection (flyback diode) that complements the contact-side snubber
- [[polyester-film-capacitors-self-repair-minor-dielectric-breakdowns-by-vaporizing-metallized-film-around-the-fault]] -- why film caps survive the transient abuse of snubber duty

Topics:
- [[passives]]
- [[power-systems]]
