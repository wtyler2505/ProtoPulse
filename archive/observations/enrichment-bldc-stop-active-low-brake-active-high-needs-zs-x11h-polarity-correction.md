---
observed_date: 2026-04-12
category: enrichment
target_note: "bldc-stop-active-low-brake-active-high"
source: "docs/parts/riorand-zs-x11h-bldc-controller-6-60v-16a-with-hall-sensor-input.md"
---

# Enrichment: bldc-stop-active-low-brake-active-high needs ZS-X11H polarity correction

The existing note claims BRAKE is active-HIGH. The ZS-X11H source consistently says CT/BRAKE is active-LOW (LOW=brake, HIGH/float=coast). This is either a correction needed (if the KJL-01 source was wrong) or a scope clarification (if KJL-01 and ZS-X11H genuinely differ). See tension note in ops/tensions/.

Additionally, the existing note does not mention the EL (speed) pin at all, which is the third control signal with its own active-LOW trap. The note's title and scope could be expanded to cover all three active-level conventions (STOP, BRAKE, EL) on this controller family.

The source also adds specific Arduino code patterns for safe STOP+BRAKE sequencing and the thermal risk of holding BRAKE after the motor stops.
