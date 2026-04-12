---
observed_date: 2026-04-12
category: enrichment
target_note: "pole-pair-count-is-determined-empirically-by-counting-hall-state-transitions-per-wheel-revolution"
source: "docs/parts/riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md"
---

# Enrichment: pole-pair-count add SC pin RPM calculation

The existing note explains how to determine pole pair count empirically and why it matters for the controller. The ZS-X11H source adds the concrete application: the SC speed pulse output provides a consolidated single-wire signal (one pulse per Hall state change) that makes runtime RPM calculation simple.

Specific additions:
- RPM formula: `RPM = (pulse_frequency / 90) * 60` for 15-pole-pair motors
- Period-based alternative: `RPM = 60 / (pulse_period_seconds * 90)`
- Arduino interrupt-based code pattern for SC measurement
- Note that SC is 5V and needs voltage divider for 3.3V MCUs
