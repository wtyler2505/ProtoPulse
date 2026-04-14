---
type: enrichment
target_note: "[[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]]"
source_task: wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter
addition: "Add phantom Hall transitions as a named failure mode that manifests when TXS0108E VCCA/VCCB decoupling is omitted or placed too far from the chip"
source_lines: "44-60"
---

# Enrichment 054: [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]]

Source: [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]] (lines 44-60)

## Reduce Notes

Enrichment for [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]]. The existing note catalogs generic failure modes via [[missing-decoupling-capacitors-produce-three-distinct-failure-modes]]. Source adds a NAMED and DOMAIN-SPECIFIC failure mode: **phantom Hall transitions** — false Hall state changes that the commutation logic interprets as motion, producing erratic speed readings or false position counts.

Specific additions:
- Named symptom: "phantom Hall transitions"
- Scenario: TXS0108E without VCCA and VCCB decoupling caps
- Mechanism: signal integrity degradation on a level shifter passes through as false edges on the A-side
- Placement rule restated: caps as close to VCC pins as physically possible

Rationale: Makes the abstract "signal integrity degrades" into a concrete diagnosable symptom that a beginner can search for. "Why does my motor RPM read 50,000?" becomes greppable.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
