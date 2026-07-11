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

Backward pass (`/revisit --handoff`). Goal: find OLDER notes / siblings that *instantiate or depend on* this claim but don't link to it, and add inline links FROM them TO this note. Direction test applied to every candidate: does X's argument lean on 080, or does 080 lean on X? Only X-depends-on-080 qualifies.

**Outcome: no new links added — the one genuinely-justified backward link was already placed by the connect phase.**

Candidates examined and verdicts:

- **081 (TIMG divider)** — GENUINE backward link, ALREADY PRESENT. Verified on disk: inline at the "TIMG counter is virtual / derived from elapsed CPU cycles" phrase (line 22) plus a Relevant Notes entry (line 29). 081 scales the very same virtual TIMG0 counter whose precision 080 bounds — 081 genuinely depends on 080. Connect phase placed it; nothing to add.
- **072 (CCOUNT/CCOMPARE)** — sibling cycle-based comparator. Backward link ALREADY PRESENT (Relevant Notes, line 30: "both read off the single authoritative cycle clock"). Borderline-genuine (shared 1-IPC clock premise, no 54-bit-wrap dependency) but already in place and not harmful; left intact, did not strengthen.
- **071 (zero-cycle vectoring)** — REJECTED. 080 leans on 071 (080's body cites "the same economy the core already buys by retiring one instruction per cycle"), not the reverse. That dependency is already carried by the existing FORWARD link 080→071. Adding 071→080 would be the forward link's mirror = reciprocity-as-inflation; 071's own argument (no pipeline ⇒ zero-cycle vectoring) never touches timer derivation.
- **Umbrella (`a-faithful-instruction-set-emulator...`)** — REJECTED as a new backward link. 080 is NOT a "cut": lazy derivation is *faithful* (identical results to per-cycle ticking) and the 54-bit wrap was *fixed* (float-safe modulo / BigInt), not disclosed-and-accepted. Filing it in the umbrella's cut list would miscategorize it. The umbrella is also already selective (it omits 081, the memory-map note, adc1, condition-derived interrupts), so the omission is not a gap. Target already links forward to the umbrella; no reciprocal needed.
- ADC instant-conversion, conservative-boot PS.INTLEVEL, windowed-ABI notes — REJECTED (no timer-derivation dependency; different subsystems). Confirmed unchanged in connect phase.

Advisor consulted before editing (full transcript forwarded): confirmed the direction test, flagged 071 as inflationary and the umbrella-as-cut as a miscategorization, and endorsed adding little/nothing when the genuine gap (081) is already closed rather than manufacturing links. No edits to knowledge/ this phase. One phase only — verify NOT run.

## verify
(to be filled by verify phase)
