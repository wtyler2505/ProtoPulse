---
description: "An AC line EMI filter is not just about protecting the device — it's a two-way filter that also prevents the device's switching noise from re-entering the grid, and regulatory EMC compliance (FCC Part 15, CISPR 22) is specifically about the second direction"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[power-systems]]"
  - "[[passives]]"
---

# AC line EMI filters are bidirectional, protecting the device from grid noise AND preventing device noise from entering the grid

Beginners think of an AC line input filter as "protecting the device from dirty power." That's half the job. The other half — the half that EMC regulations actually enforce — is preventing the device's internal switching noise from radiating back into the grid where it becomes someone else's interference problem.

Both directions share the same filter topology (X caps + Y caps + common-mode choke). The filter doesn't have a preferred direction — it's a reciprocal two-port.

Regulatory drivers:
- **FCC Part 15, CISPR 22/32** — limit conducted emissions FROM the device INTO the mains
- **IEC 61000-4-4/-4-5** — specify the device's IMMUNITY to transients from the mains

A device shipped into the US/EU retail channel must pass both. The input filter on any switching power supply, LED driver, motor drive, or VFD exists primarily to pass the emissions test — not because the designers are concerned about the grid being dirty (the grid is dirty anyway) but because the product cannot legally be sold without it.

Design implication: if you're removing or undersizing the input filter to save BOM cost on a prototype, you are specifically breaking the emissions compliance path, not the immunity path.

---

Source: docs_and_data

Relevant Notes:
- [[x-class-capacitors-filter-line-to-line-while-y-class-filter-line-to-ground-and-swapping-them-is-a-certification-violation]] — the topology that implements this bidirectional filtering

Topics:
- [[power-systems]]
- [[passives]]
