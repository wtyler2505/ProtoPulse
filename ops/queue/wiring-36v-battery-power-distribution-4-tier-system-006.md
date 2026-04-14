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
## Revisit
## Verify
