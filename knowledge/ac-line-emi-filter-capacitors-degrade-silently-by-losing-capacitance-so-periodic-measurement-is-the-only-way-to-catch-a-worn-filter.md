---
description: "Self-healing X2 capacitors don't fail catastrophically — they lose capacitance incrementally with each heal event, so a worn filter produces no symptoms until EMI becomes a problem and the only diagnostic is measuring the cap's capacitance against nameplate"
type: claim
source: "docs/parts/docs_and_data.md"
confidence: proven
topics:
  - "[[passives]]"
---

# AC line EMI filter capacitors degrade silently by losing capacitance, so periodic measurement is the only way to catch a worn filter

The service-life failure mode of a properly-sized X2 capacitor is not a sudden failure — it is graceful capacitance loss over years. Each self-heal event (triggered by a transient dielectric breakdown) vaporizes a small patch of electrode around the fault, permanently removing a tiny amount of active capacitor area. Thousands of these events add up to measurable capacitance decay.

Consequences:
- **Symptoms are silent** — the device still powers on, still runs. The only effect is reduced EMI attenuation at the higher frequencies.
- **Diagnosis requires an LCR meter** — you cannot tell by visual inspection. A cap measuring 80nF where 150nF is labeled is worn out even if it looks pristine.
- **Field failure manifests as "increased EMI susceptibility"** — the device that ran fine for 5 years now resets when the vacuum cleaner starts. Diagnose the X2 cap first.

Maintenance-relevant positions (e.g. industrial controls, medical equipment, long-deployed fixtures) should have X2 caps on a replacement schedule or periodic-measurement schedule. Consumer equipment typically runs the cap to end-of-life because nothing else would justify the service call.

Compare to DC electrolytic aging (dry-out, gradual ESR rise) — different mechanism, similar outcome: silent aging where measurement is the only reliable diagnosis.

---

Source: [[docs_and_data]]

Relevant Notes:
- [[every-10c-above-rated-temperature-halves-aluminum-electrolytic-capacitor-lifespan]] — same silent-aging pattern in DC caps
- [[polyester-film-capacitors-self-repair-minor-dielectric-breakdowns-by-vaporizing-metallized-film-around-the-fault]] — the mechanism that drives the gradual capacitance loss

Topics:
- [[passives]]
