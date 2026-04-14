---
observed_date: 2026-04-12
category: tension
severity: high
source_a: "knowledge/bldc-stop-active-low-brake-active-high.md"
source_b: "docs/parts/riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md"
---

# BLDC brake polarity contradiction between KJL-01 and ZS-X11H sources

The existing knowledge note [[bldc-stop-active-low-brake-active-high]] claims BRAKE is **active-HIGH** ("connect to 5V to engage dynamic braking, leave floating for no brake"). Its source is `shared/verified-boards/riorand-kjl01.ts`.

The ZS-X11H parts reference document consistently states CT/BRAKE is **active-LOW**:
- Frontmatter: `CT -> Brake (LOW=brake, HIGH or float=coast)`
- Control truth table: `LOW -> BRAKING (motor phases shorted, active braking)`
- CT section: "When CT is pulled LOW, the controller shorts all three motor phases"

These are direct contradictions. Either:
1. The KJL-01 and ZS-X11H genuinely have opposite brake polarities (different controller models), or
2. The existing note has an error inherited from the code file it was sourced from

Resolution requires checking the KJL-01 source file and/or physical testing. If the KJL-01 truly uses opposite brake polarity from the ZS-X11H, this is a critical platform-level insight: **not all RioRand controllers share the same control logic**, and the bench coach cannot assume one polarity convention.

The existing note title "STOP is active-low and BRAKE is active-high" may need to be scoped to the KJL-01 specifically, or corrected entirely.

## Status: Corroborated (2026-04-14)

Wave F extraction added an atomic claim note that explicitly documents both sides of this contradiction from primary sources:

- [[ct-brake-polarity-on-the-zs-x11h-is-active-low-contradicting-the-kjl-01-claim-that-brake-is-active-high-suggesting-the-polarity-is-vendor-specific-not-a-bldc-convention]]

The new note confirms the contradiction is real and not a source error — the ZS-X11H datasheet and its Arduino wiring recipe both document CT brake as active-LOW, while the KJL-01 is documented as active-HIGH. Resolution: brake polarity is **vendor/controller-specific, not a BLDC convention** — per-controller verification is mandatory before trusting any generic brake rule. The existing [[bldc-stop-active-low-brake-active-high]] claim should be scoped to the KJL-01 specifically.

This tension is kept open as a productive tension (preserving the multi-source contradiction) rather than resolved, because the underlying claim — that brake polarity is stable across BLDC controllers — has been falsified, not reconciled.
