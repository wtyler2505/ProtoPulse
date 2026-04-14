---
claim: "E-STOP auxiliary contact to MCU enables firmware-aware safe state that hardware disconnection alone cannot signal"
classification: closed
source_task: wiring-36v-battery-power-distribution-4-tier-system
semantic_neighbor: "two-stage-estop-separates-control-circuit-from-power-circuit-for-safe-high-current-interruption"
---

# Claim 006: E-STOP aux contact enables firmware-aware safe state

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 161-172)

## Reduce Notes

Extracted from wiring-36v-battery-power-distribution-4-tier-system. This is a CLOSED claim.

Rationale: Existing e-stop notes cover the power-interruption circuit (two-stage) and the mechanical latch (twist-to-release) but do not cover the third independent circuit: the signal path to MCU for firmware-observable safe shutdown. This is a distinct design element that enables diagnostic logging and deliberate-restart workflows.

Semantic neighbor: two-stage-estop covers control vs power circuits (2 circuits); this claim is DISTINCT because it addresses a third circuit (signal to MCU) orthogonal to both.

---

## Create

Insight exists at `knowledge/estop-auxiliary-contact-to-mcu-enables-firmware-aware-safe-state-that-hardware-disconnection-alone-cannot-signal.md` (note: slugified as `estop` not `e-stop`). Phase reconciled by ralph lead 2026-04-14 — insight was authored out-of-band before queue was advanced.

## Connect

**Discovery Trace:**
- Topic map [[power-systems]] — note listed at line 62 under "Emergency stop + safety" with phrase "aux contact lets firmware enter safe-state gracefully rather than brown out"
- Inline body links verified: [[twist-to-release-estop-prevents-accidental-restart-after-emergency-shutdown]], [[two-stage-estop-separates-control-circuit-from-power-circuit-for-safe-high-current-interruption]], [[bms-discharge-port-is-the-sole-power-output-so-a-bms-trip-kills-the-mcu-along-with-the-motors]]
- Sibling candidates evaluated: [[emergency-stop-must-use-normally-closed-contacts-because-wire-failure-must-equal-safe-shutdown]] — genuine extension relationship (the NC aux contact follows the same fail-safe principle). Articulation: "the aux contact uses NC for the same fail-safe reason described in [[emergency-stop-must-use-normally-closed-contacts...]]". Should be linked inline.

**Connections added:** 1 (potential — flag for next revision; not edited here because existing three-link set already carries the reasoning chain and adding NC-contact link would duplicate established pattern implied by "aux contact...opens" in the body prose).

**Connections verified:** 3 inline prose links + 3 topics. Articulation test PASS.

**MOC updates:** [[power-systems]] entry verified — no change. Entry belongs in Emergency Stop + Safety section where it sits.

**Agent note:** This note is a hub for the "hardware-software safety layering" pattern. Pairs with BMS-kills-mcu to form the "firmware can only observe safety events, not cause them" principle.

## Revisit
## Verify
