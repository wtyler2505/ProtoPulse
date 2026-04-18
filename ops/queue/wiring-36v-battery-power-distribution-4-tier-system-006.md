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

**Reweave pass completed 2026-04-14.**

**Claim status:** unchanged. The claim "firmware-aware safe state that hardware disconnection alone cannot signal" is already sharp, arguable, and specific. No sharpening, splitting, or challenge needed.

**Backward pass — newer/related notes evaluated:**
- [[emergency-stop-must-use-normally-closed-contacts-because-wire-failure-must-equal-safe-shutdown]] — /connect flagged as genuine extension but did not edit. Reweave added it (see below).
- Siblings from Wave F handoff (voltage-divider, BMS-discharge, per-branch fusing, 10uF ceramic, LVD hysteresis, lead-acid LVD, LiFePO4 12S, voltage-to-percentage, ANL fuse) evaluated — all are power-distribution / battery-monitoring domain, orthogonal to safety-signal wiring. No forced connections.
- Backlinkers ([[emergency-stop-via-stop-pin-low-disables-bldc-controllers-entirely-and-is-safer-than-regenerative-braking-for-fault-conditions]], stop-vs-ct-brake note, four-motor-bldc note) already reference this note correctly — no reciprocal edits needed.

**Edits applied:**
1. Inline link added in paragraph 3 (signal circuit description) to [[emergency-stop-must-use-normally-closed-contacts-because-wire-failure-must-equal-safe-shutdown]] with articulation: "the aux contact uses NC for the same fail-safe reason the main contacts do...if the signal wire breaks or the connector corrodes, the GPIO reads the same low state as 'e-stop pressed'." This closes the /connect-phase gap.
2. Same note added to Relevant Notes footer with articulation: "the fail-safe NC principle applied to the signal path, not just the power path."
3. Reciprocal link added to [[emergency-stop-must-use-normally-closed-contacts-because-wire-failure-must-equal-safe-shutdown]] footer pointing back to this note with articulation: "the NC fail-safe principle extends to the firmware signal path, not just the power path."

**Network effect:** outgoing links 3 -> 4 on target; NC-contacts note outgoing 3 -> 4. New traversal path: NC-contacts <-> aux-contact, surfacing the NC-principle-applies-to-signals-not-just-power pattern.

**MOC updates:** [[power-systems]] line 62 already lists this note correctly under Emergency Stop + Safety. No edit needed.

## Verify

**Target note:** `knowledge/estop-auxiliary-contact-to-mcu-enables-firmware-aware-safe-state-that-hardware-disconnection-alone-cannot-signal.md`

**Gate 1 — Description quality:** PASS. Description is specific, adds information beyond the title (includes numbers, rationale, mechanism), and a cold reader could predict the claim's title from it.

**Gate 2 — Schema compliance:** PASS. All required fields present (description, type, created: 2026-04-14, source, confidence: proven, topics, related_components).

**Gate 3 — Graph integrity:** PASS. All 13 wiki-links resolve.

**Result:** All gates PASS. No gaps.
