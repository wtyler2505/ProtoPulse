---
claim: "10uF ceramic on ESP32 Vin prevents WiFi TX brownouts because radio bursts pull current faster than the buck regulator responds"
classification: closed
source_task: wiring-36v-battery-power-distribution-4-tier-system
semantic_neighbor: "every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients"
---

# Claim 004: 10uF ceramic on ESP32 Vin prevents WiFi TX brownouts

Source: [[wiring-36v-battery-power-distribution-4-tier-system]] (lines 344-352)

## Reduce Notes

Extracted from wiring-36v-battery-power-distribution-4-tier-system. This is a CLOSED claim.

Rationale: The specific failure mode (WiFi TX pulses outpacing buck regulator control loop bandwidth, causing brownout resets) is not captured in existing decoupling notes. The 10uF ceramic at Vin is a distinct pattern from the 100nF-near-VCC pattern that general decoupling notes describe.

Semantic neighbor: every-digital-ic-requires-100nf covers general decoupling; this claim is DISTINCT because it addresses radio-burst transients at a different frequency band and scale (10uF vs 100nF).

---

## Create

Insight exists at `knowledge/10uf-ceramic-on-esp32-vin-prevents-wifi-tx-brownouts-because-radio-bursts-pull-current-faster-than-the-buck-regulator-responds.md`. Phase reconciled by ralph lead 2026-04-14 — insight was authored out-of-band before queue was advanced.

## Connect

**Discovery Trace:**
- Topic map [[power-systems]] — note listed at line 28 under "Regulators" with phrase "bulk cap closes the gap between WiFi burst demand and buck-regulator response time"
- Inline body links verified: [[every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients]], [[switching-buck-converters-waste-watts-not-volts-making-them-essential-for-large-voltage-differentials]], [[inductive-motor-loads-require-bypass-capacitor-to-absorb-voltage-spikes-above-supply-rail]]
- Sibling candidates evaluated: [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] — related but describes a separate current-ceiling constraint, not the transient-response issue. Not linked. [[100uf-capacitor-on-arduino-5v-input-absorbs-motor-switching-emi...]] — parallel pattern at different frequency band; already captured via the 100nF sibling note which itself will link to both.

**Connections verified:** 3 inline prose links + 3 topics. Articulation test PASS (100nF sibling = different frequency band, buck converter = the regulator that cannot keep up, inductive-motor-loads = parallel concept for motor-side transients).

**MOC updates:** [[power-systems]] entry verified — no change.

**Agent note:** This note pairs with the 100nF-decoupling note to form a "decoupling-at-two-frequency-bands" reasoning chain. Synthesis opportunity: a higher-order claim "power-supply bypass requires a capacitor at every frequency band the load operates in" combining the 100nF (MHz), 10uF (kHz), and 100uF (sub-kHz motor EMI) siblings.

## Revisit

**Claim status:** unchanged — claim is sharp, prose is strong, scope focused; no sharpen/split/challenge needed.

**Backward pass — connections added to target note:**
- [[powering-the-mcu-from-the-zs-x11h-5v-output-causes-resets-because-motor-switching-noise-on-the-shared-rail-corrupts-the-logic-supply]] — architectural prerequisite (this cap only works on top of an isolated clean rail). The ZS-X11H note already links FORWARD to this note citing it as "the Vin cap that rides on the clean LM2596 rail"; the backward link was missing. Added as inline prose paragraph AND footer entry.
- [[100uf-capacitor-on-arduino-5v-input-absorbs-motor-switching-emi-that-causes-mcu-resets]] — symmetric pair (load-pulled transients vs source-injected transients, same mitigation). The 100uF note already links forward explicitly calling the pair "symmetric problems, same mitigation ... different direction of energy flow." Backward link was missing. Added to footer.

**Siblings evaluated and rejected:**
- [[esp32-ams1117-regulator-limits-total-board-current-to-800ma]] — related (AMS1117 is the LDO downstream of the Vin cap) but describes a steady-state current ceiling, not transient response. Connect phase already rejected this for same reason. Adding it would dilute the transient-response focus. REJECT.
- 130K divider, BMS port, per-branch fusing, LVD hysteresis, E-STOP aux, lead acid LVD, LiFePO4 12S, linear voltage-to-percentage, ANL marine fuse — all unrelated to decoupling/transient response. REJECT.

**Network effect:** Outgoing links 3 → 5. Bridges the decoupling-frequency-ladder ([[every-digital-ic-requires-100nf]] + [[100uf-capacitor-on-arduino-5v-input]]) with the supply-isolation-architecture ([[powering-the-mcu-from-zs-x11h]]). The "decoupling at every frequency band the load operates" synthesis flagged in Connect is now structurally supported — agent traversing any of the three caps (100nF, 10uF, 100uF) can reach the other two.

**MOC updates:** None — [[power-systems]] entry already accurately describes this note ("bulk cap closes the gap between WiFi burst demand and buck-regulator response time"). No change needed.

**Enrichment signals:** None. No title-sharpen, split-recommended, or merge-candidate flags from enrich phase.

## Verify
