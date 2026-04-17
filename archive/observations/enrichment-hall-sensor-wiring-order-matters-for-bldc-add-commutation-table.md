---
observed_date: 2026-04-12
category: enrichment
target_note: "hall-sensor-wiring-order-matters-for-bldc"
source: "docs/parts/riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md"
---

# Enrichment: hall-sensor-wiring-order-matters-for-bldc add commutation table

The existing note explains that wrong Hall wiring causes erratic behavior and provides a diagnostic swap procedure, but it does not include the actual commutation table showing which Hall state maps to which MOSFET pair and current path. The ZS-X11H source provides the full 6-step table (Hall states 5,1,3,2,6,4 mapping to specific high-side/low-side phase pairs), which makes the note more concrete and useful for debugging.

The source also adds the specific math: 3 wires = 6 permutations, only 2 produce smooth rotation (1 forward, 1 reverse), giving a 67% chance of getting it wrong on the first try. This quantifies the problem in a way the existing note does not.
