---
claim: "Hall Temp output is a fourth level-shifted channel available on many BLDC controllers that provides motor thermal monitoring through the same 5V-to-3.3V path as the Hall position signals"
classification: open
source_task: wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter
semantic_neighbor: null
---

# Claim 048: Hall Temp is a fourth level-shifted channel for thermal monitoring on BLDC controllers

Source: [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]] (lines 24, 35)

## Reduce Notes

Extracted from wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter. This is an OPEN claim.

Rationale: The source lists Hall Temp among the readable signals and wires it into the B4/A4 channel pair. This is a design pattern that beginners miss — they budget 3 Hall channels + 1 unused and discover later that thermal protection is sitting right there on the controller header. Classification is OPEN because "some controllers" language in the source indicates the feature is not universal and needs verification per controller part (signal format, analog vs digital, scaling).

Semantic neighbor: No existing note covers controller-provided Hall Temp or thermal readout via the Hall header. Only adjacent notes cover thermistor-based motor temp sensing as a separate sensor.

---

## Create
(to be filled by create phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
