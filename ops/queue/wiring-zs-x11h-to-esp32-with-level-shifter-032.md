---
claim: "Single-MOSFET DIY level shifter inverts the signal requiring either code compensation or a second stage re-inversion"
classification: closed
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
semantic_neighbor: "bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control"
---

# Claim 032: Single-MOSFET DIY level shifter inverts the signal requiring either code compensation or a second stage re-inversion

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (lines 53-72)

## Reduce Notes

Extracted from wiring-zs-x11h-to-esp32-with-level-shifter. This is a CLOSED claim.

Rationale: The vault covers BSS138 bidirectional topology (two-MOSFET or body-diode-based circuits), but does NOT cover the single discrete MOSFET level shifter pattern that beginners build when they lack a module. In that circuit, ESP32 GPIO HIGH turns the 2N7000 ON which pulls the drain (ZS-X11H input) LOW — the signal inverts. This is a named gotcha because it combines with the ZS-X11H EL active-low behavior in cascading ways: two inversions can cancel out and produce accidentally-correct behavior that nobody documented. Deserves its own note so future sessions can reason about inversion budgets in level-shifted signal chains.

Semantic neighbor: bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control (DISTINCT — that note covers the two-MOSFET bidirectional topology where inversion cancels out across the pair; this covers single-MOSFET DIY shifters where inversion is a terminal property of the circuit).

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
