---
claim: "4WD Hall-sensor scaling needs 16 level-shifted channels which makes one TXS0108E per controller the cleanest topology because cross-controller channel grouping mixes ground references and invites noise"
classification: closed
source_task: wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter
semantic_neighbor: null
---

# Claim 047: 4WD Hall-sensor scaling needs one TXS0108E per controller as cleanest topology

Source: [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]] (lines 114-122)

## Reduce Notes

Extracted from wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter. This is a CLOSED claim.

Rationale: The source presents three scaling options for 4-motor systems (4 shifters, 2 shifters, mixed shifting) and names one-per-controller as cleanest. This is a genuine design pattern claim about BOM-count-vs-topology-integrity trade-offs. The reasoning — that mixing multiple controllers through a single shifter requires shared references that aren't inherently clean across separate motor PSUs — is not captured elsewhere. Useful for [[breadboard-intelligence]] topic and any future 4WD rover planning.

Semantic neighbor: [[four-motor-bldc-systems-exceed-standard-hoverboard-bms-ratings-requiring-firmware-current-limiting]] touches 4WD scaling but addresses a different dimension (current budget, not signal topology). DISTINCT.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
