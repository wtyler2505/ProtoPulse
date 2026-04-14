---
type: enrichment
target_note: "[[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]]"
source_task: wiring-zs-x11h-to-esp32-with-level-shifter
addition: "Add motor PWM to ZS-X11H as a concrete case where sluggish BSS138 rise times cause the controller to misinterpret speed commands at higher PWM frequencies, and flag the TXS0108E as the recommended replacement"
source_lines: "225-239"
---

# Enrichment 040: [[bss138-switching-speed-caps-at-400khz-making-it-unsuitable-for-fast-spi-and-high-speed-push-pull-signals]]

Source: [[wiring-zs-x11h-to-esp32-with-level-shifter]] (lines 225-239)

## Reduce Notes

Enrichment for the BSS138 speed ceiling note. Source adds a concrete motor-control application case: even well within BSS138's 400kHz envelope, PWM edges at 1kHz-20kHz can produce sluggish rise times on the EL control line that the ZS-X11H misinterprets at higher PWM frequencies — because the controller samples the signal with a timing budget that assumes square-wave edges, not RC ramps. Source explicitly recommends TXS0108E for motor PWM specifically because of this edge-quality concern, adding the BSS138 vs TXS0108E comparison table (channels, max speed, drive strength, price).

Rationale: The core claim (BSS138 RC ceiling limits edge quality, not just frequency) is unchanged. Source adds a new failure mode at frequencies well below the 400kHz ceiling, specifically for controllers that sample the signal with tight timing windows.

---

## Enrich
(to be filled by enrich phase)

## Connect
(to be filled by connect phase)

## Revisit
(to be filled by revisit phase)

## Verify
(to be filled by verify phase)
