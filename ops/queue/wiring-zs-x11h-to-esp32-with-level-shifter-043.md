---
type: enrichment
target_note: "[[signal-topology-not-voltage-alone-determines-level-shifter-selection]]"
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
addition: "Add ZS-X11H control signal set (EL PWM, Z/F direction, CT brake, STOP enable) as a worked 4-channel unidirectional push-pull case that selects TXS0108E over BSS138 for edge quality"
source_lines: "26-43, 225-239"
---

# Enrichment 043: [[signal-topology-not-voltage-alone-determines-level-shifter-selection]]

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (lines 26-43, 225-239)

## Reduce Notes

Enrichment for the signal-topology selection note. Existing note lists worked cases for I2C, SPI, UART, NeoPixel, BLDC Hall outputs, and I2S. Source adds the BLDC-controller CONTROL SIGNALS case (distinct from Hall sensor outputs which are already covered): ESP32 → ZS-X11H EL/Z/F/CT/STOP are 4 unidirectional push-pull signals at PWM rates (1kHz typical, up to 20kHz possible). These select TXS0108E over BSS138 because:
- Unidirectional push-pull → auto-direction works (not open-drain)
- PWM edges at 1-20kHz are well within BSS138's 400kHz envelope BUT the controller sampling window is tight enough that RC-rounded edges fail
- TXS0108E's active one-shot drives clean edges

This sits naturally in the note's existing worked-example list.

Rationale: Core claim (topology drives selection) unchanged. Source adds the motor-controller-CONTROL case alongside the motor-controller-SENSOR case already documented.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
