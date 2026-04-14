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
## Revisit
## Verify
