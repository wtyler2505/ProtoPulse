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
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
