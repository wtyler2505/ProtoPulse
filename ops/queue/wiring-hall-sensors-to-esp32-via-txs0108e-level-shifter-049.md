---
claim: "Bit-shifting three Hall reads into a single 3-bit state byte produces atomic commutation lookups that avoid race conditions from reading bits independently between transitions"
classification: closed
source_task: wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter
semantic_neighbor: "[[bldc-commutation-table-maps-hall-states-to-phase-pairs-and-only-two-of-six-wire-permutations-produce-smooth-rotation]]"
---

# Claim 049: Bit-shift combining three Hall reads into a state byte makes commutation lookups atomic

Source: [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]] (lines 97-101)

## Reduce Notes

Extracted from wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter. This is a CLOSED claim.

Rationale: The source code shows the canonical pattern — `(digitalRead(A) << 2) | (digitalRead(B) << 1) | digitalRead(C)` — producing a 3-bit state byte. The implicit point is that this pattern is not just convenience: reading three digital pins independently during a transition produces a state that the Hall sensors never physically occupied (mid-transition reads). Combining into one byte matters for commutation table lookup correctness. This implementation pattern is not articulated anywhere in knowledge/ and is the kind of code-level invariant that EDA tools could suggest automatically.

Semantic neighbor: [[bldc-commutation-table-maps-hall-states-to-phase-pairs-and-only-two-of-six-wire-permutations-produce-smooth-rotation]] addresses the LOOKUP TABLE itself — which (A,B,C) maps to which phase pair. This note addresses the READING technique — how to get a consistent Hall state at all. DISTINCT layer of the same problem.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
