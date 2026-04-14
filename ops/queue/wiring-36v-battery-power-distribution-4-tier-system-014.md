---
type: enrichment
target_note: "[[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]]"
source_task: wiring-36v-battery-power-distribution-4-tier-system
addition: "The specific ANL 100A slow-blow fuse as the hardware mitigation that complements firmware current limiting, and the Albright SW200 contactor (200A continuous, 36-48V DC) as the high-current-capable e-stop replacement for panel-mount pushbuttons"
source_lines: "286-325"
---

# Enrichment 014: 4-motor BMS note — add ANL fuse and SW200 contactor as hardware mitigation

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 286-325)

## Reduce Notes

Enrichment for [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]]. Source adds the specific part selections (ANL 100A fuse + Albright SW200 contactor) that complement firmware current limiting as the hardware side of the protection stack. Current note covers the software side only.

Rationale: Naming specific parts with their ratings makes the note actionable for BOM selection, not just a principle. The SW200's 200A continuous rating provides margin above the 60A+ peak draw.

---

## Enrich

Added "Hardware mitigation parts" subsection to target insight `knowledge/four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting.md`. New content names ANL 100A slow-blow fuse (sized at 125-150% of peak, links to `[[anl-marine-fuse-class...]]`) and Albright SW200 contactor (200A continuous, 36-48V DC, links to `[[estop-auxiliary-contact-to-mcu...]]`). Explains three-layer protection stack: firmware throttling + SW200 interruption + ANL fuse. Ralph lead 2026-04-14.

## Connect

**Discovery Trace:**
- Topic map [[power-systems]] — appears at line 43 under "Batteries + BMS" via phrase "firmware ramp control is the correct fix, not a hardware upgrade" though that phrase maps to the BMS-overcurrent claim. The 4-motor-BMS claim is better situated under a cross-cutting heading. Existing phrase in MOC: look for standalone entry.
- Target note inline links verified: 10+ wikilinks including ANL-marine-fuse, estop-aux-contact, staggered-motor-startup, hoverboard-BLDC-motor, motor-shield-ladder. Strong hub node.
- Sibling candidates: [[per-branch-motor-fusing...]] (claim-003) cites this note. [[bms-discharge-port...]] (claim-002) cites this note. Bidirectional links already present.

**Connections verified:** 10+ inline prose links + multiple topics. Articulation test PASS. Note is a prime hub connecting BMS constraints, firmware remediation, and hardware backup (ANL fuse, SW200 contactor).

**MOC updates:** [[power-systems]] MOC should verify this note is listed explicitly under "Batteries + BMS" or a new "Current limiting" subhead — flag for a future MOC polish pass. Not edited here (pending MOC-polish wave).

**Agent note:** 10+ outgoing links AND 3+ incoming links = this note is a dense intersection. Protect from split — the claim is a single "systems argument" despite touching 10+ domains.

## Revisit
## Verify
