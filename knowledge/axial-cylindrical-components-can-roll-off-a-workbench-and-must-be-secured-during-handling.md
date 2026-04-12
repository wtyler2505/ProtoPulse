---
description: "Axial capacitors, resistors, and diodes are cylinders with leads on both ends -- they roll freely on flat surfaces, which is a practical bench hazard especially for high-voltage parts that should not be casually picked up off the floor"
type: knowledge-note
source: "docs/parts/381383-cde-aluminum-electrolytic-capacitor-axial-high-voltage.md"
topics:
  - "[[passives]]"
confidence: medium
verified: false
---

# Axial cylindrical components can roll off a workbench and must be secured during handling

Axial components (capacitors, resistors, diodes, inductors) have a cylindrical body with leads exiting from both ends. On a flat workbench, they roll freely. This is a practical hazard in two ways:

1. **High-voltage parts rolling to the floor:** A charged electrolytic capacitor that rolls off a bench and lands on a conductive surface (metal tray, anti-static mat connected to ground) may discharge through an uncontrolled path. Picking it up without checking voltage is a shock risk. The CDE 381LX series can store 10+ joules at rated voltage.

2. **Small parts disappearing:** Axial resistors and small film caps roll into bench cracks, behind equipment, or onto the floor where they mix with other loose components. For an inventory system like ProtoPulse, losing track of a specific axial part defeats the purpose of cataloging.

**Practical mitigations:**
- Use a silicone bench mat (non-rolling surface)
- Bend one lead 90 degrees to prevent rolling (the "bench anchor" trick)
- Store axial parts in labeled bags or compartmented boxes, not loose on bench
- For high-voltage axial electrolytics: discharge FIRST, then secure in a non-conductive tray

This is distinct from the electrical safety notes about discharge procedures and polarity -- it is a physical handling concern that applies to all cylindrical axial components regardless of voltage.

---

Source: [[381383-cde-aluminum-electrolytic-capacitor-axial-high-voltage]]

Relevant Notes:
- [[axial-electrolytic-form-factor-exits-leads-from-both-ends-and-is-common-in-vintage-equipment-but-rare-in-modern-pcb-designs]] -- the form factor that creates this rolling hazard
- [[high-voltage-capacitors-store-dangerous-energy-that-persists-after-circuit-power-off]] -- why a rolling HV cap is more than just an annoyance

Topics:
- [[passives]]
