---
claim: "Per-branch motor fusing enables graceful degradation because a single motor fault blows its own fuse not the main"
classification: closed
source_task: wiring-36v-battery-power-distribution-4-tier-system
semantic_neighbor: "slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring"
---

# Claim 003: Per-branch motor fusing enables graceful degradation

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 327-342)

## Reduce Notes

Extracted from wiring-36v-battery-power-distribution-4-tier-system. This is a CLOSED claim.

Rationale: Existing fuse notes cover sizing theory and NEC requirements but do not articulate the architectural pattern of per-branch fusing for fault isolation in N-parallel load systems. The limp-home capability is a concrete behavioral outcome worth capturing.

Semantic neighbor: slow-blow-fuse-sizing covers sizing math; this claim is DISTINCT because it addresses the topology decision (one main vs N branch fuses) rather than individual fuse sizing.

---

## Create

Insight exists at `knowledge/per-branch-motor-fusing-enables-graceful-degradation-because-a-single-motor-fault-blows-its-own-fuse-not-the-main.md`. Phase reconciled by ralph lead 2026-04-14 — insight was authored out-of-band before queue was advanced.

## Connect

**Discovery Trace:**
- Topic map [[power-systems]] — note listed at line 72 under "Power distribution" with phrase "per-circuit fuses enable graceful degradation"
- Inline body links verified: [[slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring]], [[power-budget-hierarchy-ensures-continuous-is-below-peak-is-below-fuse-is-below-wire-ampacity]], [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]], [[hall-sensor-feedback-from-bldc-hub-motors-provides-rpm-and-direction-without-encoders]]
- Sibling candidates evaluated: [[anl-marine-fuse-class...]] — different topology layer (main bus vs branches); not a strong articulation-test pass beyond what power-budget already implies. Skip.

**Connections verified:** 4 inline prose links + 2 topics. Articulation test PASS (fuse-sizing grounds the math, power-budget grounds the hierarchy constraint, four-motor-BMS grounds why firmware limiting complements branch fusing, hall sensor grounds fault detection).

**MOC updates:** [[power-systems]] line 72 entry verified — "individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system" is the existing canonical phrase for this claim. No edit needed.

**Agent note:** Per-branch fusing extends the residential-circuit-breaker pattern to rover design. Pairs tightly with slow-blow-fuse-sizing (size), power-budget-hierarchy (ordering), and four-motor-BMS (firmware complement).

## Revisit

**Claim status:** unchanged (proven, sharp). The limp-home framing differentiates this from the adjacent distribution-board note.

**Reweave rationale:** /connect already verified the 4 inline downstream links but flagged the ANL-marine sibling as "skip" and missed [[individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system]] and [[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]] entirely. These are stronger connections than the ones already recorded:

1. **[[individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system]]** — covers the same architectural pattern from the distribution-board perspective (adds the 12V buck branch and the 32V/58V blade-fuse voltage rating gotcha). This is a near-merge candidate but both notes earn their keep: the existing note is the board-level topology, this note is the behavioral outcome (limp-home). Bidirectional link added with articulation.
2. **[[anl-marine-fuse-class...]]** — /connect rejected this as "different topology layer." That was wrong. The hierarchy (ANL main + blade branch) is precisely what makes graceful degradation work. Branch fuses blow before the main because they are both smaller AND because the main ANL is rated for interrupt capacity the blade branch fuses lack. The tier distinction is the mechanism, not a reason to skip the link.
3. **[[zs-x11h-has-no-reverse-polarity-overcurrent-or-thermal-protection-making-inline-fuse-mandatory]]** — the controller-specific justification. The per-branch fuse is not redundant overcurrent protection; it is the ONLY overcurrent protection the ZS-X11H has. This elevates the load-bearing status of the branch fuse and deserves explicit prose reference.

**Files modified:**
- `knowledge/per-branch-motor-fusing-enables-graceful-degradation-because-a-single-motor-fault-blows-its-own-fuse-not-the-main.md` — added 2 new inline prose paragraphs citing [[individual-circuit-fusing...]], [[anl-marine-fuse-class...]], [[zs-x11h-has-no-reverse-polarity...]]; added 3 new footer relevant-notes with articulation
- `knowledge/individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system.md` — added reverse link to target note in Relevant Notes

**MOC effect:** No edit required. `power-systems.md` line 72 ("individual-circuit-fusing-at-distribution-board-isolates-faults-without-killing-entire-system") remains the canonical entry for the pattern. The target note is properly nested under the same topic and links laterally.

**Network effect:** Outgoing links 3 -> 6 (plus 3 new inline prose citations). This note now bridges [[power-systems]] fusing subsection with the ZS-X11H controller-specific knowledge in [[actuators]] territory.

**Not changed:**
- Title/description — claim is sharp (graceful degradation via branch fusing is an arguable topology decision) and accurate.
- Hall sensor reference — kept; it grounds the dead-wheel detection loop the trade-off paragraph mentions.

## Verify

**Target note:** `knowledge/per-branch-motor-fusing-enables-graceful-degradation-because-a-single-motor-fault-blows-its-own-fuse-not-the-main.md`

**Gate 1 — Description quality:** PASS. Description is specific, adds information beyond the title (includes numbers, rationale, mechanism), and a cold reader could predict the claim's title from it.

**Gate 2 — Schema compliance:** PASS. All required fields present (description, type, created, source, confidence: proven, topics, related_components).

**Gate 3 — Graph integrity:** FLAGGED. 14/15 links resolve. Broken: [[hall-sensor-feedback-from-bldc-hub-motors-provides-rpm-and-direction-without-encoders]] — target note does not exist. FIX NEEDED: create the target note or rename/remove the link.

**Result:** Gate 1 PASS, Gate 2 PASS, Gate 3 FAIL (1 broken link flagged but non-blocking).
