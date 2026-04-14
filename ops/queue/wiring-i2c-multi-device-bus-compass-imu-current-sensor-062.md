---
type: enrichment
target_note: "[[oled-i2c-modules-include-onboard-pull-ups-and-external-pull-ups-should-only-be-added-for-bus-lengths-exceeding-30cm]]"
source_task: wiring-i2c-multi-device-bus-compass-imu-current-sensor
addition: "Add the I2C sink-current specification (3mA maximum at 5V) and the resulting minimum effective pull-up formula (V_bus / I_sink_max = 5V / 3mA = 1.67K) as the hard numerical floor below which open-drain drivers cannot assert LOW against the pull-up current"
source_lines: "107-120"
---

# Enrichment 062: [[oled-i2c-modules-include-onboard-pull-ups-and-external-pull-ups-should-only-be-added-for-bus-lengths-exceeding-30cm]]

Source: [[wiring-i2c-multi-device-bus-compass-imu-current-sensor]] (lines 107-120)

## Reduce Notes

Enrichment for [[oled-i2c-modules-include-onboard-pull-ups-and-external-pull-ups-should-only-be-added-for-bus-lengths-exceeding-30cm]]. Source adds the specific I2C spec floor: sink current limit is 3mA at 5V, which means minimum effective pull-up resistance is 5V / 3mA = 1.67K. The existing note says "typically no lower than ~1K ohm for standard mode" without showing where that number comes from; the enrichment grounds it in the datasheet-level spec.

Rationale: The existing note articulates the parallel-pull-up problem and the "desolder when too many devices" solution but lacks the hard numerical floor that lets a DRC rule fire. The source provides the exact formula (V_bus / I_sink_max) and worked examples (3 devices = 3.3K effective = 1.5mA safe; 4 devices = 2.5K = 2.0mA safe; 5 devices = 2.0K = 2.5mA borderline). Adding this transforms the note from a qualitative rule of thumb into a checkable calculation.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
