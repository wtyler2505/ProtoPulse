---
claim: "ANL marine fuse class is the correct selection for rover main bus above 60A because automotive blade fuses lose interrupt capacity at DC"
classification: closed
source_task: wiring-36v-battery-power-distribution-4-tier-system
semantic_neighbor: "slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring"
---

# Claim 010: ANL marine fuse class correct for rover main bus

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 286-300)

## Reduce Notes

Extracted from wiring-36v-battery-power-distribution-4-tier-system. This is a CLOSED claim.

Rationale: Existing fuse notes cover sizing theory but do not articulate the class-selection decision (ATC vs Maxi vs ANL) driven by voltage rating and interrupt capacity. The specific threshold (>60A or >30V) where ANL becomes mandatory is a practical design rule worth capturing.

Semantic neighbor: slow-blow-fuse-sizing addresses the sizing math; this claim is DISTINCT because it addresses the physical fuse class and its physics-based selection criteria.

---

## Create

Insight exists at `knowledge/anl-marine-fuse-class-is-the-correct-selection-for-rover-main-bus-above-60a-because-automotive-blade-fuses-lose-interrupt-capacity-at-dc.md`. Phase reconciled by ralph lead 2026-04-14 — insight was authored out-of-band before queue was advanced.

## Connect

**Discovery Trace:**
- Topic map [[power-systems]] — note listed at line 68 under "Fusing + main disconnect" with phrase "ANL marine fuse > automotive blade fuse above 60A DC"
- Inline body links verified: [[slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring]], [[ac-switches-cannot-interrupt-dc-arcs-and-will-cause-fire-or-explosion-in-battery-systems]], [[main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement]]

**Connections verified:** 3 inline prose links + 2 topics. Articulation test PASS (slow-blow-sizing grounds the sizing axis; ac-switches-cannot-interrupt-dc grounds the interrupt-capacity physics that drives ANL over blade; main-fuse-within-six-inches grounds the placement requirement).

**MOC updates:** [[power-systems]] entry verified — no change.

**Agent note:** This is a class-selection claim (architectural) not a sizing claim (parametric). The three inline links form a tight chain: "size the fuse correctly, place it correctly, and pick the right physical class." Makes a nice example of how three separate claims compose into a complete design decision.

## Revisit

**Claim status:** unchanged -- the class-selection claim holds and is sharpened by newer context, not revised.

**Target note additions:**
- Added inline link to [[power-budget-hierarchy-ensures-continuous-is-below-peak-is-below-fuse-is-below-wire-ampacity]] -- frames the 100A ANL rating inside the continuous<peak<fuse<wire ordering. This note did not exist in its current form when the ANL note was authored.
- Added inline link to [[per-branch-motor-fusing-enables-graceful-degradation-because-a-single-motor-fault-blows-its-own-fuse-not-the-main]] -- explicitly completes the two-tier ANL-above / blade-below hierarchy that the ANL note describes but previously left disconnected. Bidirectional: per-branch already cites ANL, ANL now cites per-branch.
- Updated footer Relevant Notes to reflect both new connections.

**Older notes updated (backward pass):**
- `knowledge/main-fuse-within-six-inches-of-battery-positive-is-nec-fire-prevention-requirement.md` -- added ANL class-selection footer link. Pre-existing mention of ANL-100 was unlinked.
- `knowledge/slow-blow-fuse-sizing-at-125-percent-peak-prevents-nuisance-trips-while-protecting-wiring.md` -- added ANL class-selection footer link. Pre-existing mention of ANL time-current curve was unlinked.
- `knowledge/power-budget-hierarchy-ensures-continuous-is-below-peak-is-below-fuse-is-below-wire-ampacity.md` -- added ANL class-selection footer link. Pre-existing mention of "ANL-100 time-delay fuse" in row 3 was unlinked.

**Network effect:** ANL note outgoing links 3 -> 5. Three older fuse notes now forward-reference ANL class selection, closing the class-vs-sizing gap noted in the Connect phase. The "size the fuse correctly, place it correctly, pick the right physical class" chain is now fully bidirectional across all four fuse notes.

**MOC updates:** None. [[power-systems]] entry for the ANL note is unchanged -- already correctly placed in "Fusing + main disconnect" section with accurate prose description.

**Articulation test:** All five new connections pass. Each articulates a specific structural or physics relationship, not "related to".

**Not changing:** Title, description, claim, body reasoning, example math. The note was written recently (2026-04-14) with current understanding; only connection gaps needed closing.

## Verify

**Target note:** `knowledge/anl-marine-fuse-class-is-the-correct-selection-for-rover-main-bus-above-60a-because-automotive-blade-fuses-lose-interrupt-capacity-at-dc.md`

**Gate 1 — Description quality:** PASS. Description is specific, adds information beyond the title (includes numbers, rationale, mechanism), and a cold reader could predict the claim's title from it.

**Gate 2 — Schema compliance:** PASS. All required fields present (description, type, created: 2026-04-14, source, confidence: proven, topics, related_components: anl-100-fuse).

**Gate 3 — Graph integrity:** PASS. All 13 wiki-links resolve.

**Result:** All gates PASS. No gaps.
