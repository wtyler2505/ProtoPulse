---
summary: Songle SRD-05VDC-SL-C relay — web-verified 5-pin SPDT layout for the @protopulse/parts seed library
category: hardware
provenance: verified
source: Songle SRD-05VDC-SL-C datasheet (circuitbasics / handsontec) (web-verified)
verified: 2026-06-22
---

# Songle SRD-05VDC-SL-C relay — verification note

Added `core:srd-05vdc-relay` to `@protopulse/parts`. 5 V SPDT electromechanical relay
(Tyler owns the bare relay — "Songle SRD-05VDC-SL-C Relay" in the component log). First
relay in the seed library. Pinout **web-verified** against the Songle datasheet.

## Part
- **MPN:** SRD-05VDC-SL-C (Ningbo Songle Relay)
- **Class:** `switch`, refPrefix **K** (IEEE/EDA reference designator for relays). 5 pins.
- Footprint deferred.

## Pinout — 5-pin PCB type
- **COIL1, COIL2** — 5 V coil, non-polarized, ~70 Ω, 0.36 W.
- **COM, NO, NC** — SPDT contact set. NC closed at rest; NO closes when the coil energizes.
- Contacts rated **10 A 250 VAC / 10 A 30 VDC**.

## ERC modeling
- All 5 pins → **passive.** A bare relay is a passive component: the coil is an inductive
  load driven externally (no internal source), and COM/NO/NC are switch terminals. This is
  distinct from a *relay module* (which would add a transistor driver + VCC/GND/IN logic
  pins — Tyler owns the bare relay, not a module board).

## Verification
- Web sources: Songle SRD-05VDC-SL-C datasheet (circuitbasics, handsontec), datasheetcafe —
  agree on 5-pin SPDT, 2 coil + COM/NO/NC, 10 A ratings.
- Component log agrees; datasheet is the authority.
- Vault (`qmd_search`): no prior relay note.

## Pipeline
Next: route to `knowledge/` via `/extract` as `hardware-component-srd-05vdc-relay.md`
(never author `knowledge/` directly).
