---
type: enrichment
target_note: "[[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]]"
source_task: wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter
addition: "Add the positive-case GPIO allocation rationale — ADC1 (WiFi-safe), no strapping-pin conflict, read-only matches Hall sensor topology"
source_lines: "62-69"
---

# Enrichment 052: [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]]

Source: [[wiring-hall-sensors-to-esp32-via-txs0108e-level-shifter]] (lines 62-69)

## Reduce Notes

Enrichment for [[esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors]]. The existing note focuses on the LIMITATION (cannot output, no internal pulls). Source adds the mirror-image POSITIVE case: these same properties make GPIO34/35/36/39 the IDEAL allocation for read-only sensors. Four framings to add:

1. Input-only matches read-only sensor perfectly
2. No internal pull-up is fine when the upstream driver (e.g. TXS0108E) provides one
3. Not strapping pins — no boot-behavior side effects
4. ADC1 channels — remain usable with WiFi active (see [[esp32-adc2-unavailable-when-wifi-active]])

Rationale: This transforms the note from "watch out for these pins" into "allocate these pins FIRST for read-only sensors, then use bidirectional GPIOs for the rest." Much more useful for planning. Complements [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]] from the other direction.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
