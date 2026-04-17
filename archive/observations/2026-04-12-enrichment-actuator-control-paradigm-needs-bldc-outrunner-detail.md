---
observed_date: 2026-04-12
category: enrichment
source: "docs/parts/hoverboard-bldc-hub-motor-250w-36v-with-hall-sensors.md"
target_note: "each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm"
---

# enrichment: each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm needs BLDC detail

The hoverboard motor source adds outrunner vs inrunner distinction, 15 pole pairs (30 magnets), KV rating (~8-10 RPM/V), and that the outer shell is the rotor. The existing note has only a one-liner for BLDC in the actuator type table ("ESC/controller commutates three phases based on rotor position from Hall sensors. Not user-controllable PWM"). The source provides enough detail to expand the BLDC row into a richer explanation.

Action: Update [[each-actuator-type-requires-a-fundamentally-different-control-signal-paradigm]] with outrunner architecture detail, pole pair count, and KV rating context.
