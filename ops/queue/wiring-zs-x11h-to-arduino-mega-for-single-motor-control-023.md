---
claim: "BMS overcurrent protection tripping on acceleration is a software problem solved by ramp rate limiting not a hardware fault"
classification: closed
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
semantic_neighbor: null
---

# Claim 023: BMS overcurrent protection tripping on acceleration is a software problem solved by ramp rate limiting not a hardware fault

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 211)

## Reduce Notes

Extracted from wiring-zs-x11h-to-arduino-mega-for-single-motor-control. This is a CLOSED claim.

Rationale: The troubleshooting table lists "Motor spins then stops -> BMS overcurrent protection tripping -> Reduce acceleration rate, check for mechanical binding." This is a diagnostic claim that reframes an apparent hardware failure (motor cutting out) as a software rate-limiting problem. The BMS trips because the inrush during step speed changes exceeds its discharge current limit. The fix is ramp limiting in firmware, not replacing the BMS or controller. This connects BMS ratings to firmware ramp profiles — a cross-layer diagnostic insight.

Semantic neighbor: [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] is adjacent (firmware current limiting) but at the STEADY-STATE current level for multi-motor systems. This claim addresses TRANSIENT current during acceleration on single motors — a different failure mode at a different operating point.

---

## Create

Created `knowledge/bms-overcurrent-protection-tripping-on-acceleration-is-a-software-problem-solved-by-ramp-rate-limiting-not-a-hardware-fault.md`. Frontmatter: type=claim, topics=[actuators, power-systems, microcontrollers]. Body derives the 180A step-response inrush math (36V/0.2ohm), presents the characteristic motor-spins-then-cuts-out pattern, provides a ramp function with setTargetSpeed/updateRamp code, and contrasts with the multi-motor steady-state rule. Wiki-linked to `[[four-motor-bldc-systems-exceed...]]`, `[[staggered-motor-startup-by-100ms...]]`, `[[zs-x11h-el-speed-input...]]`, `[[bldc-direction-reversal-under-load...]]`. Ralph lead 2026-04-14.

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
