---
claim: "a virtual timer whose value derives from elapsed CPU cycles avoids per-cycle bookkeeping but requires float-safe modulo at the 54-bit wrap"
classification: closed
source_task: 2026-06-11-esp32s3-emulator-core-verification
semantic_neighbor: null
---

# Claim 080: a cycle-derived virtual timer avoids per-cycle bookkeeping but needs float-safe modulo at the 54-bit wrap

Source: [[2026-06-11-esp32s3-emulator-core-verification]] (lines 277-283)

## Reduce Notes

Extracted from 2026-06-11-esp32s3-emulator-core-verification. This is a CLOSED claim.

Rationale: Slice 8 gotcha: the ulp at 2^54 is 4, so naive (x%M+M)%M rounded 2 to 0 in a first draft — caught by test.

Semantic neighbor: none — qmd vector search against protopulse-vault returned no instruction-set / register-level emulator notes; this is net-new coverage for the @protopulse/emu package.

---

## Create

Note: [[a-cycle-derived-virtual-timer-avoids-per-cycle-bookkeeping-but-needs-float-safe-modulo-at-the-54-bit-wrap]]
Path: knowledge/a-cycle-derived-virtual-timer-avoids-per-cycle-bookkeeping-but-needs-float-safe-modulo-at-the-54-bit-wrap.md

Summary: Transformed source lines 277-283 into a verified claim note. A virtual TIMG0 timer derives its value lazily from elapsed CPU cycles (storing a cycle baseline, computing the count on read/alarm-eval) instead of ticking every cycle — sharing the single authoritative cycle clock with the one-instruction-per-cycle core. Precision hazard explained: the 54-bit counter exceeds JS Number's 2^53 safe-integer range (ulp at 2^54 is 4), so the positive-modulo wrap `(x%M+M)%M` can silently round in `Number` (the first draft rounded 2→0, caught by test); fix is float-safe modulo or BigInt. Linked inline to claim-072 (CCOUNT/CCOMPARE sibling timer) and the one-instruction-per-cycle emulator note (the cycle clock source). Claim-081 (TIMG divider) note not yet present in knowledge/ — not linked.

## connect

Dual discovery: walked topic maps `knowledge/emulation.md` + `knowledge/esp32-s3.md` and reviewed the timer cluster (072 CCOUNT/CCOMPARE, 081 TIMG divider) + the cycle-accounting group (071 zero-cycle vectoring). Verified sibling filenames via `ls knowledge/` (qmd indexes main repo, not this worktree).

Strongest new connection found: **claim-081 (TIMG divider)** is about the *same* virtual TIMG0 counter as this note — its body literally states "The TIMG counter is virtual — its value is derived from elapsed CPU cycles." 080 bounds the precision of that derivation at the 54-bit wrap; 081 decodes the prescaler that scales it. This was a genuine one-directional gap (081 predated 080 in the create note's view) — now reciprocated **both** directions.

Links added:
- Target → `esp32-s3-timg-divider-field-zero...` (Relevant Notes) — same virtual TIMG0 counter; precision-of-derivation vs divider decode.
- Target → `a-faithful-instruction-set-emulator-earns-trust...` (Relevant Notes) — umbrella principle; this note is one disclosed "modeled behavior + paired cut" (lazy derivation + test-proven wrap).
- `esp32-s3-timg-divider...` → Target — **inline** at the "TIMG counter is virtual / derived from elapsed CPU cycles" phrase, plus a Relevant Notes entry (reciprocal).

Already-present links left intact (both reciprocated): 071 zero-cycle vectoring (the cycle clock source) and 072 CCOUNT/CCOMPARE (sibling cycle-based comparator).

Topic-map membership: present in `emulation.md` (Exceptions/interrupts/timers section, confirmed). `esp32-s3.md` is an auto-generated stub awaiting human curation (empty Knowledge Notes, `auto_generated: true`); per the stub's own protocol it is not populated here — left untouched.

Did not link (rejected as non-genuine): the SAR-ADC instant-conversion note (different "model timing-free" rationale, no shared device), the conservative-boot PS.INTLEVEL note (no timer-derivation overlap), the windowed-ABI notes (unrelated subsystem). All link targets verified to resolve on disk.

## revisit
(to be filled by revisit phase)

## verify
(to be filled by verify phase)
