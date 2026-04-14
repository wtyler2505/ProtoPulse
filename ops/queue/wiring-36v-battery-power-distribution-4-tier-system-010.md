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
## Verify
