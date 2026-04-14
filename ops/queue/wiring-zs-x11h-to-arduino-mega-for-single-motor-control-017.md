---
claim: "EL pin floating at MCU boot defaults the motor to full speed so explicit HIGH initialization is mandatory before STOP is enabled"
classification: closed
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
semantic_neighbor: "zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes"
---

# Claim 017: EL pin floating at MCU boot defaults the motor to full speed so explicit HIGH initialization is mandatory before STOP is enabled

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 110-119, 218)

## Reduce Notes

Extracted from wiring-zs-x11h-to-arduino-mega-for-single-motor-control. This is a CLOSED claim.

Rationale: The existing active-low note covers WHY EL inversion happens, but this claim is about the BOOT-TIME HAZARD specifically — the window between MCU reset and first line of setup() where pins are floating INPUTs. In an active-low system, floating = "active" = full speed. The Common Wiring Mistakes table explicitly lists "EL pin left floating on power-up -> motor runs at full speed immediately" as a distinct failure mode requiring the specific mitigation of initializing EL HIGH BEFORE toggling STOP HIGH. This is a sequencing/initialization claim distinct from the polarity claim.

Semantic neighbor: [[zs-x11h-el-speed-input-is-active-low-and-flips-polarity-between-pwm-and-analog-modes]] — DISTINCT because existing note argues the polarity inversion rule; this claim argues the initialization ordering rule that follows from it. The polarity note mentions "never leave EL floating" but doesn't articulate the setup() sequencing dependency with STOP.

---

## Create

Created `knowledge/el-pin-floating-at-mcu-boot-defaults-the-motor-to-full-speed-so-explicit-high-initialization-is-mandatory-before-stop-is-enabled.md`. Frontmatter: type=claim, source=wiring-zs-x11h-to-arduino-mega source doc, confidence=proven, topics=[actuators, microcontrollers], related_components=[riorand-zs-x11h, arduino-mega-2560]. Body covers the boot-window mechanism (50-200ms on Mega, 1-2s on ESP32), the active-LOW-means-full-speed consequence, correct `setup()` ordering with code block, and the 10K pull-up hardware mitigation. Wiki-linked to `[[zs-x11h-el-speed-input-is-active-low...]]`, `[[safe-bldc-startup-sequence...]]`, `[[bldc-stop-active-low-brake-active-high]]`, `[[esp32-six-flash-gpios-must-never-be-used]]`. Ralph lead 2026-04-14.

## Connect

**Discovery Trace:**
- Topic maps — target note has [[actuators]] and [[microcontrollers]] as topics. [[actuators]] MOC has 85 entries; verify this note is included.
- Target note inline links verified: [[zs-x11h-el-speed-input-is-active-low...]], [[safe-bldc-startup-sequence...]], [[bldc-stop-active-low-brake-active-high]], [[esp32-six-flash-gpios-must-never-be-used]]
- Batch 2 sibling candidates: [[safe-bldc-startup-sequence...]] already cited. [[powering-the-mcu-from-the-zs-x11h-5v-output-causes-resets...]] (claim-018) — adjacent system concern (boot-time reliability) but different mechanism; not a strong article-test pass without forcing. Skip.

**Connections verified:** 4 inline prose links + 2 topics. Articulation test PASS (active-low polarity grounds why floating=active; safe-startup grounds correct init sequence; stop/brake note grounds the paired signal; esp32-flash-gpios grounds the pin-selection constraint).

**MOC updates:** Verify [[actuators]] MOC lists this note — if absent, flag for MOC polish wave.

**Agent note:** Boot-window hazards are a whole class of BLDC init bugs. This note pairs tightly with safe-bldc-startup-sequence to form the "power-on behavior contract" for BLDC motor drivers. Together they answer "what pin states does the driver see in the first 200ms of boot?" — a question beginners rarely ask but always need the answer to.

## Revisit
(to be filled by revisit phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
