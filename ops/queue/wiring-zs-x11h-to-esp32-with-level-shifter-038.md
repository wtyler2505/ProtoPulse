---
type: enrichment
target_note: "[[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]]"
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
addition: "Add concrete motor-control worked pin allocation: GPIO16-19 for four motor control outputs plus GPIO4 for interrupt-capable feedback input, with explicit reasoning why each pin was chosen"
source_lines: "110-124"
---

# Enrichment 038: [[esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions]]

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (lines 110-124)

## Reduce Notes

Enrichment for the ESP32 safe GPIO note. Source provides a concrete worked allocation of 5 of the 14 safe pins for a motor control application: GPIO16 (PWM speed), GPIO17 (direction), GPIO18 (brake), GPIO19 (enable), GPIO4 (speed feedback interrupt). Existing note lists the 14 safe pins and explains which pins are restricted and why, but does not show what "safe pin allocation" looks like for a real project. Enrichment adds the worked allocation table plus the strapping-pin warning (avoid GPIO0/2/12/15 for outputs) and the flash-pin warning (avoid GPIO6-11).

Rationale: The core claim (14 safe pins exist) is unchanged. Source adds application guidance for how to allocate those pins in a typical motor-control design.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
