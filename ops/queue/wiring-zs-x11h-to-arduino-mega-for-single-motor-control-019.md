---
claim: "Motor power wiring below 14AWG overheats at 15A and creates fire risk so gauge is chosen by steady-state current not voltage"
classification: closed
source_task: wiring-zs-x11h-to-arduino-mega-for-single-motor-control
semantic_neighbor: null
---

# Claim 019: Motor power wiring below 14AWG overheats at 15A and creates fire risk so gauge is chosen by steady-state current not voltage

Source: [[wiring-zs-x11h-to-arduino-mega-for-single-motor-control]] (lines 222)

## Reduce Notes

Extracted from wiring-zs-x11h-to-arduino-mega-for-single-motor-control. This is a CLOSED claim.

Rationale: The Common Mistakes table states "Using thin wire (22AWG) for motor power -> wire overheats at 15A, fire risk. 14AWG minimum for motor power connections." This is a concrete safety rule derived from the ampacity of AWG ratings applied to BLDC motor currents. It is not captured in any existing note — the wiring-36v-battery-power-distribution note addresses battery-to-distribution wiring but not motor-phase wiring. This is a discrete, actionable DRC claim the bench coach should enforce.

Semantic neighbor: None. Distinct from existing fusing, voltage-divider, and battery-distribution notes which argue current protection and voltage scaling respectively — not conductor ampacity.

---

## Create

Created `knowledge/motor-power-wiring-below-14awg-overheats-at-15a-and-creates-fire-risk-so-gauge-is-chosen-by-steady-state-current-not-voltage.md`. Frontmatter: type=claim, topics=[power-systems, eda-fundamentals, actuators]. Body presents I²R reasoning, AWG ampacity table for 22/18/16/14/12, the 6.4x dissipation ratio between 22AWG and 14AWG at 15A, and three wiring classes (phase/main-bus/signal). Wiki-linked to `[[power-budget-hierarchy...]]`, `[[anl-marine-fuse-class...]]`, `[[four-motor-bldc-systems-exceed...]]`, `[[beginners-need-ai-that-catches-mistakes...]]`. Ralph lead 2026-04-14.

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
