---
observed_date: 2026-04-12
category: enrichment
source: "docs/parts/hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors.md"
target_note: "hall-sensor-wiring-order-matters-for-bldc"
---

# enrichment: hall-sensor-wiring-order-matters-for-bldc needs commutation table and broken sensor diagnostic

The hoverboard motor source adds the full 6-step commutation table (Hall A/B/C states mapped to active phases with binary/decimal encodings), the 000/111 broken sensor diagnostic rule, and the specific color coding convention (yellow/green/blue for both phase wires and Hall signals). The existing note covers trial-and-error swapping methodology but lacks the reference commutation sequence table that would make it a complete bench reference.

Action: Update [[hall-sensor-wiring-order-matters-for-bldc]] with commutation table from source lines 147-158, broken sensor diagnostic from line 159, and wire color conventions from lines 120-141.
